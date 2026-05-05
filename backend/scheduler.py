"""
Scheduler de notificações — roda dentro do FastAPI.

A cada 60 segundos, duas tarefas são executadas:

1. check_dose_ready   → dose está no horário, paciente precisa ser avisado
2. check_dose_missed  → passou o timeout sem confirmação, avisar paciente + cuidadores

A tarefa dose_taken (paciente tomou) é disparada diretamente pelo mqtt_client.py
quando o ESP32 confirma, e pelo endpoint /confirm quando o paciente confirma no app.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import func as sa_func

from apscheduler.schedulers.background import BackgroundScheduler

from backend.database import SessionLocal
from backend.models import (
    DispensationEvent, Medication, Notification,
    PatientCaregiver, Schedule, User,
)

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _ja_notificou(db, event_id, user_id, tipo: str) -> bool:
    """Evita criar a mesma notificação duas vezes para o mesmo evento."""
    return db.query(Notification).filter(
        Notification.event_id == event_id,
        Notification.user_id  == user_id,
        Notification.type     == tipo,
    ).first() is not None


def _criar_notificacao(db, user_id, event_id, tipo: str, mensagem: str):
    notif = Notification(
        user_id  = user_id,
        event_id = event_id,
        type     = tipo,
        message  = mensagem,
    )
    db.add(notif)


def _get_patient_id(db, event_id) -> str | None:
    """Dado um event_id, retorna o user_id do paciente dono do medicamento."""
    evento = db.query(DispensationEvent).filter(
        DispensationEvent.id == event_id
    ).first()
    if not evento:
        return None

    schedule = db.query(Schedule).filter(
        Schedule.id == evento.schedule_id
    ).first()
    if not schedule:
        return None

    med = db.query(Medication).filter(
        Medication.id == schedule.medication_id
    ).first()
    return str(med.user_id) if med else None


def _get_caregiver_ids(db, patient_id: str) -> list[str]:
    """Retorna os IDs de todos os cuidadores ativos vinculados ao paciente."""
    vinculos = db.query(PatientCaregiver).filter(
        PatientCaregiver.patient_id == patient_id,
        PatientCaregiver.active     == True,
    ).all()
    return [str(v.caregiver_id) for v in vinculos]


# ── Tarefa 1 — Dose no horário ────────────────────────────────────────────────

def check_dose_ready():
    """
    Busca todos os eventos de hoje cujo horário já chegou (scheduled_time <= agora)
    e que ainda estão 'pending'. Notifica o paciente.
    _ja_notificou() garante que a notificação seja criada apenas uma vez por evento.
    """
    db = SessionLocal()
    try:
        agora = datetime.now()
        hoje  = agora.date()

        eventos = db.query(DispensationEvent).filter(
            sa_func.date(DispensationEvent.scheduled_time) == hoje,
            DispensationEvent.scheduled_time <= agora,
            DispensationEvent.status         == "pending",
        ).all()

        for evento in eventos:
            patient_id = _get_patient_id(db, evento.id)
            if not patient_id:
                continue
            if _ja_notificou(db, evento.id, patient_id, "dose_ready"):
                continue

            # Busca nome do medicamento para a mensagem
            schedule = db.query(Schedule).filter(
                Schedule.id == evento.schedule_id
            ).first()
            med = db.query(Medication).filter(
                Medication.id == schedule.medication_id
            ).first() if schedule else None

            nome_med = f"{med.name} {med.dosage}" if med else "seu medicamento"
            hora     = evento.scheduled_time.strftime("%H:%M")

            _criar_notificacao(
                db, patient_id, evento.id,
                tipo     = "dose_ready",
                mensagem = f"Hora de tomar {nome_med} ({hora}). Acione o dispenser.",
            )
            logger.info("Notificação dose_ready criada para %s", patient_id)

        db.commit()

    except Exception as e:
        logger.error("Erro em check_dose_ready: %s", e)
        db.rollback()
    finally:
        db.close()


# ── Tarefa 2 — Dose esquecida ─────────────────────────────────────────────────

def check_dose_missed():
    """
    Busca eventos que passaram do timeout sem confirmação.
    Timeout = notification_timeout_minutes do usuário (padrão: 30min).
    Notifica o paciente e todos os cuidadores vinculados.
    """
    db = SessionLocal()
    try:
        agora = datetime.now()
        hoje  = agora.date()

        # Busca apenas os eventos de hoje ainda não confirmados
        eventos_pendentes = db.query(DispensationEvent).filter(
            sa_func.date(DispensationEvent.scheduled_time) == hoje,
            DispensationEvent.status.in_(["pending", "dispensed"]),
        ).all()

        for evento in eventos_pendentes:
            patient_id = _get_patient_id(db, evento.id)
            if not patient_id:
                continue

            # Busca o timeout configurado pelo paciente
            paciente = db.query(User).filter(User.id == patient_id).first()
            timeout  = paciente.notification_timeout_minutes if paciente else 30

            limite = evento.scheduled_time + timedelta(minutes=timeout)
            if agora < limite:
                continue  # ainda não passou do tempo

            # Busca dados do medicamento para a mensagem
            schedule = db.query(Schedule).filter(
                Schedule.id == evento.schedule_id
            ).first()
            med = db.query(Medication).filter(
                Medication.id == schedule.medication_id
            ).first() if schedule else None

            nome_med = f"{med.name} {med.dosage}" if med else "um medicamento"
            hora     = evento.scheduled_time.strftime("%H:%M")

            # Notifica o paciente
            if not _ja_notificou(db, evento.id, patient_id, "dose_missed"):
                _criar_notificacao(
                    db, patient_id, evento.id,
                    tipo     = "dose_missed",
                    mensagem = f"Você não tomou {nome_med} no horário das {hora}.",
                )
                logger.info("Notificação dose_missed → paciente %s", patient_id)

            # Notifica cada cuidador
            for cuidador_id in _get_caregiver_ids(db, patient_id):
                if not _ja_notificou(db, evento.id, cuidador_id, "dose_missed"):
                    nome_paciente = paciente.name if paciente else "O paciente"
                    _criar_notificacao(
                        db, cuidador_id, evento.id,
                        tipo     = "dose_missed",
                        mensagem = f"{nome_paciente} não tomou {nome_med} ({hora}).",
                    )
                    logger.info("Notificação dose_missed → cuidador %s", cuidador_id)

            # Marca o evento como missed no banco
            evento.status = "missed"

        db.commit()

    except Exception as e:
        logger.error("Erro em check_dose_missed: %s", e)
        db.rollback()
    finally:
        db.close()


# ── Tarefa 3 — Dispenser acionado mas não retirado ───────────────────────────

DISPENSED_TIMEOUT_MINUTES = 10

def check_dispensed_timeout():
    """
    Reverte eventos 'dispensed' para 'pending' após DISPENSED_TIMEOUT_MINUTES
    sem confirmação. Permite que o paciente acione o dispenser novamente.
    """
    db = SessionLocal()
    try:
        agora  = datetime.now()
        limite = agora - timedelta(minutes=DISPENSED_TIMEOUT_MINUTES)

        eventos = db.query(DispensationEvent).filter(
            DispensationEvent.status       == "dispensed",
            DispensationEvent.dispensed_at <= limite,
        ).all()

        for evento in eventos:
            evento.status = "pending"
            logger.info(
                "Evento %s revertido dispensed → pending (sem retirada em %smin)",
                evento.id, DISPENSED_TIMEOUT_MINUTES,
            )

        if eventos:
            db.commit()

    except Exception as e:
        logger.error("Erro em check_dispensed_timeout: %s", e)
        db.rollback()
    finally:
        db.close()


# ── Inicialização ─────────────────────────────────────────────────────────────

def init_scheduler():
    """Inicia o scheduler com as três tarefas. Chamado no startup do FastAPI."""
    _scheduler.add_job(check_dose_ready,        "interval", seconds=60, id="dose_ready")
    _scheduler.add_job(check_dose_missed,        "interval", seconds=60, id="dose_missed")
    _scheduler.add_job(check_dispensed_timeout,  "interval", seconds=60, id="dispensed_timeout")
    _scheduler.start()
    logger.info("Scheduler iniciado — verificando doses a cada 60s")


# ── Função pública para criar notificação dose_taken ─────────────────────────

def notify_dose_taken(event_id: str, patient_id: str):
    """
    Chamada pelo mqtt_client (ESP32 confirmou) ou pelo endpoint /confirm.
    Cria notificação 'dose_taken' para cada cuidador do paciente.
    """
    db = SessionLocal()
    try:
        paciente = db.query(User).filter(User.id == patient_id).first()

        evento   = db.query(DispensationEvent).filter(
            DispensationEvent.id == event_id
        ).first()
        if not evento:
            return

        schedule = db.query(Schedule).filter(
            Schedule.id == evento.schedule_id
        ).first()
        med = db.query(Medication).filter(
            Medication.id == schedule.medication_id
        ).first() if schedule else None

        nome_med      = f"{med.name} {med.dosage}" if med else "o medicamento"
        nome_paciente = paciente.name if paciente else "O paciente"
        hora          = evento.scheduled_time.strftime("%H:%M")

        for cuidador_id in _get_caregiver_ids(db, patient_id):
            if not _ja_notificou(db, event_id, cuidador_id, "dose_taken"):
                _criar_notificacao(
                    db, cuidador_id, event_id,
                    tipo     = "dose_taken",
                    mensagem = f"{nome_paciente} tomou {nome_med} ({hora}). ✓",
                )

        db.commit()
    except Exception as e:
        logger.error("Erro em notify_dose_taken: %s", e)
        db.rollback()
    finally:
        db.close()

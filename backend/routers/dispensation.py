from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta

from backend.database import get_db
from backend.models import DispensationEvent, Schedule, Medication
from backend.schemas import ConfirmDoseRequest, TodayEventResponse

router = APIRouter(prefix="/api/dispensation", tags=["Dispensação"])


@router.get("/today/{user_id}", response_model=list[TodayEventResponse])
def get_today_events(user_id: str, db: Session = Depends(get_db)):
    """
    Retorna todos os eventos de dose do dia para um usuário.

    Lógica:
    1. Busca todos os medicamentos ativos do usuário
    2. Para cada medicamento, busca os schedules ativos de hoje
    3. Para cada schedule, verifica se já existe um evento hoje
       - Se existir: retorna com o status atual
       - Se não existir: cria um evento "pending" na hora
    4. Retorna a lista ordenada por horário
    """
    hoje = date.today()
    dia_semana = hoje.weekday()  # 0=seg ... 6=dom (Python)
    # Converte para o padrão do banco: 0=dom, 1=seg, ..., 6=sab
    dia_banco = (dia_semana + 1) % 7

    # 1. Busca medicamentos ativos do usuário
    medicamentos = db.query(Medication).filter(
        Medication.user_id == user_id,
        Medication.active == True
    ).all()

    if not medicamentos:
        return []

    med_ids = [m.id for m in medicamentos]
    # Mapa para acessar dados do medicamento pelo ID
    med_map = {m.id: m for m in medicamentos}

    # 2. Busca schedules ativos que se aplicam hoje
    schedules = db.query(Schedule).filter(
        Schedule.medication_id.in_(med_ids),
        Schedule.active == True
    ).all()

    # Filtra só os que incluem o dia de hoje na lista days_of_week
    schedules_hoje = [s for s in schedules if dia_banco in (s.days_of_week or [])]

    eventos_resposta = []

    for schedule in schedules_hoje:
        # Monta o datetime completo da dose de hoje (ex: 2026-04-11 08:00:00)
        scheduled_dt = datetime.combine(hoje, schedule.time)

        # 3. Verifica se já existe evento para esse schedule hoje
        evento = db.query(DispensationEvent).filter(
            DispensationEvent.schedule_id == schedule.id,
            DispensationEvent.scheduled_time >= datetime.combine(hoje, datetime.min.time()),
            DispensationEvent.scheduled_time < datetime.combine(hoje + timedelta(days=1), datetime.min.time()),
        ).first()

        if not evento:
            # Cria o evento "pending" para esse slot do dia
            evento = DispensationEvent(
                schedule_id=schedule.id,
                scheduled_time=scheduled_dt,
                status="pending"
            )
            db.add(evento)
            db.commit()
            db.refresh(evento)

        med = med_map[schedule.medication_id]
        eventos_resposta.append(TodayEventResponse(
            event_id=evento.id,
            schedule_id=schedule.id,
            scheduled_time=evento.scheduled_time,
            confirmed_at=evento.confirmed_at,
            status=evento.status,
            medication_name=med.name,
            medication_dosage=med.dosage,
            medication_instructions=med.instructions,
        ))

    # Ordena por horário programado
    eventos_resposta.sort(key=lambda e: e.scheduled_time)
    return eventos_resposta


@router.get("/weekly/{user_id}")
def get_weekly_adherence(user_id: str, db: Session = Depends(get_db)):
    """
    Retorna dados de adesão dos últimos 7 dias para um usuário.
    Usado pelo dashboard do cuidador para o gráfico semanal.
    """
    hoje = date.today()
    DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    resultado = []

    # Busca medicamentos do usuário uma vez só
    medicamentos = db.query(Medication).filter(
        Medication.user_id == user_id,
        Medication.active == True
    ).all()
    med_ids = [m.id for m in medicamentos]

    # Busca todos os schedules ativos uma vez só
    if med_ids:
        schedules = db.query(Schedule).filter(
            Schedule.medication_id.in_(med_ids),
            Schedule.active == True
        ).all()
        schedule_ids = [s.id for s in schedules]
    else:
        schedule_ids = []

    for i in range(6, -1, -1):  # 6 dias atrás até hoje
        dia = hoje - timedelta(days=i)
        inicio_dia = datetime.combine(dia, datetime.min.time())
        fim_dia = datetime.combine(dia + timedelta(days=1), datetime.min.time())

        if schedule_ids:
            eventos_dia = db.query(DispensationEvent).filter(
                DispensationEvent.schedule_id.in_(schedule_ids),
                DispensationEvent.scheduled_time >= inicio_dia,
                DispensationEvent.scheduled_time < fim_dia
            ).all()
        else:
            eventos_dia = []

        total = len(eventos_dia)
        confirmados = sum(1 for e in eventos_dia if e.status == 'confirmed')
        percent = round((confirmados / total) * 100) if total > 0 else 0

        # weekday(): 0=seg...6=dom → converte para 0=dom...6=sab
        day_index = (dia.weekday() + 1) % 7
        resultado.append({
            "day": DIAS[day_index],
            "date": str(dia),
            "total": total,
            "confirmed": confirmados,
            "percent": percent
        })

    return resultado


@router.post("/confirm")
def confirm_dose(req: ConfirmDoseRequest, db: Session = Depends(get_db)):
    """
    Paciente confirma que tomou a dose.
    Muda o status para "confirmed" e registra o horário.
    """
    evento = db.query(DispensationEvent).filter(
        DispensationEvent.id == req.event_id
    ).first()

    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if evento.status == "confirmed":
        raise HTTPException(status_code=400, detail="Dose já confirmada")

    evento.status = "confirmed"
    evento.confirmed_at = datetime.now()
    db.commit()
    db.refresh(evento)

    return {"message": "Dose confirmada!", "event_id": str(evento.id), "confirmed_at": evento.confirmed_at}

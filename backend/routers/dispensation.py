from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from calendar import monthrange
from collections import defaultdict

from backend.database import get_db
from backend.models import DispensationEvent, Schedule, Medication
from backend.schemas import ConfirmDoseRequest, TodayEventResponse
import backend.mqtt_client as mqtt_client

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


@router.get("/day/{user_id}", response_model=list[TodayEventResponse])
def get_day_events(user_id: str, date_str: str = None, db: Session = Depends(get_db)):
    """
    Retorna doses de um dia específico para um usuário.
    - Dias passados/hoje: consulta dispensation_events (histórico real)
    - Dias futuros:       consulta schedules ativos para mostrar o que está agendado
    Parâmetro: date_str=2026-04-12 (padrão: hoje)
    """
    if date_str:
        try:
            dia = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato inválido. Use YYYY-MM-DD")
    else:
        dia = date.today()

    hoje = date.today()

    # ── Dia futuro: retorna agendamentos, sem eventos ainda ─────────
    if dia > hoje:
        medicamentos = db.query(Medication).filter(
            Medication.user_id == user_id,
            Medication.active == True,
        ).all()
        if not medicamentos:
            return []

        med_map   = {m.id: m for m in medicamentos}
        # Converte weekday Python (0=seg…6=dom) para padrão do banco (0=dom…6=sab)
        dia_banco = (dia.weekday() + 1) % 7

        schedules = db.query(Schedule).filter(
            Schedule.medication_id.in_(list(med_map.keys())),
            Schedule.active == True,
        ).all()

        resultado = []
        for s in schedules:
            if dia_banco not in (s.days_of_week or []):
                continue

            med = med_map[s.medication_id]

            # Respeita o período do tratamento:
            # - Se start_date definido e dia é anterior ao início → pula
            # - Se duration_days definido e dia é igual ou posterior ao fim → pula
            # Exemplo: start=12/04, duration=10 → válido de 12/04 até 21/04 (exclusive 22/04)
            if med.start_date and dia < med.start_date:
                continue
            if med.duration_days and med.start_date:
                fim = med.start_date + timedelta(days=med.duration_days)
                if dia >= fim:
                    continue

            resultado.append(TodayEventResponse(
                event_id=None,  # ainda não existe o evento
                schedule_id=s.id,
                scheduled_time=datetime.combine(dia, s.time),
                confirmed_at=None,
                status="pending",
                medication_name=med.name,
                medication_dosage=med.dosage,
                medication_instructions=med.instructions,
            ))

        resultado.sort(key=lambda e: e.scheduled_time)
        return resultado

    # ── Dia passado ou hoje: consulta eventos reais ─────────────────
    inicio = datetime.combine(dia, datetime.min.time())
    fim    = datetime.combine(dia + timedelta(days=1), datetime.min.time())

    medicamentos = db.query(Medication).filter(Medication.user_id == user_id).all()
    if not medicamentos:
        return []

    med_map = {m.id: m for m in medicamentos}
    sch_to_med = {}
    for med in medicamentos:
        for s in db.query(Schedule).filter(Schedule.medication_id == med.id).all():
            sch_to_med[s.id] = med

    sch_ids = list(sch_to_med.keys())
    if not sch_ids:
        return []

    eventos = db.query(DispensationEvent).filter(
        DispensationEvent.schedule_id.in_(sch_ids),
        DispensationEvent.scheduled_time >= inicio,
        DispensationEvent.scheduled_time < fim,
    ).order_by(DispensationEvent.scheduled_time).all()

    resultado = []
    for e in eventos:
        med = sch_to_med.get(e.schedule_id)
        if not med:
            continue
        resultado.append(TodayEventResponse(
            event_id=e.id,
            schedule_id=e.schedule_id,
            scheduled_time=e.scheduled_time,
            confirmed_at=e.confirmed_at,
            status=e.status,
            medication_name=med.name,
            medication_dosage=med.dosage,
            medication_instructions=med.instructions,
        ))

    return resultado


@router.get("/calendar/{user_id}")
def get_calendar(user_id: str, month: str = None, db: Session = Depends(get_db)):
    """
    Retorna dados de adesão para cada dia de um mês.
    Parâmetro: month=2026-04 (padrão: mês atual)

    Status por dia:
    - future  → dia ainda não chegou
    - none    → sem eventos registrados nesse dia
    - full    → todas as doses confirmadas (verde)
    - partial → algumas confirmadas (vermelho — perdeu ao menos uma)
    - missed  → nenhuma confirmada (vermelho)
    """
    hoje = date.today()

    if not month:
        month = hoje.strftime("%Y-%m")

    try:
        ano, mes = map(int, month.split("-"))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Formato inválido. Use YYYY-MM")

    _, ultimo_dia = monthrange(ano, mes)
    inicio_mes = datetime(ano, mes, 1, 0, 0, 0)
    fim_mes    = datetime(ano, mes, ultimo_dia, 23, 59, 59)

    # Todos os medicamentos do usuário (ativos e inativos — eventos antigos importam)
    med_ids = [
        m.id for m in db.query(Medication.id).filter(Medication.user_id == user_id).all()
    ]

    if not med_ids:
        return [
            {"date": str(date(ano, mes, d)), "total": 0, "confirmed": 0,
             "status": "future" if date(ano, mes, d) > hoje else "none"}
            for d in range(1, ultimo_dia + 1)
        ]

    schedule_ids = [
        s.id for s in db.query(Schedule.id).filter(Schedule.medication_id.in_(med_ids)).all()
    ]

    if not schedule_ids:
        return [
            {"date": str(date(ano, mes, d)), "total": 0, "confirmed": 0,
             "status": "future" if date(ano, mes, d) > hoje else "none"}
            for d in range(1, ultimo_dia + 1)
        ]

    # Uma única query para todos os eventos do mês
    eventos = db.query(DispensationEvent).filter(
        DispensationEvent.schedule_id.in_(schedule_ids),
        DispensationEvent.scheduled_time >= inicio_mes,
        DispensationEvent.scheduled_time <= fim_mes,
    ).all()

    # Agrupa por dia em Python (sem N queries)
    por_dia = defaultdict(list)
    for e in eventos:
        por_dia[e.scheduled_time.date().isoformat()].append(e)

    agora = datetime.now()
    resultado = []

    for dia_num in range(1, ultimo_dia + 1):
        dia     = date(ano, mes, dia_num)
        dia_str = dia.isoformat()

        if dia > hoje:
            status = "future"
            total = confirmed = 0

        else:
            evts      = por_dia.get(dia_str, [])
            total     = len(evts)
            confirmed = sum(1 for e in evts if e.status == "confirmed")

            if total == 0:
                status = "none"
            elif confirmed == total:
                status = "full"
            elif dia == hoje:
                # Dia atual: verifica se as doses pendentes ainda não chegaram no horário
                # Só é "faltou" se o horário da dose já passou e ela não foi confirmada
                nao_conf_passadas = sum(
                    1 for e in evts
                    if e.status != "confirmed" and e.scheduled_time <= agora
                )
                if nao_conf_passadas == 0:
                    # Todas as pendentes são no futuro de hoje — ainda em dia
                    status = "in_progress"
                elif confirmed > 0:
                    status = "partial"
                else:
                    status = "missed"
            elif confirmed > 0:
                status = "partial"
            else:
                status = "missed"

        resultado.append({"date": dia_str, "total": total, "confirmed": confirmed, "status": status})

    return resultado


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


@router.post("/trigger/{event_id}")
def trigger_dispense(event_id: str, db: Session = Depends(get_db)):
    """
    Frontend chama este endpoint para acionar o dispenser físico via MQTT.

    Fluxo:
    1. Busca o evento no banco e valida que está pendente
    2. Pega nome e dosagem do medicamento
    3. Publica em smartpills/dispense para o ESP32
    4. ESP32 dispensa, paciente pressiona o botão
    5. ESP32 publica em smartpills/dispensed
    6. Backend recebe e atualiza status para "dispensed"
    """
    evento = db.query(DispensationEvent).filter(
        DispensationEvent.id == event_id
    ).first()

    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if evento.status not in ("pending",):
        raise HTTPException(
            status_code=400,
            detail=f"Evento já está com status '{evento.status}' — não pode ser acionado novamente"
        )

    # Busca schedule → medicamento para ter nome e dosagem
    schedule = db.query(Schedule).filter(Schedule.id == evento.schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    med = db.query(Medication).filter(Medication.id == schedule.medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")

    mqtt_client.publish_dispense(
        event_id        = str(evento.id),
        schedule_id     = str(evento.schedule_id),
        medication_name = med.name,
        medication_dosage = med.dosage,
    )

    # Marca que o dispenser físico foi acionado
    evento.status       = "dispensed"
    evento.dispensed_at = datetime.now()
    db.commit()

    return {
        "message": "Comando enviado ao dispenser",
        "event_id": str(evento.id),
        "medication": f"{med.name} {med.dosage}",
    }


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

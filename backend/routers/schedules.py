from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from backend.database import get_db
from backend.models import Schedule, Medication
from backend.schemas import ScheduleCreate, ScheduleResponse

router = APIRouter(prefix="/api/schedules", tags=["Agendamentos"])


# Criar agendamento
@router.post("/", response_model=ScheduleResponse)
def create_schedule(schedule: ScheduleCreate, db: Session = Depends(get_db)):
    # Verifica se o medicamento existe
    medication = db.query(Medication).filter(Medication.id == schedule.medication_id).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")

    # Converte a string "HH:MM" para objeto de tempo
    try:
        time_obj = datetime.strptime(schedule.time, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de horário inválido. Use HH:MM (ex: 08:00)")

    new_schedule = Schedule(
        medication_id=schedule.medication_id,
        time=time_obj,
        days_of_week=schedule.days_of_week
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)

    # Converte o time de volta para string antes de retornar
    new_schedule.time = new_schedule.time.strftime("%H:%M")
    return new_schedule


# Listar agendamentos de um medicamento
@router.get("/medication/{medication_id}", response_model=list[ScheduleResponse])
def list_schedules(medication_id: str, db: Session = Depends(get_db)):
    schedules = db.query(Schedule).filter(
        Schedule.medication_id == medication_id,
        Schedule.active == True
    ).all()

    for s in schedules:
        s.time = s.time.strftime("%H:%M")
    return schedules

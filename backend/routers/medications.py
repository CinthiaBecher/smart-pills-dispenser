from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
from backend.database import get_db
from backend.models import Medication, User, Schedule, DispensationEvent
from datetime import time as time_type
from backend.schemas import MedicationCreate, MedicationResponse, MedicationEdit

router = APIRouter(prefix="/api/medications", tags=["Medicamentos"])


# Criar medicamento
@router.post("/", response_model=MedicationResponse)
def create_medication(medication: MedicationCreate, db: Session = Depends(get_db)):
    # Verifica se o paciente existe
    user = db.query(User).filter(User.id == medication.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    new_medication = Medication(**medication.model_dump())
    db.add(new_medication)
    db.commit()
    db.refresh(new_medication)
    return new_medication


# Listar medicamentos de um paciente
# Também verifica e expira medicamentos temporários cujo prazo já passou
@router.get("/user/{user_id}", response_model=list[MedicationResponse])
def list_medications(user_id: str, db: Session = Depends(get_db)):
    meds = db.query(Medication).filter(
        Medication.user_id == user_id,
        Medication.active == True
    ).all()

    hoje = date.today()
    expirou_algum = False
    for med in meds:
        if med.duration_days and med.start_date:
            fim = med.start_date + timedelta(days=med.duration_days)
            if fim < hoje:
                med.active = False
                expirou_algum = True

    if expirou_algum:
        db.commit()

    # Retorna apenas os ainda ativos após a checagem
    return [m for m in meds if m.active]


# Verificar se o usuário já possui medicamento ativo com o mesmo nome
# ATENÇÃO: esta rota deve ficar ANTES de /{medication_id} para evitar conflito de matching
@router.get("/check-duplicate/{user_id}")
def check_duplicate(user_id: str, name: str, db: Session = Depends(get_db)):
    existing = db.query(Medication).filter(
        Medication.user_id == user_id,
        Medication.name.ilike(f"%{name}%"),
        Medication.active == True
    ).first()
    return {
        "exists": existing is not None,
        "medication_id": str(existing.id) if existing else None,
    }


# Buscar medicamento por ID
@router.get("/{medication_id}", response_model=MedicationResponse)
def get_medication(medication_id: str, db: Session = Depends(get_db)):
    medication = db.query(Medication).filter(Medication.id == medication_id).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")
    return medication


# Atualizar medicamento (nome, dosagem, via, instruções, duração e horários)
@router.patch("/{medication_id}", response_model=MedicationResponse)
def update_medication(medication_id: str, data: MedicationEdit, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")

    if data.name         is not None: med.name         = data.name
    if data.dosage       is not None: med.dosage       = data.dosage
    if data.route        is not None: med.route        = data.route
    if data.instructions is not None: med.instructions = data.instructions
    if data.duration_days is not None: med.duration_days = data.duration_days

    # Atualiza horários sem deletar schedules referenciados por dispensation_events
    if data.times is not None:
        new_times = [t for t in data.times if t]
        existing  = db.query(Schedule).filter(Schedule.medication_id == medication_id).all()

        # Atualiza os schedules existentes com os novos horários (em ordem)
        hoje = date.today()
        for i, sched in enumerate(existing):
            if i < len(new_times):
                try:
                    h, m = map(int, new_times[i].split(':'))
                    sched.time = time_type(h, m)

                    # Atualiza eventos pendentes de hoje para refletir o novo horário
                    novo_scheduled = datetime.combine(hoje, time_type(h, m))
                    eventos_hoje = db.query(DispensationEvent).filter(
                        DispensationEvent.schedule_id == sched.id,
                        DispensationEvent.status      == "pending",
                        func.date(DispensationEvent.scheduled_time) == hoje,
                    ).all()
                    for evento in eventos_hoje:
                        evento.scheduled_time = novo_scheduled

                except (ValueError, AttributeError):
                    pass
            else:
                # Remove schedules excedentes apenas se não tiverem eventos vinculados
                referenciado = db.query(DispensationEvent).filter(
                    DispensationEvent.schedule_id == sched.id
                ).first()
                if not referenciado:
                    db.delete(sched)

        # Cria novos schedules para horários além dos existentes
        for i in range(len(existing), len(new_times)):
            try:
                h, m = map(int, new_times[i].split(':'))
                db.add(Schedule(medication_id=med.id, time=time_type(h, m)))
            except (ValueError, AttributeError):
                pass

    db.commit()
    db.refresh(med)
    return med


# Remover medicamento (soft delete — mantém histórico)
@router.delete("/{medication_id}")
def delete_medication(medication_id: str, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")

    med.active = False
    db.commit()
    return {"message": "Medicamento removido"}

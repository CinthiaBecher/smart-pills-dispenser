from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta
from backend.database import get_db
from backend.models import Medication, User
from backend.schemas import MedicationCreate, MedicationResponse

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

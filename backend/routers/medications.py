from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
@router.get("/user/{user_id}", response_model=list[MedicationResponse])
def list_medications(user_id: str, db: Session = Depends(get_db)):
    return db.query(Medication).filter(
        Medication.user_id == user_id,
        Medication.active == True
    ).all()


# Buscar medicamento por ID
@router.get("/{medication_id}", response_model=MedicationResponse)
def get_medication(medication_id: str, db: Session = Depends(get_db)):
    medication = db.query(Medication).filter(Medication.id == medication_id).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")
    return medication

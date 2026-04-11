from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, PatientCaregiver
from backend.schemas import AddCaregiverRequest, CaregiverResponse

router = APIRouter(prefix="/api/caregivers", tags=["Cuidadores"])


@router.get("/{patient_id}", response_model=list[CaregiverResponse])
def list_caregivers(patient_id: str, db: Session = Depends(get_db)):
    """Lista todos os cuidadores vinculados a um paciente."""
    vinculos = db.query(PatientCaregiver).filter(
        PatientCaregiver.patient_id == patient_id
    ).all()

    resultado = []
    for v in vinculos:
        cuidador = db.query(User).filter(User.id == v.caregiver_id).first()
        if cuidador:
            resultado.append(CaregiverResponse(
                id=v.id,
                caregiver_id=cuidador.id,
                name=cuidador.name,
                email=cuidador.email,
            ))
    return resultado


@router.post("/{patient_id}")
def add_caregiver(patient_id: str, body: AddCaregiverRequest, db: Session = Depends(get_db)):
    """Adiciona um cuidador ao paciente pelo email do cuidador."""

    # Verifica se o paciente existe
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")

    # Busca o cuidador pelo email
    cuidador = db.query(User).filter(User.email == body.caregiver_email).first()
    if not cuidador:
        raise HTTPException(status_code=404, detail="Nenhum usuário encontrado com esse e-mail")

    if str(cuidador.id) == str(patient_id):
        raise HTTPException(status_code=400, detail="Você não pode adicionar a si mesmo como cuidador")

    # Verifica se o vínculo já existe
    existente = db.query(PatientCaregiver).filter(
        PatientCaregiver.patient_id == patient_id,
        PatientCaregiver.caregiver_id == cuidador.id
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Esse cuidador já está vinculado")

    vinculo = PatientCaregiver(patient_id=patient_id, caregiver_id=cuidador.id)
    db.add(vinculo)
    db.commit()

    return {"message": f"{cuidador.name} adicionado como cuidador com sucesso"}


@router.delete("/{patient_id}/{vinculo_id}")
def remove_caregiver(patient_id: str, vinculo_id: str, db: Session = Depends(get_db)):
    """Remove o vínculo entre paciente e cuidador."""
    vinculo = db.query(PatientCaregiver).filter(
        PatientCaregiver.id == vinculo_id,
        PatientCaregiver.patient_id == patient_id
    ).first()

    if not vinculo:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado")

    db.delete(vinculo)
    db.commit()
    return {"message": "Cuidador removido com sucesso"}

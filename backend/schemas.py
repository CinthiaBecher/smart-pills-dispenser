from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid


# Dados necessários para CRIAR um usuário
class UserCreate(BaseModel):
    name: str
    email: EmailStr  # valida automaticamente se é um email válido
    role: str = "patient"  # valor padrão: paciente
    notification_timeout_minutes: int = 30


# Dados retornados pela API ao consultar um usuário
class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    notification_timeout_minutes: int

    class Config:
        from_attributes = True  # permite converter objeto do banco para esse schema


# Dados necessários para CRIAR um medicamento
class MedicationCreate(BaseModel):
    user_id: uuid.UUID
    name: str
    dosage: str
    route: str = "oral"
    instructions: Optional[str] = None   # Optional = campo não obrigatório
    restrictions: Optional[str] = None
    compartment: Optional[int] = None


# Dados retornados pela API ao consultar um medicamento
class MedicationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    dosage: str
    route: str
    instructions: Optional[str]
    restrictions: Optional[str]
    compartment: Optional[int]
    active: bool

    class Config:
        from_attributes = True


# Dados necessários para CRIAR um agendamento
class ScheduleCreate(BaseModel):
    medication_id: uuid.UUID
    time: str                                    # horário no formato "HH:MM" ex: "08:00"
    days_of_week: List[int] = [0,1,2,3,4,5,6]  # padrão: todos os dias da semana


# Dados retornados pela API ao consultar um agendamento
class ScheduleResponse(BaseModel):
    id: uuid.UUID
    medication_id: uuid.UUID
    time: str
    days_of_week: List[int]
    active: bool

    class Config:
        from_attributes = True

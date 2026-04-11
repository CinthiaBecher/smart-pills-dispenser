from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid


# Dados necessários para CRIAR um usuário
class UserCreate(BaseModel):
    name: str
    email: EmailStr  # valida automaticamente se é um email válido
    role: str = "patient"  # valor padrão: paciente
    notification_timeout_minutes: int = 30


# Dados para ATUALIZAR um usuário (todos opcionais)
class UserUpdate(BaseModel):
    name: Optional[str] = None
    notification_timeout_minutes: Optional[int] = None


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
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Um medicamento confirmado pelo usuário após a interpretação da receita
class ConfirmedMedication(BaseModel):
    name: str
    dosage: str
    route: str = "oral"
    instructions: Optional[str] = None
    frequency: Optional[str] = None  # ex: "2x ao dia", "a cada 8 horas", "à noite"


# Request do endpoint /prescriptions/confirm
class PrescriptionConfirmRequest(BaseModel):
    user_id: uuid.UUID
    medications: List[ConfirmedMedication]


# Mensagem enviada pelo frontend para o chat
class ChatMessage(BaseModel):
    user_id: uuid.UUID
    message: str


# Resposta do chat retornada pela API
class ChatResponse(BaseModel):
    reply: str


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


# ── Cuidadores ───────────────────────────────────────────────────

class AddCaregiverRequest(BaseModel):
    caregiver_email: str  # paciente adiciona cuidador pelo email

class CaregiverResponse(BaseModel):
    id: uuid.UUID        # id do vínculo
    caregiver_id: uuid.UUID
    name: str
    email: str

    class Config:
        from_attributes = True


# ── Dispensation Events ──────────────────────────────────────────

# O que o frontend envia para confirmar que tomou a dose
class ConfirmDoseRequest(BaseModel):
    event_id: uuid.UUID


# O que o dashboard recebe para montar a agenda do dia
# Inclui dados do medicamento junto para não precisar de chamadas extras
class TodayEventResponse(BaseModel):
    event_id: uuid.UUID
    schedule_id: uuid.UUID
    scheduled_time: datetime
    confirmed_at: Optional[datetime]
    status: str                   # pending | dispensed | confirmed | missed
    medication_name: str          # ex: "Losartana"
    medication_dosage: str        # ex: "50mg"
    medication_instructions: Optional[str]

    class Config:
        from_attributes = True

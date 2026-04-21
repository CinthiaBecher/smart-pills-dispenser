from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date
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


# Dados para REGISTRAR um novo usuário (tela de cadastro)
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    role: str = "patient"                        # "patient" ou "caregiver"
    patient_email: Optional[str] = None          # só preenchido se role="caregiver"


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
    instructions: Optional[str] = None
    restrictions: Optional[str] = None
    compartment: Optional[int] = None
    start_date: Optional[date] = Field(default_factory=date.today)
    duration_days: Optional[int] = None  # null = uso contínuo


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
    start_date: Optional[date] = None
    duration_days: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Um medicamento confirmado pelo usuário após a interpretação da receita
class ConfirmedMedication(BaseModel):
    name: str
    dosage: str
    route: str = "oral"
    instructions: Optional[str] = None
    frequency: Optional[str] = None      # ex: "2x ao dia", "a cada 8 horas"
    duration_days: Optional[int] = None  # ex: 7 (tomar por 7 dias), null = uso contínuo
    description: Optional[str] = None   # indicação terapêutica extraída pela IA (ex: Anti-hipertensivo)


# Request do endpoint /prescriptions/confirm
# Agora inclui os dados da receita para salvar o histórico
class PrescriptionConfirmRequest(BaseModel):
    user_id: uuid.UUID
    medications: List[ConfirmedMedication]
    patient_name: Optional[str] = None
    prescription_date: Optional[str] = None   # YYYY-MM-DD
    doctor_name: Optional[str] = None
    doctor_crm: Optional[str] = None
    image_base64: Optional[str] = None        # data URL da imagem (data:image/jpeg;base64,...)


# Item na listagem de receitas escaneadas (sem imagem para não pesar)
class PrescriptionListItem(BaseModel):
    id: uuid.UUID
    patient_name: Optional[str]
    prescription_date: Optional[date]
    doctor_name: Optional[str]
    doctor_crm: Optional[str]
    medications_json: Optional[str]
    scanned_at: datetime

    class Config:
        from_attributes = True


# Detalhe de uma receita (inclui a imagem)
class PrescriptionDetail(PrescriptionListItem):
    image_base64: Optional[str]


# Mensagem enviada pelo frontend para o chat
class ChatMessage(BaseModel):
    user_id: uuid.UUID
    message: str


# Resposta do chat retornada pela API
class ChatResponse(BaseModel):
    reply: str


class ChatHistoryItem(BaseModel):
    role: str
    content: str

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
    event_id: Optional[uuid.UUID] = None  # None para doses futuras (sem evento criado ainda)
    schedule_id: uuid.UUID
    scheduled_time: datetime
    confirmed_at: Optional[datetime]
    status: str                   # pending | dispensed | confirmed | missed
    medication_name: str          # ex: "Losartana"
    medication_dosage: str        # ex: "50mg"
    medication_instructions: Optional[str]

    class Config:
        from_attributes = True

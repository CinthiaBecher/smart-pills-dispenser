import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Time, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from backend.database import Base
# Enum do Python para garantir que status só aceite valores válidos
from sqlalchemy import Enum as SAEnum


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(20), nullable=False, default="patient")  # 'patient' ou 'caregiver'
    notification_timeout_minutes = Column(Integer, default=30)
    created_at = Column(DateTime, server_default=func.now())


class Medication(Base):
    __tablename__ = "medications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)  # paciente dono do medicamento
    name = Column(String(255), nullable=False)       # ex: "Losartana Potássica"
    dosage = Column(String(100), nullable=False)     # ex: "50mg"
    route = Column(String(50), default="oral")       # via de administração
    instructions = Column(Text)                      # ex: "tomar em jejum"
    restrictions = Column(Text)                      # ex: "não combinar com anti-inflamatórios"
    compartment = Column(Integer)                    # compartimento no dispenser (1-6)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("medications.id"), nullable=False)
    time = Column(Time, nullable=False)                              # horário da dose (ex: 08:00)
    days_of_week = Column(ARRAY(Integer), default=[0,1,2,3,4,5,6]) # 0=dom, 1=seg, ..., 6=sab
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class DispensationEvent(Base):
    __tablename__ = "dispensation_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Qual agendamento gerou esse evento
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("schedules.id"), nullable=False)

    # Data+hora em que a dose estava programada (ex: 2026-04-11 08:00:00)
    # Combina a data de hoje com o horário do schedule
    scheduled_time = Column(DateTime, nullable=False)

    # Quando o dispenser físico liberou a cápsula (preenchido pelo ESP32 via MQTT)
    dispensed_at = Column(DateTime, nullable=True)

    # Quando o paciente tocou "Confirmar retirada" no app
    confirmed_at = Column(DateTime, nullable=True)

    # Status da dose:
    # pending   = ainda não chegou a hora ou chegou mas não foi confirmada
    # dispensed = o dispenser liberou, aguardando confirmação do paciente
    # confirmed = paciente confirmou que tomou
    # missed    = passou do timeout sem confirmação
    status = Column(
        SAEnum("pending", "dispensed", "confirmed", "missed", name="dispensation_status"),
        nullable=False,
        default="pending"
    )

    created_at = Column(DateTime, server_default=func.now())


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' ou 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

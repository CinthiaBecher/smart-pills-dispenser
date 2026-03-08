import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(20), nullable=False, default="patient")  # 'patient' ou 'caregiver'
    notification_timeout_minutes = Column(Integer, default=30)
    created_at = Column(DateTime, server_default=func.now())

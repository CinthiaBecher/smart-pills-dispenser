from pydantic import BaseModel, EmailStr
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

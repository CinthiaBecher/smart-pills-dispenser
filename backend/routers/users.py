from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend.schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["Usuários"])


# Criar usuário
@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Verifica se já existe usuário com esse email
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    new_user = User(**user.model_dump())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


# Listar todos os usuários
@router.get("/", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()


# Buscar usuário por email — usado pelo Login para autenticar
# IMPORTANTE: essa rota vem ANTES de /{user_id} para não ser confundida com um ID
@router.get("/by-email/{email}", response_model=UserResponse)
def get_user_by_email(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


# Buscar usuário por ID
@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


# Atualizar dados do usuário (nome, timeout de notificação)
@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if data.name is not None:
        user.name = data.name
    if data.notification_timeout_minutes is not None:
        user.notification_timeout_minutes = data.notification_timeout_minutes

    db.commit()
    db.refresh(user)
    return user

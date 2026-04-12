from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, PatientCaregiver
from backend.schemas import UserCreate, UserResponse, UserUpdate, UserRegister

router = APIRouter(prefix="/api/users", tags=["Usuários"])


# Cadastro de novo usuário (tela de registro do app)
# Vem ANTES de "/" para não conflitar com o POST genérico
@router.post("/register", response_model=UserResponse)
def register_user(body: UserRegister, db: Session = Depends(get_db)):
    # 1. Verifica se o email já está em uso
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")

    # 2. Valida o role
    if body.role not in ("patient", "caregiver"):
        raise HTTPException(status_code=400, detail="Role inválido. Use 'patient' ou 'caregiver'")

    # 3. Se for cuidador, verifica se o paciente existe antes de criar qualquer coisa
    paciente = None
    if body.role == "caregiver":
        if not body.patient_email:
            raise HTTPException(status_code=400, detail="Informe o e-mail do paciente que você cuida")
        paciente = db.query(User).filter(User.email == body.patient_email).first()
        if not paciente:
            raise HTTPException(status_code=404, detail="Paciente não encontrado com esse e-mail")

    # 4. Cria o usuário
    novo_usuario = User(name=body.name, email=body.email, role=body.role)
    db.add(novo_usuario)
    db.flush()  # envia ao banco para gerar o ID, mas ainda não confirma

    # 5. Se for cuidador, cria o vínculo automaticamente
    if body.role == "caregiver" and paciente:
        vinculo = PatientCaregiver(
            patient_id=paciente.id,
            caregiver_id=novo_usuario.id
        )
        db.add(vinculo)

    db.commit()
    db.refresh(novo_usuario)
    return novo_usuario


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

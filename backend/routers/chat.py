import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from dotenv import load_dotenv
from backend.database import get_db
from backend.models import ChatHistory, Medication, Schedule, User
from backend.schemas import ChatMessage, ChatResponse

load_dotenv()

router = APIRouter(prefix="/api/chat", tags=["Chat"])

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """Você é um assistente farmacêutico virtual do sistema Smart Pills Dispenser.

Seu papel é ajudar o paciente a entender seus medicamentos, horários de uso, possíveis interações e cuidados gerais.

Regras que você DEVE seguir:
- Responda sempre em português, de forma clara e acolhedora.
- Nunca substitua a orientação de um médico ou farmacêutico presencial.
- Não faça diagnósticos nem sugira troca ou suspensão de medicamentos sem orientação médica.
- Se o paciente relatar sintomas graves ou emergências, oriente-o a buscar atendimento médico imediatamente.
- Use apenas as informações do contexto do paciente fornecido para personalizar as respostas.
- Seja objetivo e evite informações excessivas que possam confundir o paciente.

Você tem acesso ao perfil atual do paciente com seus medicamentos e horários cadastrados no sistema."""


def build_patient_context(user_id: str, db: Session) -> str:
    """Monta um resumo dos medicamentos e horários do paciente para incluir no contexto."""
    medications = (
        db.query(Medication)
        .filter(Medication.user_id == user_id, Medication.active == True)
        .all()
    )

    if not medications:
        return "O paciente não possui medicamentos cadastrados no momento."

    lines = ["Medicamentos ativos do paciente:"]
    for med in medications:
        schedules = (
            db.query(Schedule)
            .filter(Schedule.medication_id == med.id, Schedule.active == True)
            .all()
        )
        horarios = ", ".join(str(s.time) for s in schedules) if schedules else "sem horário cadastrado"

        line = f"- {med.name} {med.dosage} ({med.route})"
        if med.instructions:
            line += f" | Instruções: {med.instructions}"
        if med.restrictions:
            line += f" | Restrições: {med.restrictions}"
        line += f" | Horários: {horarios}"
        lines.append(line)

    return "\n".join(lines)


@router.post("/", response_model=ChatResponse)
def chat(body: ChatMessage, db: Session = Depends(get_db)):
    # Verifica se o usuário existe
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Busca histórico da conversa (últimas 20 mensagens para não exceder tokens)
    history = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == body.user_id)
        .order_by(ChatHistory.created_at.desc())
        .limit(20)
        .all()
    )
    history.reverse()  # ordem cronológica

    # Monta o contexto do paciente
    patient_context = build_patient_context(body.user_id, db)

    # Monta o histórico no formato que o Gemini espera
    # O system prompt + contexto do paciente vai como primeira mensagem do sistema
    full_system = f"{SYSTEM_PROMPT}\n\n{patient_context}"

    messages = []
    for msg in history:
        role = "user" if msg.role == "user" else "model"
        messages.append(types.Content(role=role, parts=[types.Part(text=msg.content)]))

    # Adiciona a nova mensagem do usuário
    messages.append(types.Content(role="user", parts=[types.Part(text=body.message)]))

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=messages,
            config=types.GenerateContentConfig(
                system_instruction=full_system,
            ),
        )
        reply = response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao chamar Gemini: {str(e)}")

    # Salva mensagem do usuário e resposta do assistente no banco
    db.add(ChatHistory(user_id=body.user_id, role="user", content=body.message))
    db.add(ChatHistory(user_id=body.user_id, role="assistant", content=reply))
    db.commit()

    return ChatResponse(reply=reply)

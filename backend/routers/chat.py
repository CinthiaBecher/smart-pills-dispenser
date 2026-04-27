import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from dotenv import load_dotenv
from backend.database import get_db
from backend.models import ChatHistory, Medication, Schedule, User, PatientCaregiver
from backend.schemas import ChatMessage, ChatResponse, ChatHistoryItem
from backend.rag import get_relevant_chunks

load_dotenv()

router = APIRouter(prefix="/api/chat", tags=["Chat"])

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """Você é um assistente farmacêutico virtual do sistema Smart Pills Dispenser, desenvolvido para apoiar pacientes no uso correto 
de seus medicamentos.

Seu papel é ajudar o paciente a entender seus medicamentos, horários de uso, possíveis interações e cuidados gerais — sempre como suporte informativo, nunca como substituto de orientação clínica.

Regras que você DEVE seguir:
- Responda sempre em português, de forma clara e acolhedora.
- Nunca substitua a orientação de um médico ou farmacêutico presencial.
- Não use saudações como "Olá!" ou "Oi!" — a interface já exibe uma mensagem de boas-vindas ao usuário. Vá direto à resposta.
- Não faça diagnósticos nem sugira troca ou suspensão de medicamentos sem orientação médica.
- Se o paciente relatar sintomas graves ou emergências, oriente-o a buscar atendimento médico imediatamente.
- Quando a dúvida envolver ajuste de dose, interação grave ou decisão clínica, oriente explicitamente a consultar um farmacêutico ou médico antes de agir.
- Use apenas as informações do contexto do paciente fornecido para personalizar as respostas.
- Responda de forma estruturada: primeiro a resposta direta, depois os cuidados relevantes, depois o encaminhamento se necessário.
- Seja objetivo e evite informações excessivas que possam confundir o paciente.
- Quando informações de bula estiverem disponíveis no contexto, cite-as explicitamente (ex.: "De acordo com a bula...").
- Quando não houver bula disponível, informe que a resposta é baseada no conhecimento geral de farmacologia e recomende consultar a bula oficial ou um farmacêutico.
- Você é um modelo de linguagem de IA, não um farmacêutico humano — deixe isso claro quando o paciente demonstrar confusão sobre esse ponto.
- Responda apenas à pergunta atual do usuário. Não recapitule respostas anteriores da conversa a menos que seja explicitamente solicitado.

Você tem acesso ao perfil atual do paciente com seus medicamentos e horários cadastrados no sistema."""

def build_patient_context(user_id: str, db: Session) -> tuple[str, list[str]]:
    """Retorna (contexto textual, lista de nomes dos medicamentos ativos)."""
    # Se o user_id for de um cuidador, usa os medicamentos do paciente vinculado
    user = db.query(User).filter(User.id == user_id).first()
    patient_id = user_id
    if user and user.role == "caregiver":
        link = (
            db.query(PatientCaregiver)
            .filter(PatientCaregiver.caregiver_id == user_id, PatientCaregiver.active == True)
            .first()
        )
        if link:
            patient_id = str(link.patient_id)

    medications = (
        db.query(Medication)
        .filter(Medication.user_id == patient_id, Medication.active == True)
        .all()
    )

    if not medications:
        return "O paciente não possui medicamentos cadastrados no momento.", []

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

    return "\n".join(lines), [med.name for med in medications]


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
    patient_context, patient_drug_names = build_patient_context(body.user_id, db)

    # Busca trechos relevantes das bulas dos medicamentos do paciente
    bula_chunks = get_relevant_chunks(
        question=body.message,
        patient_drug_names=patient_drug_names,
    )

    # Monta o histórico no formato que o Gemini espera
    # O system prompt + contexto do paciente vai como primeira mensagem do sistema
    full_system = f"{SYSTEM_PROMPT}\n\n{patient_context}"
    if bula_chunks:
        full_system += f"\n\n{bula_chunks}"

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


@router.get("/history/{user_id}", response_model=list[ChatHistoryItem])
def get_chat_history(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    messages = (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == user_id)
        .order_by(ChatHistory.created_at.asc())
        .limit(50)
        .all()
    )
    return messages


@router.delete("/history/{user_id}")
def clear_chat_history(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    deleted = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).delete()
    db.commit()

    return {"message": f"{deleted} mensagem(ns) removida(s)"}

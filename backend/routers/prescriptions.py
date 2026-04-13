import os
import json
import re
import io
from datetime import time
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from dotenv import load_dotenv
from PIL import Image
from backend.database import get_db
from backend.models import Medication, Schedule, User
from backend.schemas import PrescriptionConfirmRequest

load_dotenv()

router = APIRouter(prefix="/api/prescriptions", tags=["Prescrições"])

# Inicializa o cliente Gemini com a chave da API
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

PRESCRIPTION_PROMPT = """
Analise esta receita médica e extraia todas as informações presentes.
Retorne SOMENTE um JSON válido, sem texto adicional, no seguinte formato:

{
  "patient_name": "nome completo do paciente conforme consta na receita, ou null se não encontrado",
  "prescription_date": "data da receita no formato YYYY-MM-DD, ou null se não encontrada",
  "doctor_name": "nome completo do médico prescritor, ou null se não encontrado",
  "doctor_crm": "número do CRM com estado (ex: CRM/SP 12345), ou null se não encontrado",
  "medications": [
    {
      "name": "nome do medicamento",
      "dosage": "dosagem (ex: 50mg)",
      "route": "via de administração (ex: oral)",
      "instructions": "instruções de uso (ex: tomar em jejum)",
      "frequency": "frequência (ex: 1x ao dia, a cada 8 horas)",
      "duration_days": número inteiro de dias de tratamento ou null se uso contínuo/crônico,
      "description": "indicação terapêutica resumida em português (ex: Anti-hipertensivo, Controle glicêmico, Antibiótico)"
    }
  ]
}

Para duration_days: se a receita mencionar "por X dias", "durante X dias", "por X semanas" (converta para dias),
"uso contínuo", "uso crônico" ou não mencionar prazo → use null.
Exemplos: "tomar por 7 dias" → 7, "por 2 semanas" → 14, "uso contínuo" → null.

Se não conseguir identificar algum campo, use null.
Se não houver medicamentos visíveis, retorne {"medications": []}.
"""


@router.post("/interpret")
async def interpret_prescription(file: UploadFile = File(...)):
    # Valida se é uma imagem
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="O arquivo deve ser uma imagem")

    # Lê o conteúdo da imagem
    image_bytes = await file.read()

    # Redimensiona a imagem para no máximo 1600px de largura (economiza tokens)
    image = Image.open(io.BytesIO(image_bytes))
    if image.width > 1600:
        ratio = 1600 / image.width
        new_size = (1600, int(image.height * ratio))
        image = image.resize(new_size, Image.LANCZOS)

    # Converte para RGB (necessário para salvar como JPEG — PNG pode ter transparência/RGBA)
    if image.mode != "RGB":
        image = image.convert("RGB")

    # Converte de volta para bytes
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    image_bytes = buffer.getvalue()

    try:
        # Envia a imagem + prompt para o Gemini
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                PRESCRIPTION_PROMPT
            ]
        )

        # Pega o texto retornado pelo Gemini
        raw_text = response.text

        # Remove marcadores de código markdown se existirem (ex: ```json ... ```)
        cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw_text).strip()

        # Converte o texto JSON para dicionário Python
        result = json.loads(cleaned)
        return result

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Gemini retornou resposta em formato inválido")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar imagem: {str(e)}")


def frequency_to_times(frequency: str) -> list[time]:
    """
    Converte uma string de frequência em uma lista de horários.
    Usa horários convencionais adequados para um dispensador automático.
    Se não reconhecer o padrão, usa 08:00 como padrão seguro.
    """
    if not frequency:
        return [time(8, 0)]

    f = frequency.lower().strip()

    # Padrões "Nx ao dia"
    if "4x" in f or "4 x" in f or "a cada 6" in f:
        return [time(8, 0), time(12, 0), time(18, 0), time(22, 0)]
    if "3x" in f or "3 x" in f or "a cada 8" in f:
        return [time(8, 0), time(14, 0), time(20, 0)]
    if "2x" in f or "2 x" in f or "a cada 12" in f:
        return [time(8, 0), time(20, 0)]

    # Padrões por período do dia
    if "manhã" in f and "noite" in f:
        return [time(8, 0), time(20, 0)]
    if "manhã" in f and "tarde" in f:
        return [time(8, 0), time(14, 0)]
    if "noite" in f or "dormir" in f or "deitar" in f:
        return [time(22, 0)]
    if "manhã" in f or "jejum" in f:
        return [time(8, 0)]
    if "tarde" in f or "almoço" in f:
        return [time(12, 0)]

    # Padrão "1x ao dia" ou qualquer menção a "dia"
    if "1x" in f or "1 x" in f or "uma vez" in f or "diário" in f or "diária" in f:
        return [time(8, 0)]

    # Padrão "a cada 24 horas"
    if "24" in f:
        return [time(8, 0)]

    # Padrão não reconhecido — padrão seguro
    return [time(8, 0)]


@router.post("/confirm")
def confirm_prescription(body: PrescriptionConfirmRequest, db: Session = Depends(get_db)):
    # Verifica se o usuário existe
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    created_medications = []

    for med_data in body.medications:
        # Cria o medicamento vinculado ao usuário
        medication = Medication(
            user_id=body.user_id,
            name=med_data.name,
            dosage=med_data.dosage,
            route=med_data.route,
            instructions=med_data.instructions,
            duration_days=med_data.duration_days,  # None = uso contínuo
        )
        db.add(medication)
        db.flush()  # flush envia ao banco mas não confirma — necessário para obter o medication.id antes do commit

        # Converte a frequência em horários e cria os agendamentos
        times = frequency_to_times(med_data.frequency)
        schedules_created = []
        for t in times:
            schedule = Schedule(medication_id=medication.id, time=t)
            db.add(schedule)
            schedules_created.append(str(t))

        created_medications.append({
            "medication": med_data.name,
            "dosage": med_data.dosage,
            "schedules": schedules_created,
            "frequency_original": med_data.frequency,
        })

    db.commit()

    return {
        "message": f"{len(created_medications)} medicamento(s) cadastrado(s) com sucesso",
        "created": created_medications,
    }

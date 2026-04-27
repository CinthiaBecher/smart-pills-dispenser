import os
import json
import re
import io
from datetime import time, date
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from google import genai
from google.genai import types
from dotenv import load_dotenv
from PIL import Image
from backend.database import get_db
from backend.models import Medication, Schedule, User, Prescription
from backend.schemas import PrescriptionConfirmRequest, PrescriptionListItem, PrescriptionDetail

load_dotenv()

router = APIRouter(prefix="/api/prescriptions", tags=["Prescrições"])

# Inicializa o cliente Gemini com a chave da API
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def normalize_frequency(text: str) -> str:
    """Expande apenas abreviações tipográficas não-ambíguas.
    Notações de intervalo ("8/8h", "a cada 8 horas") são mantidas intactas.
    """
    if not text:
        return text
    f = text.strip()
    fl = f.lower()
    if re.match(r"^4\s*x\s*/\s*d(ia)?$", fl):
        return "4x ao dia"
    if re.match(r"^3\s*x\s*/\s*d(ia)?$", fl):
        return "3x ao dia"
    if re.match(r"^2\s*x\s*/\s*d(ia)?$", fl):
        return "2x ao dia"
    if re.match(r"^1\s*x\s*/\s*d(ia)?$", fl):
        return "1x ao dia"
    if re.match(r"^s\.?o\.?s\.?$", fl) or any(x in fl for x in ["se necessár", "se necessar", "em caso de", "s/n"]):
        return "SOS"
    return f


def normalize_route(text: str) -> str:
    """Normaliza variações de via de administração para forma canônica."""
    if not text:
        return text
    f = text.lower().strip()
    if any(x in f for x in ["oral", "vo", "via oral"]):
        return "oral"
    if any(x in f for x in ["sublingual", "sl"]):
        return "sublingual"
    if any(x in f for x in ["tópico", "topico", "cutâneo", "cutaneo"]):
        return "tópico"
    if any(x in f for x in ["inalat", "inal"]):
        return "inalatória"
    if any(x in f for x in ["intravenoso", "iv", "endovenoso", "ev"]):
        return "intravenoso"
    if any(x in f for x in ["intramuscular", "im"]):
        return "intramuscular"
    return text


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
      "instructions": "condições e contexto de uso — inclui horário do dia, relação com alimentação e outras orientações (ex: 'tomar à noite', 'tomar em jejum 30min antes do café', 'após as refeições', 'tomar com água', 'completar os 7 dias mesmo se melhorar'). Se não houver instruções específicas, use null.",
      "frequency": "frequência de administração — APENAS a contagem ou intervalo de tempo (ex: '1x ao dia', '2x ao dia', '8/8h', '12/12h', 'SOS', 'dose única'). NÃO inclua horário do dia nem condições de uso aqui.",
      "duration_days": número inteiro de dias de tratamento ou null se uso contínuo/crônico
    }
  ]
}

Para duration_days: se a receita mencionar "por X dias", "durante X dias", "por X semanas" (converta para dias),
"uso contínuo", "uso crônico" ou não mencionar prazo → use null.
Exemplos: "tomar por 7 dias" → 7, "por 2 semanas" → 14, "uso contínuo" → null.

Exemplos de separação frequency/instructions:
- Receita diz "1x ao dia à noite" → frequency: "1x ao dia", instructions: "tomar à noite"
- Receita diz "8/8h após refeições" → frequency: "8/8h", instructions: "após as refeições"
- Receita diz "12/12h" → frequency: "12/12h", instructions: null
- Receita diz "SOS em caso de dor" → frequency: "SOS", instructions: "em caso de dor"

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
        for med in result.get("medications", []):
            if med.get("frequency"):
                med["frequency"] = normalize_frequency(med["frequency"])
            if med.get("route"):
                med["route"] = normalize_route(med["route"])
        return result

    except json.JSONDecodeError:
        print(f"[prescriptions] JSONDecodeError — resposta bruta do Gemini:\n{raw_text}")
        raise HTTPException(status_code=500, detail="Gemini retornou resposta em formato inválido")
    except Exception as e:
        print(f"[prescriptions] Erro inesperado: {type(e).__name__}: {e}")
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
        medication = Medication(
            user_id=body.user_id,
            name=med_data.name,
            dosage=med_data.dosage,
            route=med_data.route,
            instructions=med_data.instructions,
            duration_days=med_data.duration_days,
        )
        db.add(medication)
        db.flush()

        times = frequency_to_times(med_data.frequency)
        schedules_created = []
        for t in times:
            schedule = Schedule(medication_id=medication.id, time=t)
            db.add(schedule)
            schedules_created.append(str(t))

        created_medications.append({
            "medication": med_data.name,
            "dosage": med_data.dosage,
            "description": med_data.description,
            "schedules": schedules_created,
            "frequency_original": med_data.frequency,
        })

    # Salva o registro da receita escaneada para o histórico
    prescription_date = None
    if body.prescription_date:
        try:
            prescription_date = date.fromisoformat(body.prescription_date)
        except ValueError:
            pass  # data inválida — salva sem ela

    prescription_record = Prescription(
        user_id=body.user_id,
        patient_name=body.patient_name,
        prescription_date=prescription_date,
        doctor_name=body.doctor_name,
        doctor_crm=body.doctor_crm,
        image_base64=body.image_base64,
        medications_json=json.dumps(created_medications, ensure_ascii=False),
    )
    db.add(prescription_record)

    db.commit()

    return {
        "message": f"{len(created_medications)} medicamento(s) cadastrado(s) com sucesso",
        "created": created_medications,
    }


@router.get("/user/{user_id}", response_model=List[PrescriptionListItem])
def list_prescriptions(user_id: str, db: Session = Depends(get_db)):
    """Lista todas as receitas escaneadas de um paciente, da mais recente para a mais antiga."""
    prescriptions = (
        db.query(Prescription)
        .filter(Prescription.user_id == user_id)
        .order_by(Prescription.scanned_at.desc())
        .all()
    )
    return prescriptions


@router.get("/{prescription_id}", response_model=PrescriptionDetail)
def get_prescription(prescription_id: str, db: Session = Depends(get_db)):
    """Retorna o detalhe de uma receita escaneada, incluindo a imagem."""
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    return prescription

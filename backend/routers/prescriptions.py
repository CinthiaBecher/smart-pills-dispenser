import os
import json
import re
import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from google import genai
from google.genai import types
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

router = APIRouter(prefix="/api/prescriptions", tags=["Prescrições"])

# Inicializa o cliente Gemini com a chave da API
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Campos que serão removidos da imagem antes de enviar ao Gemini
# Instrução de anonimização incluída no prompt — não enviamos dados pessoais
ANONYMIZATION_INSTRUCTION = """
Ignore completamente qualquer informação pessoal presente na imagem, como:
- Nome do paciente
- Nome do médico
- CRM do médico
- Endereço
- CPF ou RG
- Data de nascimento

Foque APENAS nas informações dos medicamentos.
"""

PRESCRIPTION_PROMPT = f"""
{ANONYMIZATION_INSTRUCTION}

Analise esta receita médica e extraia os medicamentos prescritos.
Retorne SOMENTE um JSON válido, sem texto adicional, no seguinte formato:

{{
  "medications": [
    {{
      "name": "nome do medicamento",
      "dosage": "dosagem (ex: 50mg)",
      "route": "via de administração (ex: oral)",
      "instructions": "instruções de uso (ex: tomar em jejum)",
      "frequency": "frequência (ex: 1x ao dia, a cada 8 horas)"
    }}
  ]
}}

Se não conseguir identificar algum campo, use null.
Se não houver medicamentos visíveis, retorne {{"medications": []}}.
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

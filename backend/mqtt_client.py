"""
Serviço MQTT do backend.

Responsabilidades:
- publish_dispense(): o backend envia comando para o ESP32 dispensar
- _on_message(): quando o ESP32 confirma que dispensou, atualiza o banco
"""

import json
import logging
from datetime import datetime

import paho.mqtt.client as mqtt

from backend.database import SessionLocal
from backend.models import DispensationEvent, Medication, Schedule

BROKER      = "broker.hivemq.com"
PORT        = 1883
TOPIC_PUB   = "smartpills/dispense"    # backend → ESP32
TOPIC_SUB   = "smartpills/dispensed"   # ESP32 → backend

logger = logging.getLogger(__name__)

_client: mqtt.Client | None = None


def _on_connect(client, userdata, flags, rc):
    if rc == 0:
        client.subscribe(TOPIC_SUB)
        logger.info("MQTT conectado e inscrito em %s", TOPIC_SUB)
    else:
        logger.error("Falha ao conectar MQTT (rc=%s)", rc)


def _on_message(client, userdata, msg):
    """
    ESP32 publica em smartpills/dispensed quando o paciente pressiona o botão.
    Payload esperado: {"event_id": "<uuid>", "schedule_id": "<uuid>"}
    """
    try:
        payload = json.loads(msg.payload.decode())
    except Exception:
        logger.warning("Payload MQTT inválido: %s", msg.payload)
        return

    event_id = payload.get("event_id")
    if not event_id:
        logger.warning("Payload sem event_id: %s", payload)
        return

    db = SessionLocal()
    try:
        evento = db.query(DispensationEvent).filter(
            DispensationEvent.id == event_id
        ).first()

        if not evento:
            logger.warning("Evento não encontrado: %s", event_id)
            return

        evento.status        = "confirmed"
        evento.confirmed_at  = datetime.now()
        db.commit()
        logger.info("Evento %s confirmado via ESP32", event_id)

        # Descobre o patient_id para notificar os cuidadores
        schedule = db.query(Schedule).filter(Schedule.id == evento.schedule_id).first()
        med = db.query(Medication).filter(
            Medication.id == schedule.medication_id
        ).first() if schedule else None

        if med:
            from backend.scheduler import notify_dose_taken
            notify_dose_taken(event_id=event_id, patient_id=str(med.user_id))

    except Exception as e:
        logger.error("Erro ao atualizar evento: %s", e)
        db.rollback()
    finally:
        db.close()


def init_mqtt():
    """Inicia o cliente MQTT em background. Chamado no startup do FastAPI."""
    global _client
    _client = mqtt.Client(client_id="smartpills-backend", clean_session=True)
    _client.on_connect = _on_connect
    _client.on_message = _on_message

    try:
        _client.connect(BROKER, PORT, keepalive=60)
        _client.loop_start()
        logger.info("MQTT loop iniciado")
    except Exception as e:
        logger.error("Não foi possível conectar ao broker MQTT: %s", e)


def publish_dispense(event_id: str, schedule_id: str, medication_name: str, medication_dosage: str) -> bool:
    """
    Publica em smartpills/dispense para acionar o ESP32.
    Retorna True se o publish foi enfileirado com sucesso, False caso contrário.
    """
    if _client is None:
        logger.error("MQTT não iniciado — chame init_mqtt() primeiro")
        return False

    if not _client.is_connected():
        logger.warning("MQTT desconectado, tentando reconectar...")
        try:
            _client.reconnect()
        except Exception as e:
            logger.error("Falha ao reconectar MQTT: %s", e)
            return False

    payload = json.dumps({
        "event_id":          event_id,
        "schedule_id":       schedule_id,
        "medication_name":   medication_name,
        "medication_dosage": medication_dosage,
    })
    result = _client.publish(TOPIC_PUB, payload, qos=1)
    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        logger.error("Falha ao publicar MQTT (rc=%s)", result.rc)
        return False

    result.wait_for_publish(timeout=5)
    if not result.is_published():
        logger.error("Timeout: broker MQTT não confirmou o recebimento em 5s")
        return False

    logger.info("Publicado dispense → %s", payload)
    return True

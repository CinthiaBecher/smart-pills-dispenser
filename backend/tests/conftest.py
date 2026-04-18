"""
conftest.py — Configuração central dos testes do Dose Certa
============================================================
Este arquivo é carregado automaticamente pelo pytest antes de qualquer teste.
Aqui definimos:
  - O cliente HTTP que chama os endpoints reais
  - Fixtures que criam e limpam dados no Supabase real
  - Helpers de geração de emails de teste únicos

CONVENÇÃO DE LIMPEZA:
  Todos os dados de teste usam emails no padrão test_<uuid>@dosecerta.com
  O teardown apaga os registros seguindo a ordem das foreign keys:
    dispensation_events → schedules → medications
    → patient_caregivers → chat_history → prescriptions → users
"""

import uuid
import pytest
from httpx import Client
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

# Carrega as variáveis do .env (DATABASE_URL, etc.)
load_dotenv()

# ── Cliente HTTP ─────────────────────────────────────────────
# O httpx.Client chama o servidor FastAPI que está rodando localmente.
# Todos os testes usam este cliente — é como um "usuário" fazendo requisições.
BASE_URL = "http://localhost:8000"

@pytest.fixture(scope="session")
def client():
    """Cliente HTTP reutilizado em toda a sessão de testes."""
    with Client(base_url=BASE_URL, timeout=30.0) as c:
        yield c


# ── Conexão direta com o banco (para limpeza) ────────────────
# Usamos SQLAlchemy diretamente para apagar dados de teste sem passar pela API.
# Isso é necessário porque a API não expõe endpoints de DELETE para usuários.
engine = create_engine(os.getenv("DATABASE_URL"))
TestSession = sessionmaker(bind=engine)

@pytest.fixture
def db():
    """Sessão de banco aberta para uso em fixtures de limpeza."""
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


# ── Helper: gerar email de teste único ───────────────────────
# ATENÇÃO: não colocar prefixo "test_" nesta função — o pytest coletaria como teste
def make_test_email():
    """Gera um email único para cada teste. Ex: test_a3f2b1@dosecerta.com"""
    return f"test_{uuid.uuid4().hex[:8]}@dosecerta.com"


# ── Helper: limpar usuário e todos os dados dependentes ──────
def cleanup_user(db_session, user_id: str):
    """
    Apaga todos os dados de um usuário na ordem correta de foreign keys.
    Ordem: eventos → agendamentos → medicamentos
           → vínculos cuidador → chat → prescrições → usuário
    """
    uid = str(user_id)
    # Busca todos os agendamentos do usuário (para apagar eventos deles)
    schedules = db_session.execute(
        text("""
            SELECT s.id FROM schedules s
            JOIN medications m ON m.id = s.medication_id
            WHERE m.user_id = :uid
        """),
        {"uid": uid}
    ).fetchall()

    schedule_ids = [str(r[0]) for r in schedules]

    if schedule_ids:
        # Apaga eventos de dispensação vinculados aos agendamentos
        # Nota: cast ::text necessário porque schedule_id é UUID e ids são strings
        db_session.execute(
            text("DELETE FROM dispensation_events WHERE schedule_id::text = ANY(:ids)"),
            {"ids": schedule_ids}
        )
        # Apaga os agendamentos
        db_session.execute(
            text("DELETE FROM schedules WHERE id::text = ANY(:ids)"),
            {"ids": schedule_ids}
        )

    # Apaga medicamentos
    db_session.execute(
        text("DELETE FROM medications WHERE user_id = :uid"), {"uid": uid}
    )
    # Apaga vínculos de cuidador (tanto como paciente quanto como cuidador)
    db_session.execute(
        text("DELETE FROM patient_caregivers WHERE patient_id = :uid OR caregiver_id = :uid"),
        {"uid": uid}
    )
    # Apaga histórico de chat
    db_session.execute(
        text("DELETE FROM chat_history WHERE user_id = :uid"), {"uid": uid}
    )
    # Apaga prescrições escaneadas
    db_session.execute(
        text("DELETE FROM prescriptions WHERE user_id = :uid"), {"uid": uid}
    )
    # Por último, apaga o usuário
    db_session.execute(
        text("DELETE FROM users WHERE id = :uid"), {"uid": uid}
    )
    db_session.commit()


# ── Fixture: paciente de teste ───────────────────────────────
@pytest.fixture
def test_patient(client, db):
    """
    Cria um paciente de teste via API e apaga tudo no teardown.
    Uso: def test_algo(test_patient): ...
         test_patient["id"], test_patient["email"]
    """
    email = make_test_email()
    res = client.post("/api/users/register", json={
        "name": "Paciente Teste Auto",
        "email": email,
        "role": "patient",
    })
    assert res.status_code == 200, f"Falha ao criar paciente de teste: {res.text}"
    user = res.json()

    yield user  # aqui o teste roda

    # Teardown: limpa tudo do paciente
    cleanup_user(db, user["id"])


# ── Fixture: cuidador de teste ───────────────────────────────
@pytest.fixture
def test_caregiver(client, db, test_patient):
    """
    Cria um cuidador de teste vinculado ao test_patient.
    Depende de test_patient — o pytest cria o paciente primeiro automaticamente.
    """
    email = make_test_email()
    res = client.post("/api/users/register", json={
        "name": "Cuidador Teste Auto",
        "email": email,
        "role": "caregiver",
        "patient_email": test_patient["email"],
    })
    assert res.status_code == 200, f"Falha ao criar cuidador de teste: {res.text}"
    user = res.json()

    yield user

    # Limpa o cuidador (o paciente é limpo pela fixture test_patient)
    cleanup_user(db, user["id"])


# ── Fixture: medicamento de teste ────────────────────────────
@pytest.fixture
def test_medication(client, db, test_patient):
    """Cria um medicamento vinculado ao test_patient."""
    res = client.post("/api/medications/", json={
        "user_id": test_patient["id"],
        "name": "Medicamento Teste Auto",
        "dosage": "10mg",
        "route": "oral",
        "instructions": "Tomar com água",
    })
    assert res.status_code == 200, f"Falha ao criar medicamento de teste: {res.text}"
    med = res.json()

    yield med

    # O medicamento é apagado via cleanup_user quando test_patient fizer teardown


# ── Fixture: agendamento de teste ────────────────────────────
@pytest.fixture
def test_schedule(client, db, test_medication):
    """Cria um agendamento para o medicamento de teste."""
    res = client.post("/api/schedules/", json={
        "medication_id": test_medication["id"],
        "time": "08:00",
        "days_of_week": [0, 1, 2, 3, 4, 5, 6],
    })
    assert res.status_code == 200, f"Falha ao criar agendamento de teste: {res.text}"
    schedule = res.json()

    yield schedule

    # Apagado via cleanup_user no teardown do test_patient


# ── Fixture: email único por teste ───────────────────────────
@pytest.fixture
def fresh_email():
    """
    Fornece um email único para o teste atual.
    Uso: def test_algo(fresh_email): email = fresh_email
    """
    return make_test_email()


# ── Fixture: função de limpeza manual ────────────────────────
@pytest.fixture
def cleanup(db):
    """
    Fornece a função cleanup_user já com a sessão de banco pronta.
    Para testes que criam usuários sem usar test_patient.
    Uso: def test_algo(client, cleanup): ... cleanup(user_id)
    """
    def _cleanup(user_id):
        cleanup_user(db, user_id)
    return _cleanup


# ── Marks personalizados ─────────────────────────────────────
# Uso: @pytest.mark.slow — marca testes que chamam APIs externas (Gemini)
# Para pular: pytest backend/tests/ -v -m "not slow"
def pytest_configure(config):
    config.addinivalue_line("markers", "slow: testes que chamam APIs externas (Gemini)")

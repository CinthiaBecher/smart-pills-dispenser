"""
test_auth.py — Testes do Fluxo 1: Cadastro e Login
====================================================
Todas as fixtures (client, db, cleanup, fresh_email, test_patient)
vêm do conftest.py — o pytest injeta automaticamente, sem imports.

Para rodar:
    pytest backend/tests/test_auth.py -v
"""

import uuid


# ─────────────────────────────────────────────────────────────
# BLOCO 1 — CADASTRO
# ─────────────────────────────────────────────────────────────

def test_register_patient_success(client, fresh_email, cleanup):
    """
    Cenário feliz: criar um paciente novo.
    Espera: status 200, role='patient', email e nome corretos.
    """
    res = client.post("/api/users/register", json={
        "name": "Paciente Teste Auto",
        "email": fresh_email,
        "role": "patient",
    })

    user = res.json()
    try:
        assert res.status_code == 200, f"Esperava 200, recebi {res.status_code}: {res.text}"
        assert user["role"] == "patient"
        assert user["email"] == fresh_email
        assert user["name"] == "Paciente Teste Auto"
        assert "id" in user
    finally:
        if "id" in user:
            cleanup(user["id"])


def test_register_caregiver_with_patient_link(client, fresh_email, cleanup, test_patient):
    """
    Cria um cuidador vinculado a um paciente existente.
    Espera: status 200 e vínculo visível em GET /api/caregivers/{patient_id}
    """
    res = client.post("/api/users/register", json={
        "name": "Cuidador Teste Auto",
        "email": fresh_email,
        "role": "caregiver",
        "patient_email": test_patient["email"],
    })

    caregiver = res.json()
    try:
        assert res.status_code == 200, f"Esperava 200, recebi {res.status_code}: {res.text}"
        assert caregiver["role"] == "caregiver"

        # Verifica que o vínculo foi criado: paciente deve enxergar o cuidador
        res_link = client.get(f"/api/caregivers/{test_patient['id']}")
        assert res_link.status_code == 200
        ids = [c["caregiver_id"] for c in res_link.json()]
        assert caregiver["id"] in ids, f"Cuidador {caregiver['id']} não aparece na lista: {ids}"
    finally:
        if "id" in caregiver:
            cleanup(caregiver["id"])


def test_register_duplicate_email_fails(client, test_patient):
    """
    Tenta criar um segundo usuário com o mesmo email.
    Espera: status 400 com mensagem de erro.
    """
    res = client.post("/api/users/register", json={
        "name": "Outro Nome",
        "email": test_patient["email"],  # email já cadastrado
        "role": "patient",
    })

    assert res.status_code == 400, f"Esperava 400, recebi {res.status_code}"
    assert "cadastrado" in res.json()["detail"].lower()


def test_register_caregiver_invalid_patient_fails(client, fresh_email):
    """
    Cuidador informa email de paciente que não existe.
    Espera: status 404. O backend rejeita antes de persistir — sem limpeza necessária.
    """
    email_inexistente = f"naoexiste_{uuid.uuid4().hex[:8]}@dosecerta.com"
    res = client.post("/api/users/register", json={
        "name": "Cuidador Sem Paciente",
        "email": fresh_email,
        "role": "caregiver",
        "patient_email": email_inexistente,
    })

    assert res.status_code == 404, f"Esperava 404, recebi {res.status_code}"
    assert "paciente" in res.json()["detail"].lower()


# ─────────────────────────────────────────────────────────────
# BLOCO 2 — LOGIN
# ─────────────────────────────────────────────────────────────

def test_login_existing_user(client, test_patient):
    """
    Simula o login: GET /api/users/by-email/{email}.
    Espera: retorna o usuário com id, name, role corretos.
    """
    res = client.get(f"/api/users/by-email/{test_patient['email']}")

    assert res.status_code == 200
    data = res.json()
    assert data["id"] == test_patient["id"]
    assert data["name"] == test_patient["name"]
    assert data["role"] == "patient"


def test_login_nonexistent_email_fails(client):
    """
    Tenta fazer login com email que nunca foi cadastrado.
    Espera: status 404.
    """
    email = f"naoexiste_{uuid.uuid4().hex[:8]}@dosecerta.com"
    res = client.get(f"/api/users/by-email/{email}")

    assert res.status_code == 404


# ─────────────────────────────────────────────────────────────
# BLOCO 3 — ESTADO INICIAL DO PACIENTE
# ─────────────────────────────────────────────────────────────

def test_new_patient_has_no_medications(client, test_patient):
    """
    Paciente recém-criado não deve ter medicamentos.
    Espera: lista vazia [].
    """
    res = client.get(f"/api/medications/user/{test_patient['id']}")

    assert res.status_code == 200
    assert res.json() == [], f"Esperava [], recebi: {res.json()}"


def test_new_patient_has_no_dispensation_events(client, test_patient):
    """
    Paciente recém-criado não deve ter eventos de dispensação hoje.
    Espera: lista vazia [].
    """
    res = client.get(f"/api/dispensation/today/{test_patient['id']}")

    assert res.status_code == 200
    assert res.json() == [], f"Esperava [], recebi: {res.json()}"

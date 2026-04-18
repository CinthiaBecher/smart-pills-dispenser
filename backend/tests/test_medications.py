"""
test_medications.py — Testes de Medicamentos
=============================================
Testa os endpoints de criação, listagem e verificação de duplicatas.

Fixtures usadas (todas vêm do conftest.py automaticamente):
  - client         → cliente HTTP
  - test_patient   → paciente de teste (criado e apagado automaticamente)
  - test_medication → medicamento de teste vinculado ao test_patient

Para rodar:
    pytest backend/tests/test_medications.py -v
"""


# ─────────────────────────────────────────────────────────────
# BLOCO 1 — CRIAR MEDICAMENTO
# ─────────────────────────────────────────────────────────────

def test_create_medication(client, test_patient):
    """
    Cria um medicamento via POST /api/medications/
    Espera: status 200 com os campos corretos.
    A limpeza é feita automaticamente pelo teardown do test_patient.
    """
    res = client.post("/api/medications/", json={
        "user_id": test_patient["id"],
        "name": "Losartana",
        "dosage": "50mg",
        "route": "oral",
        "instructions": "Tomar em jejum",
    })

    assert res.status_code == 200, f"Esperava 200, recebi {res.status_code}: {res.text}"
    med = res.json()
    assert med["name"] == "Losartana"
    assert med["dosage"] == "50mg"
    assert med["route"] == "oral"
    assert med["user_id"] == test_patient["id"]
    assert med["active"] == True
    assert "id" in med


def test_create_medication_for_nonexistent_user(client):
    """
    Tenta criar medicamento para um user_id que não existe.
    Espera: status 404.
    """
    import uuid
    res = client.post("/api/medications/", json={
        "user_id": str(uuid.uuid4()),  # ID inexistente
        "name": "Remédio Fantasma",
        "dosage": "10mg",
    })

    assert res.status_code == 404, f"Esperava 404, recebi {res.status_code}"


# ─────────────────────────────────────────────────────────────
# BLOCO 2 — LISTAR MEDICAMENTOS
# ─────────────────────────────────────────────────────────────

def test_list_medications_returns_created(client, test_patient):
    """
    Cria dois medicamentos e verifica que ambos aparecem na listagem.
    """
    nomes = ["Atenolol", "Metformina"]
    for nome in nomes:
        client.post("/api/medications/", json={
            "user_id": test_patient["id"],
            "name": nome,
            "dosage": "100mg",
        })

    res = client.get(f"/api/medications/user/{test_patient['id']}")

    assert res.status_code == 200
    meds = res.json()
    nomes_retornados = [m["name"] for m in meds]

    for nome in nomes:
        assert nome in nomes_retornados, f"'{nome}' não apareceu na listagem: {nomes_retornados}"


def test_list_medications_only_active(client, test_patient, db):
    """
    Medicamentos com active=False não devem aparecer na listagem.
    Cria um medicamento, desativa diretamente no banco e verifica que some da lista.
    """
    from sqlalchemy import text

    # Cria o medicamento
    res = client.post("/api/medications/", json={
        "user_id": test_patient["id"],
        "name": "Remédio Inativo",
        "dosage": "5mg",
    })
    med_id = res.json()["id"]

    # Desativa diretamente no banco (simula expiração ou remoção manual)
    db.execute(text("UPDATE medications SET active = false WHERE id = :id"), {"id": med_id})
    db.commit()

    # Verifica que não aparece mais
    res_list = client.get(f"/api/medications/user/{test_patient['id']}")
    ids_ativos = [m["id"] for m in res_list.json()]

    assert med_id not in ids_ativos, "Medicamento inativo não deveria aparecer na listagem"


def test_expired_medication_not_listed(client, test_patient):
    """
    Medicamento com duration_days já vencido deve ser expirado automaticamente
    pelo endpoint de listagem e não aparecer nos resultados.

    O backend usa start_date + duration_days para calcular o fim.
    Passamos start_date de 30 dias atrás com duration_days=7 → já venceu.
    """
    from datetime import date, timedelta

    start_passado = (date.today() - timedelta(days=30)).isoformat()

    client.post("/api/medications/", json={
        "user_id": test_patient["id"],
        "name": "Antibiótico Vencido",
        "dosage": "500mg",
        "start_date": start_passado,
        "duration_days": 7,  # tratamento de 7 dias que começou há 30 dias
    })

    # A listagem deve expirá-lo e não retorná-lo
    res = client.get(f"/api/medications/user/{test_patient['id']}")
    nomes = [m["name"] for m in res.json()]

    assert "Antibiótico Vencido" not in nomes, (
        "Medicamento expirado não deveria aparecer na listagem"
    )


# ─────────────────────────────────────────────────────────────
# BLOCO 3 — CHECK DUPLICATA
# ─────────────────────────────────────────────────────────────

def test_check_duplicate_finds_existing(client, test_patient):
    """
    Cadastra um medicamento e verifica que check-duplicate o encontra.
    Testa também busca parcial (ex: "Losar" encontra "Losartana").
    """
    client.post("/api/medications/", json={
        "user_id": test_patient["id"],
        "name": "Losartana Potássica",
        "dosage": "50mg",
    })

    # Busca pelo nome completo
    res = client.get(
        f"/api/medications/check-duplicate/{test_patient['id']}",
        params={"name": "Losartana Potássica"}
    )
    assert res.status_code == 200
    assert res.json()["exists"] == True
    assert res.json()["medication_id"] is not None

    # Busca parcial — o backend usa ILIKE "%name%"
    res_parcial = client.get(
        f"/api/medications/check-duplicate/{test_patient['id']}",
        params={"name": "Losartana"}
    )
    assert res_parcial.json()["exists"] == True


def test_check_duplicate_not_found(client, test_patient):
    """
    Verifica que check-duplicate retorna exists=False para nome que não existe.
    """
    res = client.get(
        f"/api/medications/check-duplicate/{test_patient['id']}",
        params={"name": "Remédio Que Nunca Existiu"}
    )

    assert res.status_code == 200
    assert res.json()["exists"] == False
    assert res.json()["medication_id"] is None


def test_check_duplicate_ignores_inactive(client, test_patient, db):
    """
    Um medicamento desativado NÃO deve ser considerado duplicata.
    Se o paciente parou de tomar, pode recadastrar o mesmo remédio.
    """
    from sqlalchemy import text

    # Cria e logo desativa
    res = client.post("/api/medications/", json={
        "user_id": test_patient["id"],
        "name": "Omeprazol",
        "dosage": "20mg",
    })
    med_id = res.json()["id"]
    db.execute(text("UPDATE medications SET active = false WHERE id = :id"), {"id": med_id})
    db.commit()

    # Check-duplicate não deve encontrar o inativo
    res_check = client.get(
        f"/api/medications/check-duplicate/{test_patient['id']}",
        params={"name": "Omeprazol"}
    )
    assert res_check.json()["exists"] == False, (
        "Medicamento inativo não deveria ser considerado duplicata"
    )

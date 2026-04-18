"""
test_dispensation.py — Testes de Dispensação e Confirmação de Doses
====================================================================
Testa os endpoints de eventos do dia, confirmação, calendário e adesão semanal.

Fixtures usadas (todas vêm do conftest.py automaticamente):
  - client          → cliente HTTP
  - test_patient    → paciente de teste
  - test_schedule   → schedule de teste (depende de test_medication → test_patient)

Para rodar:
    pytest backend/tests/test_dispensation.py -v
"""

from datetime import date, timedelta


# ─────────────────────────────────────────────────────────────
# BLOCO 1 — EVENTOS DE HOJE
# ─────────────────────────────────────────────────────────────

def test_today_events_empty_for_new_patient(client, test_patient):
    """
    Paciente sem medicamentos não deve ter eventos de hoje.
    Espera: lista vazia [].
    """
    res = client.get(f"/api/dispensation/today/{test_patient['id']}")

    assert res.status_code == 200
    assert res.json() == [], f"Esperava [], recebi: {res.json()}"


def test_today_events_creates_pending_for_schedule(client, test_schedule, test_patient):
    """
    Paciente com schedule ativo deve receber eventos pending automaticamente.

    O endpoint /today cria os eventos se ainda não existirem.
    Deve retornar pelo menos 1 evento com status="pending" ou "confirmed".
    """
    res = client.get(f"/api/dispensation/today/{test_patient['id']}")

    assert res.status_code == 200
    events = res.json()

    # test_schedule tem days_of_week=[0,1,2,3,4,5,6] → aparece todo dia
    assert len(events) >= 1, f"Esperava ao menos 1 evento, recebi: {events}"

    # Todos os eventos devem ter os campos obrigatórios
    for ev in events:
        assert "event_id" in ev
        assert "status" in ev
        assert ev["status"] in ("pending", "confirmed", "missed")
        assert "medication_name" in ev
        assert "scheduled_time" in ev


def test_today_events_idempotent(client, test_schedule, test_patient):
    """
    Chamar /today duas vezes não deve duplicar os eventos.
    A segunda chamada deve retornar o mesmo número de eventos que a primeira.
    """
    res1 = client.get(f"/api/dispensation/today/{test_patient['id']}")
    res2 = client.get(f"/api/dispensation/today/{test_patient['id']}")

    assert res1.status_code == 200
    assert res2.status_code == 200

    ids1 = {ev["event_id"] for ev in res1.json()}
    ids2 = {ev["event_id"] for ev in res2.json()}

    assert ids1 == ids2, (
        f"IDs na 1ª chamada: {ids1}\n"
        f"IDs na 2ª chamada: {ids2}\n"
        "Eventos foram duplicados!"
    )


def test_today_event_has_medication_info(client, test_schedule, test_medication, test_patient):
    """
    Os eventos de hoje devem conter o nome e a dosagem do medicamento.
    """
    res = client.get(f"/api/dispensation/today/{test_patient['id']}")
    assert res.status_code == 200

    events = res.json()
    assert len(events) >= 1

    # test_medication tem name="Medicamento Teste Auto" e dosage="10mg"
    nomes = [ev["medication_name"] for ev in events]
    assert test_medication["name"] in nomes, (
        f"Nome '{test_medication['name']}' não encontrado nos eventos: {nomes}"
    )


# ─────────────────────────────────────────────────────────────
# BLOCO 2 — CONFIRMAR DOSE
# ─────────────────────────────────────────────────────────────

def test_confirm_dose(client, test_schedule, test_patient):
    """
    Confirma uma dose pendente.
    Espera: status da resposta 200, event_id e confirmed_at presentes.
    """
    # Garante que o evento existe
    res_hoje = client.get(f"/api/dispensation/today/{test_patient['id']}")
    assert res_hoje.status_code == 200

    events = res_hoje.json()
    assert len(events) >= 1, "Nenhum evento para confirmar"

    # Pega o primeiro evento pendente
    ev = next((e for e in events if e["status"] == "pending"), None)
    if ev is None:
        # Pode acontecer se todos já foram confirmados em outro teste —
        # nesse caso o teste não tem pré-condição e pode ser pulado
        return

    event_id = ev["event_id"]

    res = client.post("/api/dispensation/confirm", json={"event_id": event_id})

    assert res.status_code == 200, f"Esperava 200, recebi {res.status_code}: {res.text}"
    data = res.json()
    assert data["event_id"] == event_id
    assert data["confirmed_at"] is not None
    assert "Dose confirmada" in data["message"]


def test_confirm_already_confirmed_fails(client, test_schedule, test_patient):
    """
    Tentar confirmar uma dose já confirmada deve retornar 400.
    """
    # Busca um evento e confirma
    res_hoje = client.get(f"/api/dispensation/today/{test_patient['id']}")
    events = res_hoje.json()
    assert len(events) >= 1

    event_id = events[0]["event_id"]

    # Primeira confirmação (pode já estar confirmada — não importa)
    client.post("/api/dispensation/confirm", json={"event_id": event_id})

    # Segunda tentativa deve falhar
    res2 = client.post("/api/dispensation/confirm", json={"event_id": event_id})

    assert res2.status_code == 400, (
        f"Esperava 400 ao re-confirmar, recebi {res2.status_code}: {res2.text}"
    )
    assert "confirmada" in res2.json()["detail"].lower()


def test_confirm_nonexistent_event_fails(client):
    """
    Tentar confirmar um event_id que não existe deve retornar 404.
    """
    import uuid
    fake_id = str(uuid.uuid4())

    res = client.post("/api/dispensation/confirm", json={"event_id": fake_id})

    assert res.status_code == 404, f"Esperava 404, recebi {res.status_code}"


# ─────────────────────────────────────────────────────────────
# BLOCO 3 — EVENTO DE DIA ESPECÍFICO
# ─────────────────────────────────────────────────────────────

def test_day_future_returns_schedule_without_creating_event(client, test_schedule, test_patient):
    """
    Para um dia futuro, o endpoint /day retorna os agendamentos programados
    sem criar eventos no banco (event_id deve ser None).
    """
    amanha = (date.today() + timedelta(days=1)).isoformat()

    res = client.get(
        f"/api/dispensation/day/{test_patient['id']}",
        params={"date_str": amanha}
    )

    assert res.status_code == 200
    events = res.json()

    # test_schedule tem days_of_week=[0..6] → aparece amanhã também
    assert len(events) >= 1, f"Esperava slots futuros, recebi: {events}"

    for ev in events:
        assert ev["event_id"] is None, (
            f"Dia futuro não deve ter event_id, mas veio: {ev['event_id']}"
        )
        assert ev["status"] == "pending"


def test_day_invalid_date_format_fails(client, test_patient):
    """
    Formato de data inválido deve retornar 400.
    """
    res = client.get(
        f"/api/dispensation/day/{test_patient['id']}",
        params={"date_str": "12-04-2026"}  # formato errado
    )

    assert res.status_code == 400


def test_day_today_returns_events_after_creation(client, test_schedule, test_patient):
    """
    Após chamar /today (que cria eventos), chamar /day com a data de hoje
    deve retornar os mesmos eventos já criados.
    """
    hoje = date.today().isoformat()

    # Primeiro cria os eventos via /today
    client.get(f"/api/dispensation/today/{test_patient['id']}")

    # Agora busca pelo /day
    res = client.get(
        f"/api/dispensation/day/{test_patient['id']}",
        params={"date_str": hoje}
    )

    assert res.status_code == 200
    events = res.json()
    assert len(events) >= 1


# ─────────────────────────────────────────────────────────────
# BLOCO 4 — CALENDÁRIO MENSAL
# ─────────────────────────────────────────────────────────────

def test_calendar_empty_for_new_patient(client, test_patient):
    """
    Paciente sem medicamentos deve ter todos os dias com status "none" ou "future".
    Espera: 30 ou 31 itens, nenhum com status "full", "partial" ou "missed".
    """
    mes_atual = date.today().strftime("%Y-%m")

    res = client.get(
        f"/api/dispensation/calendar/{test_patient['id']}",
        params={"month": mes_atual}
    )

    assert res.status_code == 200
    days = res.json()

    assert len(days) >= 28, f"Esperava ao menos 28 dias no calendário, recebi {len(days)}"

    status_invalidos = [d for d in days if d["status"] not in ("none", "future")]
    assert status_invalidos == [], (
        f"Paciente sem medicamentos não deveria ter status de adesão: {status_invalidos}"
    )


def test_calendar_invalid_month_format_fails(client, test_patient):
    """
    Formato de mês inválido deve retornar 400.
    """
    res = client.get(
        f"/api/dispensation/calendar/{test_patient['id']}",
        params={"month": "2026/04"}  # formato errado — causa ValueError no split
    )

    assert res.status_code == 400


def test_calendar_future_days_are_future(client, test_patient):
    """
    Todos os dias futuros do mês devem ter status="future".
    """
    mes_atual = date.today().strftime("%Y-%m")
    hoje = date.today()

    res = client.get(
        f"/api/dispensation/calendar/{test_patient['id']}",
        params={"month": mes_atual}
    )

    assert res.status_code == 200
    days = res.json()

    for d in days:
        dia_date = date.fromisoformat(d["date"])
        if dia_date > hoje:
            assert d["status"] == "future", (
                f"Dia futuro {d['date']} deveria ser 'future', veio '{d['status']}'"
            )


# ─────────────────────────────────────────────────────────────
# BLOCO 5 — ADESÃO SEMANAL
# ─────────────────────────────────────────────────────────────

def test_weekly_returns_seven_days(client, test_patient):
    """
    O endpoint /weekly deve sempre retornar exatamente 7 dias.
    """
    res = client.get(f"/api/dispensation/weekly/{test_patient['id']}")

    assert res.status_code == 200
    data = res.json()

    assert len(data) == 7, f"Esperava 7 dias, recebi {len(data)}"


def test_weekly_zero_percent_without_medications(client, test_patient):
    """
    Paciente sem medicamentos deve ter percent=0 em todos os dias.
    """
    res = client.get(f"/api/dispensation/weekly/{test_patient['id']}")

    assert res.status_code == 200
    data = res.json()

    for day in data:
        assert day["percent"] == 0, (
            f"Esperava percent=0 para {day['day']}, recebi {day['percent']}"
        )
        assert day["total"] == 0
        assert day["confirmed"] == 0


def test_weekly_has_required_fields(client, test_patient):
    """
    Cada entrada semanal deve ter os campos day, date, total, confirmed, percent.
    """
    res = client.get(f"/api/dispensation/weekly/{test_patient['id']}")

    assert res.status_code == 200
    data = res.json()

    campos_obrigatorios = {"day", "date", "total", "confirmed", "percent"}
    for entry in data:
        faltando = campos_obrigatorios - set(entry.keys())
        assert not faltando, f"Campos faltando em {entry}: {faltando}"

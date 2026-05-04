# TCC 2 — Capítulo 3: Estado da Implementação
> Fonte única de verdade para redação do Capítulo 3 (Implementação).
> Atualizado em: 2026-05-02

---

## 1. Versões das Dependências Principais

### Backend (Python)
| Tecnologia | Versão exata |
|-----------|-------------|
| Python | 3.12.4 |
| FastAPI | 0.135.1 |
| Uvicorn | 0.41.0 |
| SQLAlchemy | 2.0.48 |
| Pydantic | 2.12.5 |
| psycopg2-binary | 2.9.11 |
| paho-mqtt | 1.6.1 |
| APScheduler | 3.11.2 |
| python-dotenv | 1.2.2 |
| email-validator | 2.3.0 |
| Starlette | 0.52.1 |

### Frontend (Node.js / npm)
| Tecnologia | Versão (package.json) |
|-----------|----------------------|
| React | ^19.2.4 |
| React DOM | ^19.2.4 |
| React Router DOM | ^7.14.0 |
| react-markdown | ^10.1.0 |
| Vite | ^8.0.0 |
| Tailwind CSS | ^3.4.19 |
| PostCSS | ^8.5.9 |
| Autoprefixer | ^10.4.27 |

---

## 2. Tabelas do Banco de Dados

Banco: **PostgreSQL** gerenciado pelo **Supabase**. Todos os IDs são UUID com `default=uuid4()`.

### `users`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| name | String(255) | NOT NULL |
| email | String(255) | UNIQUE, NOT NULL |
| role | String(20) | default `'patient'` — valores: `patient`, `caregiver` |
| notification_timeout_minutes | Integer | default `30` |
| created_at | DateTime | server_default now() |

### `medications`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL |
| name | String(255) | NOT NULL |
| dosage | String(100) | NOT NULL |
| route | String(50) | default `'oral'` |
| instructions | Text | nullable |
| restrictions | Text | nullable |
| compartment | Integer | nullable (compartimento físico 1–6) |
| active | Boolean | default `True` — soft-delete |
| start_date | Date | default hoje |
| duration_days | Integer | nullable — null = uso contínuo |
| created_at | DateTime | server_default now() |

### `schedules`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| medication_id | UUID | FK → medications.id, NOT NULL |
| time | Time | NOT NULL (ex: `08:00`) |
| days_of_week | ARRAY(Integer) | default `[0,1,2,3,4,5,6]` — 0=Dom, 6=Sáb |
| active | Boolean | default `True` |
| created_at | DateTime | server_default now() |

### `patient_caregivers`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| patient_id | UUID | FK → users.id, NOT NULL |
| caregiver_id | UUID | FK → users.id, NOT NULL |
| relationship | String(100) | nullable (ex: `'familiar'`) |
| active | Boolean | default `True` |
| created_at | DateTime | server_default now() |

### `dispensation_events`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| schedule_id | UUID | FK → schedules.id, NOT NULL |
| scheduled_time | DateTime | NOT NULL — data+hora prevista da dose |
| dispensed_at | DateTime | nullable — quando o ESP32 abriu o compartimento |
| confirmed_at | DateTime | nullable — quando o paciente confirmou |
| status | ENUM | NOT NULL, default `pending` — valores: `pending`, `dispensed`, `confirmed`, `missed` |
| created_at | DateTime | server_default now() |

### `notifications`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL (destinatário) |
| event_id | UUID | FK → dispensation_events.id, nullable |
| type | String(20) | NOT NULL — valores: `dose_ready`, `dose_taken`, `dose_missed` |
| message | String(255) | NOT NULL |
| read | Boolean | default `False` |
| created_at | DateTime | server_default now() |

### `prescriptions`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL |
| patient_name | String(255) | nullable |
| prescription_date | Date | nullable |
| doctor_name | String(255) | nullable |
| doctor_crm | String(100) | nullable |
| image_base64 | Text | nullable — imagem da receita em Data URL |
| medications_json | Text | nullable — snapshot JSON dos medicamentos criados |
| scanned_at | DateTime | server_default now() |

### `chat_history`
| Coluna | Tipo Python/SQL | Restrições |
|--------|----------------|-----------|
| id | UUID | PK |
| user_id | UUID | FK → users.id, NOT NULL |
| role | String(20) | NOT NULL — valores: `user`, `assistant` |
| content | Text | NOT NULL |
| created_at | DateTime | server_default now() |

---

## 3. Endpoints da API (33 no total)

### `/api/users`
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/users/register` | Registra usuário; vincula cuidador ao paciente pelo e-mail automaticamente |
| GET | `/api/users/by-email/{email}` | Busca usuário por e-mail (utilizado no fluxo de login) |
| GET | `/api/users/{user_id}` | Retorna dados de um usuário por ID |
| PATCH | `/api/users/{user_id}` | Atualiza nome e timeout de notificação do usuário |

### `/api/medications`
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/medications/` | Cria novo medicamento para um usuário |
| GET | `/api/medications/user/{user_id}` | Lista medicamentos ativos; expira automaticamente os com prazo vencido |
| GET | `/api/medications/check-duplicate/{user_id}?name=X` | Verifica se já existe medicamento ativo com aquele nome |
| GET | `/api/medications/{medication_id}` | Retorna dados de um medicamento por ID |
| PATCH | `/api/medications/{medication_id}` | Atualiza dados e horários do medicamento |
| DELETE | `/api/medications/{medication_id}` | Soft-delete: marca `active=False`, mantém histórico |

### `/api/schedules`
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/schedules/` | Cria horário de dose para um medicamento |
| GET | `/api/schedules/medication/{medication_id}` | Lista horários ativos de um medicamento |

### `/api/prescriptions`
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/prescriptions/interpret` | Envia imagem ao Gemini Vision; retorna JSON estruturado com os medicamentos |
| POST | `/api/prescriptions/confirm` | Cria medicamentos e schedules a partir da receita interpretada |
| GET | `/api/prescriptions/user/{user_id}` | Lista receitas escaneadas do paciente (mais recentes primeiro) |
| GET | `/api/prescriptions/{prescription_id}` | Detalhe de uma receita, incluindo a imagem em base64 |

### `/api/dispensation`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dispensation/today/{user_id}` | Doses do dia atual; cria eventos `pending` automaticamente a partir dos schedules |
| GET | `/api/dispensation/day/{user_id}?date_str=YYYY-MM-DD` | Doses de uma data específica (futuro: agendamentos; passado: eventos reais) |
| GET | `/api/dispensation/calendar/{user_id}?month=YYYY-MM` | Calendário mensal de adesão com status por dia |
| GET | `/api/dispensation/weekly/{user_id}` | Percentual de adesão dos últimos 7 dias |
| POST | `/api/dispensation/trigger/{event_id}` | Publica mensagem MQTT para o ESP32 dispensar o medicamento |
| POST | `/api/dispensation/confirm` | Paciente confirma manualmente que tomou a dose |

### `/api/chat`
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/chat/` | Envia mensagem ao chatbot; retorna resposta gerada pelo Gemini com contexto do paciente e RAG |
| GET | `/api/chat/history/{user_id}` | Retorna últimas 50 mensagens do histórico do paciente |
| DELETE | `/api/chat/history/{user_id}` | Limpa todo o histórico de chat do usuário |

### `/api/caregivers`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/caregivers/my-patient/{caregiver_id}` | Retorna o paciente vinculado ao cuidador |
| GET | `/api/caregivers/{patient_id}` | Lista os cuidadores de um paciente |
| POST | `/api/caregivers/{patient_id}` | Adiciona cuidador ao paciente por e-mail |
| DELETE | `/api/caregivers/{patient_id}/{vinculo_id}` | Remove vínculo cuidador-paciente |

### `/api/notifications`
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/notifications/{user_id}` | Retorna as últimas 30 notificações do usuário |
| GET | `/api/notifications/{user_id}/unread-count` | Retorna a contagem de notificações não lidas |
| POST | `/api/notifications/{notification_id}/read` | Marca uma notificação como lida |
| POST | `/api/notifications/{user_id}/read-all` | Marca todas as notificações do usuário como lidas |

---

## 4. Estrutura de Pastas — Backend (até nível 2)

```
backend/
├── main.py                  # Entry point: FastAPI app, CORS, lifespan (MQTT + scheduler)
├── models.py                # Modelos SQLAlchemy (8 tabelas)
├── schemas.py               # Schemas Pydantic para validação de entrada/saída
├── database.py              # Engine, SessionLocal, get_db()
├── mqtt_client.py           # Cliente MQTT: publica comandos, recebe confirmações do ESP32
├── scheduler.py             # APScheduler: jobs de dose_ready e dose_missed
├── routers/
│   ├── users.py             # Cadastro e autenticação de usuários
│   ├── medications.py       # CRUD de medicamentos
│   ├── schedules.py         # CRUD de horários
│   ├── prescriptions.py     # Interpretação de receita via Gemini Vision
│   ├── dispensation.py      # Eventos de dispensação e acionamento do dispenser
│   ├── chat.py              # Chatbot com RAG e histórico
│   ├── caregivers.py        # Vínculos cuidador-paciente
│   └── notifications.py     # Notificações in-app
├── rag/
│   ├── retriever.py         # Lógica de recuperação de chunks de bula
│   ├── bulas_data.py        # Aliases de medicamentos e keywords de seção
│   ├── bulas_index.json     # Base de conhecimento: 5 bulas Anvisa indexadas
│   └── pdf_extractor.py     # Script utilitário para extração das bulas dos PDFs
└── tests/
    ├── conftest.py           # Fixtures compartilhadas (sessão de DB, usuários de teste)
    ├── test_auth.py          # 8 testes de cadastro e autenticação
    ├── test_medications.py   # 8 testes de CRUD de medicamentos
    └── test_dispensation.py  # 16 testes de eventos de dispensação
```

---

## 5. Estrutura de Pastas — Frontend (`src/`)

```
frontend/src/
├── App.jsx                  # Roteamento principal (React Router)
├── main.jsx                 # Entry point React
├── index.css                # Estilos globais + configuração Tailwind
├── pages/
│   ├── Login.jsx            # /login — autenticação por e-mail
│   ├── Register.jsx         # /cadastro — registro de paciente ou cuidador
│   ├── Dashboard.jsx        # /dashboard — home do paciente (doses, dispenser, notificações)
│   ├── CaregiverDashboard.jsx # /dashboard (role=caregiver) — visão do cuidador
│   ├── Medicamentos.jsx     # /medicamentos — lista de medicamentos com editar/remover
│   ├── EditarMedicamento.jsx # /medicamentos/editar/:id — edição de medicamento
│   ├── Escanear.jsx         # /escanear — fluxo de scan da receita (3 passos)
│   ├── Chat.jsx             # /chat — chatbot farmacêutico
│   ├── Perfil.jsx           # /perfil — dados do usuário e gerenciar cuidadores
│   ├── Receitas.jsx         # /receitas — histórico de receitas escaneadas
│   └── TestPanel.jsx        # /test — painel de desenvolvimento (sem proteção)
└── components/
    ├── PrivateRoute.jsx      # Guarda de rota: redireciona para /login se não autenticado
    ├── BottomNav.jsx         # Barra de navegação inferior (5 ícones)
    ├── NotificationPanel.jsx # Painel de notificações deslizante com badge de não lidas
    ├── CalendarView.jsx      # Calendário mensal de adesão colorido por status
    ├── LoadingScreen.jsx     # Tela de carregamento reutilizável
    ├── EditMedicamentoModal.jsx # Modal de edição (legado — substituído pela página)
    └── scan/
        ├── ScanValidation.jsx   # Passo 1: captura da imagem da receita
        ├── ScanReview.jsx       # Passo 2: revisão dos dados extraídos pelo Gemini
        └── ScanConfirm.jsx      # Passo 3: confirmação e criação dos medicamentos
```

---

## 6. Tópicos MQTT e Payloads

### Broker
- **Endereço:** `broker.hivemq.com`
- **Porta:** `1883`
- **Protocolo:** MQTT 3.1.1

### Tópicos

| Tópico | Direção | QoS |
|--------|---------|-----|
| `smartpills/dispense` | Backend → ESP32 | 1 |
| `smartpills/dispensed` | ESP32 → Backend | 1 |

### Payloads JSON

**`smartpills/dispense`** — backend ordena ao ESP32 que dispense o medicamento:
```json
{
  "event_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "schedule_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "medication_name": "Losartana Potássica",
  "medication_dosage": "50mg"
}
```

**`smartpills/dispensed`** — ESP32 confirma que o paciente retirou o medicamento (botão pressionado):
```json
{
  "event_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "schedule_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

### Fluxo completo
```
Paciente clica "Acionar" no app
        ↓
Backend: POST /api/dispensation/trigger/{event_id}
        → status = "dispensed", dispensed_at = now()
        → mqtt_client.publish_dispense() → tópico: smartpills/dispense
        ↓
ESP32 recebe → abre compartimento (servo 90°) → buzzer 3×
        ↓
Paciente retira o medicamento → pressiona botão físico
        ↓
ESP32 publica → tópico: smartpills/dispensed
        ↓
Backend _on_message() → status = "confirmed", confirmed_at = now()
        ↓
scheduler.notify_dose_taken() → notificação para cuidadores
```

---

## 7. Variáveis de Ambiente

Carregadas via `python-dotenv` a partir do arquivo `.env` na raiz do projeto.

| Variável | Usado em | Descrição |
|----------|---------|-----------|
| `DATABASE_URL` | `backend/database.py` | String de conexão PostgreSQL — formato: `postgresql://user:password@host:port/db` |
| `GEMINI_API_KEY` | `backend/routers/prescriptions.py`, `backend/routers/chat.py` | Chave de API do Google Gemini (multimodal — Vision + texto) |

> O arquivo `.env` **não deve ser versionado**. Verificar que está listado no `.gitignore`.

---

## Resumo Arquitetural

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                   │
│  Vite · Tailwind · React Router · react-markdown         │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST (localhost:8000)
┌────────────────────────▼────────────────────────────────┐
│                  Backend (FastAPI 0.135)                  │
│  SQLAlchemy · Pydantic · APScheduler · paho-mqtt         │
│  8 routers · 26 endpoints · RAG (5 bulas Anvisa)         │
└──────┬────────────────────────────┬────────────────────┘
       │ PostgreSQL (Supabase)       │ MQTT (HiveMQ Cloud)
┌──────▼──────┐              ┌──────▼──────────┐
│  8 tabelas  │              │  ESP32 (Wokwi)   │
│  UUID keys  │              │  Servo · Buzzer  │
│  Supabase   │              │  LED · LCD · Btn │
└─────────────┘              └─────────────────┘
                  IA: Google Gemini API
           (OCR de receitas + chatbot farmacêutico)
```

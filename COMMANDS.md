# Comandos Úteis — Smart Pills Dispenser

## Rodar o Projeto Completo (Backend + Frontend + Wokwi)

Esta seção descreve como subir todo o ecossistema do Dose Certa do zero.

### Links importantes
- **Simulador ESP32 (Wokwi):** https://wokwi.com/projects/462582850556010497
- **Cliente MQTT online:** https://mqttx.app/web-client#/recent_connections/9e4ec091-203f-4d89-a866-89c7c91a3123
- **API (Swagger):** http://localhost:8000/docs
- **App (Frontend):** http://localhost:5173

---

### Passo 1 — Ativar o ambiente Python e subir o backend

```bash
# No terminal, na raiz do projeto
source venv/bin/activate

# Subir o servidor (deixar esse terminal aberto)
uvicorn backend.main:app --reload
```

Aguarde aparecer no terminal:
```
INFO:     Application startup complete.
INFO:     MQTT conectado e inscrito em smartpills/dispensed
```

> Se aparecer erro de MQTT, verifique a conexão com a internet — o broker é público (broker.hivemq.com).

---

### Passo 2 — Subir o frontend

```bash
# Em outro terminal
cd frontend
npm run dev
```

Acesse: http://localhost:5173

---

### Passo 3 — Iniciar o simulador Wokwi

1. Abra: https://wokwi.com/projects/462582850556010497
2. Clique no botão **Play** (▶) para iniciar a simulação
3. Aguarde o display LCD mostrar **"Aguardando..."** — isso indica que o ESP32 conectou ao WiFi e ao broker MQTT

> Se o LCD ficar em branco por mais de 10s, clique em Stop e Play novamente.

---

### Passo 4 — Testar o ciclo completo

1. Faça login no app (http://localhost:5173)
2. No **Dashboard**, localize uma dose com status pendente
3. Clique em **"Acionar Dispenser"**
4. Observe no **Wokwi**:
   - LCD mostra o nome e dosagem do medicamento
   - Buzzer emite 3 bipes
   - LED verde acende
   - Servo abre o compartimento (90°)
5. Clique no **botão físico** dentro do Wokwi para simular a retirada do remédio
6. Observe:
   - Servo fecha (0°) + LED apaga
   - LCD mostra "Retirado! Obrigado"
   - O Dashboard atualiza automaticamente em até 5s e mostra ✅

---

### Monitorar mensagens MQTT (opcional)

Para visualizar as mensagens trafegando entre o app e o ESP32:

1. Abra: https://mqttx.app/web-client#/recent_connections/9e4ec091-203f-4d89-a866-89c7c91a3123
2. Conecte em `broker.hivemq.com`, porta `8884`
3. Assine os dois tópicos:
   - `smartpills/dispense` — mensagens do app para o ESP32
   - `smartpills/dispensed` — confirmações do ESP32 para o app

---

## Ambiente Virtual Python

```bash
# Criar o ambiente virtual (só na primeira vez)
python3 -m venv venv

# Ativar o ambiente virtual (sempre que abrir o terminal)
source venv/bin/activate

# Verificar se está ativo: deve aparecer (venv) no início da linha
```

## Dependências

```bash
# Instalar bibliotecas
pip install fastapi uvicorn

# (futuro) Salvar as dependências instaladas em um arquivo
pip freeze > requirements.txt

# (futuro) Instalar dependências a partir do arquivo (ex: após clonar o projeto)
pip install -r requirements.txt
```

## Rodar o Backend

```bash
# Iniciar o servidor de desenvolvimento (com reload automático)
uvicorn backend.main:app --reload
```

Acesse em: http://127.0.0.1:8000
Documentação automática: http://127.0.0.1:8000/docs


## Módulo RAG — Bulas de Medicamentos

O conteúdo das bulas já está extraído em `backend/rag/bulas_index.json` e versionado no Git.
Os PDFs originais **não são versionados** (estão no `.gitignore`) pois são arquivos binários grandes.

Medicamentos disponíveis: dipirona, ibuprofeno, levotiroxina, losartana, sinvastatina.

### Regenerar o índice (só se adicionar novos PDFs)

```bash
# 1. Coloque os PDFs da Anvisa em backend/rag/pdfs/
# 2. Rode o extrator:
python3 -m backend.rag.pdf_extractor
```

O script lê os PDFs, extrai as seções relevantes (posologia, interações, contraindicações, advertências, reações adversas) e salva em `bulas_index.json`.

---

### Padrão de mensagens de commit usadas neste projeto
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `chore:` configuração, organização (sem impacto no código)
- `docs:` documentação

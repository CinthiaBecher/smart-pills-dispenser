# Comandos Úteis — Smart Pills Dispenser

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

## Git

```bash
# Ver o status dos arquivos (o que mudou)
git status

# Adicionar arquivos específicos para o próximo commit
git add <nome-do-arquivo>

# Adicionar todos os arquivos modificados
git add .

# Criar um commit (ponto de restauração)
git commit -m "mensagem descritiva do que foi feito"

# Enviar para o GitHub
git push
```

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

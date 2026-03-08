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

### Padrão de mensagens de commit usadas neste projeto
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `chore:` configuração, organização (sem impacto no código)
- `docs:` documentação

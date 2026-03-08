from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv
import os

# Lê as variáveis do arquivo .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Cria a "engine" — é a ponte entre o Python e o banco de dados
engine = create_engine(DATABASE_URL)

# Fábrica de sessões — cada requisição abre uma sessão para interagir com o banco
SessionLocal = sessionmaker(bind=engine)


# Classe base para os modelos (tabelas) que vamos criar depois
class Base(DeclarativeBase):
    pass


# Função que fornece uma sessão do banco para cada requisição
# O "yield" garante que a sessão seja fechada após o uso
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

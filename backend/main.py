from fastapi import FastAPI
from backend.routers import users

app = FastAPI(title="Smart Pills Dispenser API")

app.include_router(users.router)


@app.get("/")
def root():
    return {"message": "Smart Pills Dispenser API funcionando!"}

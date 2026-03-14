from fastapi import FastAPI
from backend.routers import users, medications, schedules, prescriptions

app = FastAPI(title="Smart Pills Dispenser API")

app.include_router(users.router)
app.include_router(medications.router)
app.include_router(schedules.router)
app.include_router(prescriptions.router)


@app.get("/")
def root():
    return {"message": "Smart Pills Dispenser API funcionando!"}

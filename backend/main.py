from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import users, medications, schedules, prescriptions, chat, dispensation, caregivers, notifications
import backend.mqtt_client as mqtt_client
from backend.scheduler import init_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    mqtt_client.init_mqtt()
    init_scheduler()
    yield
    # Shutdown: nada a fazer (paho para sozinho)


app = FastAPI(title="Smart Pills Dispenser API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(medications.router)
app.include_router(schedules.router)
app.include_router(prescriptions.router)
app.include_router(chat.router)
app.include_router(dispensation.router)
app.include_router(caregivers.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    return {"message": "Smart Pills Dispenser API funcionando!"}

from fastapi import FastAPI

app = FastAPI(title="Smart Pills Dispenser API")


@app.get("/")
def root():
    return {"message": "Smart Pills Dispenser API funcionando!"}

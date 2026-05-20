from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any

app = FastAPI(title="ArgusNode OS - Policy Engine", version="1.0.0")

class Telemetry(BaseModel):
    node_id: str
    cpu_usage: float
    ram_usage: float
    metrics: Dict[str, Any] = {}

@app.get("/health")
def read_health():
    return {"status": "ok", "service": "Argus Core Backend"}

@app.post("/api/telemetry")
def receive_telemetry(payload: Telemetry):
    # Aquí irá la lógica de evaluación (Argus Eyes) y guardado en InfluxDB
    print(f"Telemetría recibida de {payload.node_id} | CPU: {payload.cpu_usage}%")
    return {"status": "success", "action": "logged"}

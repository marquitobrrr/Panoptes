from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

app = FastAPI(title="ArgusNode OS - Policy Engine", version="1.0.0")

# Permitir conexiones del Frontend React (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción se debería limitar a la IP del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de InfluxDB
INFLUX_URL = "http://argus-influxdb:8086" # Nombre del contenedor en Docker
INFLUX_TOKEN = "argus-super-secret-token"
INFLUX_ORG = "argus"
INFLUX_BUCKET = "telemetry"

client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()

class Telemetry(BaseModel):
    node_id: str
    os_type: str = "Unknown"
    cpu_usage: float
    ram_usage: float
    metrics: Dict[str, Any] = {}

@app.get("/health")
def read_health():
    return {"status": "ok", "service": "Argus Core Backend"}

@app.post("/api/telemetry")
def receive_telemetry(payload: Telemetry):
    print(f"Telemetría recibida de {payload.node_id} | CPU: {payload.cpu_usage}%")
    
    # Escribir el punto de datos en InfluxDB
    point = (
        Point("system_metrics")
        .tag("node_id", payload.node_id)
        .tag("os_type", payload.os_type)
        .field("cpu_usage", float(payload.cpu_usage))
        .field("ram_usage", float(payload.ram_usage))
    )
    
    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        return {"status": "success", "action": "logged"}
    except Exception as e:
        print(f"Error InfluxDB: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/telemetry/latest")
def get_latest_telemetry():
    # Consulta a InfluxDB para sacar el último dato de los últimos 5 minutos
    query = f"""
    from(bucket: "{INFLUX_BUCKET}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "system_metrics")
      |> last()
    """
    try:
        tables = query_api.query(query, org=INFLUX_ORG)
        result = {}
        for table in tables:
            for record in table.records:
                node_id = record.values.get("node_id")
                if node_id not in result:
                    result[node_id] = {"node_id": node_id}
                
                # Sacar campos
                field_name = record.get_field()
                field_value = record.get_value()
                result[node_id][field_name] = field_value
                
        # Convertimos el diccionario a lista
        return list(result.values())
    except Exception as e:
        print(f"Error querying InfluxDB: {e}")
        return []

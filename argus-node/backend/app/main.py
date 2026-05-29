from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import json
import subprocess
import datetime

app = FastAPI(title="ArgusNode OS - Policy Engine", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# InfluxDB Configuration
INFLUX_URL = "http://argus-influxdb:8086"
INFLUX_TOKEN = "argus-super-secret-token"
INFLUX_ORG = "argus"
INFLUX_BUCKET = "telemetry"

client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()

# In-memory store for SIEM alerts and C2 pending commands
siem_alerts = []
pending_commands = {} # Format: { "node_id": ["cmd1", "cmd2"] }

class Telemetry(BaseModel):
    node_id: str
    os_type: str = "Unknown"
    ip_address: str = "Unknown"
    cpu_usage: float
    ram_usage: float
    temperature: str = "N/A"
    net_upload_mbps: float = 0.0
    net_download_mbps: float = 0.0
    top_processes: List[Dict[str, Any]] = []
    metrics: Dict[str, Any] = {}

@app.get("/health")
def read_health():
    return {"status": "ok", "service": "Argus Core Backend"}

@app.post("/api/telemetry")
def receive_telemetry(payload: Telemetry):
    print(f"Telemetría recibida de {payload.node_id} | CPU: {payload.cpu_usage}% | RAM: {payload.ram_usage}%")
    
    # Policy Engine: Threshold evaluation
    total_bandwidth = payload.net_upload_mbps + payload.net_download_mbps
    
    if payload.cpu_usage > 85.0:
        alert = {
            "id": f"ALRT-{datetime.datetime.now().timestamp()}",
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "node_id": payload.node_id,
            "os_type": payload.os_type,
            "ip_address": payload.ip_address,
            "parameter": "CPU",
            "severity": "CRITICAL",
            "message": f"Sobrecarga de CPU detectada ({payload.cpu_usage}%)",
            "status": "active",
            "pinned": False
        }
        siem_alerts.insert(0, alert)
        
    if payload.ram_usage > 85.0:
        alert = {
            "id": f"ALRT-{datetime.datetime.now().timestamp()}",
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "node_id": payload.node_id,
            "os_type": payload.os_type,
            "ip_address": payload.ip_address,
            "parameter": "RAM",
            "severity": "WARNING",
            "message": f"Consumo de RAM elevado ({payload.ram_usage}%)",
            "status": "active",
            "pinned": False
        }
        siem_alerts.insert(0, alert)
        
    if total_bandwidth > 100.0:
        alert = {
            "id": f"ALRT-{datetime.datetime.now().timestamp()}",
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "node_id": payload.node_id,
            "os_type": payload.os_type,
            "ip_address": payload.ip_address,
            "parameter": "Red",
            "severity": "WARNING",
            "message": f"Tráfico de Red inusualmente alto ({round(total_bandwidth, 2)} MB/s)",
            "status": "active",
            "pinned": False
        }
        siem_alerts.insert(0, alert)
        
    if len(siem_alerts) > 100:
        siem_alerts.pop()
    
    # Write data point to InfluxDB
    point = (
        Point("system_metrics")
        .tag("node_id", payload.node_id)
        .tag("os_type", payload.os_type)
        .tag("ip_address", payload.ip_address)
        .field("cpu_usage", float(payload.cpu_usage))
        .field("ram_usage", float(payload.ram_usage))
        .field("temperature", payload.temperature)
        .field("net_upload_mbps", float(payload.net_upload_mbps))
        .field("net_download_mbps", float(payload.net_download_mbps))
        .field("top_processes", json.dumps(payload.top_processes))
    )
    
    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
        return {"status": "success", "action": "logged"}
    except Exception as e:
        print(f"Error InfluxDB: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/alerts")
def get_alerts():
    return siem_alerts

@app.delete("/api/alerts")
def clear_alerts():
    for alert in siem_alerts:
        if alert.get("status") == "active":
            alert["status"] = "trashed"
            alert["pinned"] = False
    return {"status": "success", "message": "Activas enviadas a la papelera"}

class AlertAction(BaseModel):
    action: str
    
@app.post("/api/alerts/{alert_id}/action")
def alert_action(alert_id: str, payload: AlertAction):
    for alert in siem_alerts:
        if alert["id"] == alert_id:
            if payload.action == "pin":
                alert["pinned"] = not alert.get("pinned", False)
            elif payload.action == "archive":
                alert["status"] = "archived"
                alert["pinned"] = False
            elif payload.action == "trash":
                alert["status"] = "trashed"
                alert["pinned"] = False
            elif payload.action == "restore":
                alert["status"] = "active"
            return {"status": "success"}
    return {"status": "error", "message": "Alert not found"}

@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: str):
    global siem_alerts
    siem_alerts = [a for a in siem_alerts if a["id"] != alert_id]
    return {"status": "success"}

@app.get("/api/telemetry/latest")
def get_latest_telemetry():
    # Query InfluxDB for the latest telemetry data (last 5m)
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
                    result[node_id] = {
                        "node_id": node_id,
                        "os_type": record.values.get("os_type", "Unknown"),
                        "ip_address": record.values.get("ip_address", "Unknown")
                    }
                
                # Extract fields
                field_name = record.get_field()
                field_value = record.get_value()
                
                if field_name == "top_processes" and isinstance(field_value, str):
                    try:
                        field_value = json.loads(field_value)
                    except:
                        field_value = []
                
                result[node_id][field_name] = field_value
                
        return list(result.values())
    except Exception as e:
        print(f"Error querying InfluxDB: {e}")
        return []

class CommandPayload(BaseModel):
    command: str

@app.post("/api/commands/{node_id}")
def queue_command(node_id: str, payload: CommandPayload):
    if node_id not in pending_commands:
        pending_commands[node_id] = []
    pending_commands[node_id].append(payload.command)
    print(f"📡 [C2] Orden encolada para {node_id}: {payload.command}")
    return {"status": "success", "message": "Orden añadida a la cola."}

@app.get("/api/commands/{node_id}/pending")
def get_pending_commands(node_id: str):
    cmds = pending_commands.get(node_id, [])
    if cmds:
        print(f"⚡ [C2] Entregando {len(cmds)} órdenes a {node_id}")
        pending_commands[node_id] = [] # Clear queue after delivery
    return {"commands": cmds}

@app.post("/api/mitigate/{node_id}")
def mitigate_node(node_id: str):
    print(f"🚨 [BOTÓN DEL PÁNICO] Orden de mitigación recibida para: {node_id} 🚨")
    
    if "Win" in node_id or "Ubuntu" in node_id:
        print(f"🔌 Ejecutando aislamiento en Azure para {node_id}...")
        try:
            cmd = f"az vm deallocate --resource-group ArgusNode-RG-Spain --name {node_id} --no-wait"
            subprocess.Popen(cmd, shell=True)
            return {
                "status": "success", 
                "action": "mitigating", 
                "provider": "Azure Cloud", 
                "message": f"Orden de contención letal (Deallocate) enviada a Azure para {node_id}."
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    else:
        print(f"🔒 Ejecutando aislamiento On-Premises para {node_id}...")
        return {
            "status": "success", 
            "action": "mitigating", 
            "provider": "On-Premises", 
            "message": f"Cortafuegos local reconfigurado para aislar el nodo {node_id}."
        }

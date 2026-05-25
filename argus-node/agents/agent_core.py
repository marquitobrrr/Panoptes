import time
import platform
import psutil
import requests
import json
import logging

# Configuración básica de logs
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- CONFIGURACIÓN DEL AGENTE ---
# En producción, esto se pasará por variables de entorno o archivo config.ini
BACKEND_URL = "http://100.115.255.119:8000/api/telemetry"
POLL_INTERVAL = 5 # Segundos entre cada envío

def get_system_metrics():
    """Captura las métricas vitales del sistema usando psutil"""
    try:
        cpu_usage = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory()
        
        return {
            "node_id": platform.node(), # El nombre del host (ej. WINDOWS-DESKTOP)
            "os_type": platform.system(),
            "cpu_usage": cpu_usage,
            "ram_usage": ram.percent,
            "metrics": {
                "ram_total_gb": round(ram.total / (1024**3), 2),
                "ram_used_gb": round(ram.used / (1024**3), 2)
            }
        }
    except Exception as e:
        logging.error(f"Error al recolectar métricas: {e}")
        return None

def send_telemetry(payload):
    """Envía el payload JSON al Control Plane mediante una petición HTTP POST"""
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(BACKEND_URL, data=json.dumps(payload), headers=headers, timeout=3)
        if response.status_code == 200:
            logging.info(f"[EXITO] Telemetría enviada -> CPU: {payload['cpu_usage']}% | RAM: {payload['ram_usage']}%")
        else:
            logging.warning(f"[FALLO HTTP] Servidor devolvió código {response.status_code}")
    except requests.exceptions.RequestException as e:
        logging.error(f"[ERROR RED] No se pudo conectar a {BACKEND_URL}. ¿Está la VPN activa?")

def main():
    logging.info("=========================================")
    logging.info("  ArgusNode OS - Agente Iniciado")
    logging.info(f"  Modo: Espía Local (Destino: {BACKEND_URL})")
    logging.info("=========================================")
    
    while True:
        payload = get_system_metrics()
        if payload:
            send_telemetry(payload)
        
        # Dormir hasta el siguiente ciclo
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()

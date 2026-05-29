# ArgusNode OS 👁️‍🗨️

**ArgusNode OS** es una plataforma híbrida de observabilidad y Command and Control (C2) diseñada para entornos multicloud y on-premises. Permite monitorizar el estado de máquinas físicas y virtuales, evaluar políticas de seguridad (SIEM) e interactuar con ellas en tiempo real mediante técnicas de asilamiento *out-of-band* y ejecución remota de código (RCE).

## 🚀 Características Principales

- **Arquitectura Híbrida (Push):** Agentes ligeros y multiplataforma que envían telemetría continua al nodo central mediante conexiones seguras sin requerir apertura de puertos entrantes (VPN Mesh).
- **Argus Eyes (Motor SIEM):** Evaluación en tiempo real del uso de CPU, RAM, Ancho de Banda y procesos, generando alertas automatizadas ante anomalías.
- **Centro C2 y Red Teaming:** Ejecución remota de comandos, mecanismos de persistencia en el Registro de Windows (técnicas APT) y aislamiento de red en casos de infección por ransomware.
- **Dashboard Interactivo:** Interfaz web en React/Vite con un diseño premium *Dark Mode* para gestionar incidentes, alertas y controlar los nodos de forma visual.
- **Infraestructura Ágil:** Control Plane orquestado íntegramente mediante contenedores optimizando drásticamente los recursos del servidor.

## 🛠️ Stack Tecnológico

- **Backend:** Python 3.11, FastAPI, Pydantic.
- **Frontend:** React.js, Vite.
- **Base de Datos:** InfluxDB (Time Series Database).
- **Infraestructura:** Debian 13 (Headless Server), Docker Compose V2, Microsoft Azure (Azure SDK).
- **Comunicaciones:** Tailscale (WireGuard VPN Mesh).

## 📂 Estructura del Repositorio

- `/argus-node/agents/`: Scripts en Python (agentes) para instalar en los Nodos Remotos.
- `/argus-node/backend/`: Motor lógico principal (Argus Eyes) y API de recolección en FastAPI.
- `/argus-node/frontend/`: Aplicación web React (Dashboard C2).
- `/argus-node/docker-compose.yml`: Plantilla de orquestación para el servidor local.
- `/cloud/`: Scripts PowerShell para la automatización y despliegue en Azure.
- `/doc/`: Documentación técnica detallada de la arquitectura híbrida y manual de despliegue.

---
*Desarrollado como proyecto de ciberseguridad híbrida y Trabajo de Fin de Máster (TFM).*

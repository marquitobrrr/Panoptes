# 🧠 META-CONTEXTO DEL PROYECTO: ARGUSNODE OS
**Documento de alineación para IA Asistente (Antigravity IDE)**

## 1. Visión General y Objetivo del Proyecto
El proyecto, denominado **ArgusNode OS**, es el Trabajo de Fin de Máster (TFM) del usuario. Consiste en diseñar, desplegar y programar desde cero un **Control Plane (Panel de Control) de observabilidad y cumplimiento híbrido (On-Premises + Multi-Cloud)**.

El sistema completo se divide en tres piezas fundamentales:
1. **Argus Server:** El nodo central (orquestador) alojado en local (Debian). Recibe telemetría, procesa reglas y sirve la interfaz web.
2. **ArgusNode OS (Agentes):** Scripts ligeros instalados en las máquinas remotas (Azure) que extraen métricas (CPU, RAM, Logs SSH) y las envían por VPN.
3. **Argus Eyes:** El motor lógico (Policy Engine) que evalúa las métricas en tiempo real y dispara alertas o acciones automatizadas (ej. apagar una máquina comprometida en Azure usando su SDK).

La arquitectura es **Híbrida (Local + Cloud)**, conectada mediante una **VPN Mesh (Tailscale/WireGuard)** para asegurar que todas las máquinas, independientemente de su proveedor o red física, se comuniquen por IPs privadas de forma segura mediante un modelo de ingesta de datos tipo *Push*.

---

## 2. Estado Actual de la Infraestructura (Lo que YA hemos hecho)
Hasta este momento, hemos consolidado la capa base (Infraestructura y Orquestación) en el **Nodo Central (On-Premises)** y resuelto la conectividad remota.

* **Sistema Operativo:** Debian 13 (Trixie) Minimal/Headless instalado y securizado.
* **Red y Conectividad (VPN Mesh):** 
  * `ens32` (NAT): Salida a Internet.
  * `ens34` (Host-Only): Interfaz local aislada.
  * **Solución Tailscale:** Desplegada la red superpuesta (`tailscale0`) asignando IP global privada (`100.x.x.x`) al servidor Debian, permitiendo acceso SSH remoto directo y eludiendo las restricciones de NAT/Cortafuegos que impedían el teletrabajo.
* **Motor de Contenedores:** Instalado Docker CE v29.5 (oficial) con `docker compose` y `BuildKit`.
* **Fase 1 - Control Plane (Backend & DB):**
  * Desplegado orquestador `docker-compose.yml` final.
  * Levantado contenedor de **InfluxDB** (TSDB) mapeado a volumen local `database_data/` para persistencia.
  * Creado y desplegado el **Core Backend (Argus Eyes)** en Python 3.11 con FastAPI y Pydantic.
  * Programados endpoints iniciales y escritura en DB.
  * Desarrollado el panel Frontend interactivo en React/Vite.
  * **Conectado End-to-End:** Agente -> Backend -> InfluxDB -> Frontend. Orquestación completa lista.
* **Fase 3 - Agentes de Telemetría (Parcial):**
  * Desarrollado el script base `agent_core.py` en Python (`psutil`, `requests`) para la extracción de CPU y RAM.
  * Validada la transmisión de telemetría local (Windows) y desplegado exitosamente el agente en el propio nodo Debian (`argus-server`) estableciendo la auto-monitorización del Control Plane.

---

## 3. Roadmap Arquitectónico (Lo que QUEDA por hacer)
El agente asistente debe guiar al usuario para completar los siguientes hitos de forma iterativa:

### Fase 1: Completar el Control Plane (Frontend)
✅ **Fase Completada:** El panel visual, el backend y la base de datos están dockerizados, conectados y funcionando en tiempo real en el nodo central.

### Fase 3: Despliegue Cloud (Azure) y Agentes
1. Levantar la infraestructura en Azure: 1 VM Ubuntu, 1 VM Windows Server, 1 VM Alpine (Generador de tráfico).
2. Unir estas máquinas a la red Tailscale.
3. Desplegar el script agente (ya desarrollado localmente) en estas máquinas para que inyecten telemetría continua al Nodo Central.

### Fase 4: Lógica de Alertas (Argus Eyes)
1. Programar la lógica en el backend que evalúe continuamente los datos de InfluxDB frente a umbrales de seguridad.
2. Probar un escenario de mitigación real: Detectar alto consumo o intrusión y enviar un comando de apagado de emergencia (vía API de Azure utilizando los paquetes ya instalados `azure-mgmt-compute` y `azure-identity`).

---
**FIN DEL CONTEXTO.** *Instrucción para el Agente: Utiliza toda esta información para dar respuestas contextualizadas, precisas y enfocadas en la arquitectura definida cuando el usuario pida código, configuraciones o troubleshooting.*
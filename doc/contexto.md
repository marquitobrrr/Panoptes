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
Hasta este momento, hemos consolidado la capa base (Infraestructura y Orquestación) en el **Nodo Central (On-Premises)**.

* **Sistema Operativo:** Debian 13 (Trixie) Minimal/Headless instalado y securizado.
* **Red (Dual-NIC resuelta):** * `ens32` (NAT): Salida a Internet y futura conexión a APIs (DHCP).
  * `ens34` (Host-Only): Interfaz de administración local aislada. Configurada con IP estática `192.168.245.10` para acceso SSH directo desde el equipo host.
* **Motor de Contenedores:** Instalado Docker CE v29.5 (oficial), incluyendo integración nativa de `docker compose` y el motor de compilación `BuildKit`. Usuario administrador añadido al grupo `docker`.
* **Estructura del Repositorio:** Creadas las carpetas `frontend/`, `backend/` y `database_data/`.
* **Prueba de Concepto (PoC) del Stack:** * Se ha creado un `docker-compose.yml` base definiendo la red `argus-network` (bridge).
  * Se ha levantado un contenedor `frontend` temporal usando `nginx:alpine` y un `index.html` estático para validar la redirección de puertos (Puerto 80 expuesto y funcionando).
* **Entorno de Desarrollo:** IDE (Antigravity) configurado con git local, enrutamiento automático de imágenes a la carpeta `/caps/` y soporte Markdown completo.

---

## 3. Roadmap Arquitectónico (Lo que QUEDA por hacer)
El agente asistente debe guiar al usuario para completar los siguientes hitos de forma iterativa:

### Fase 1: Completar el Control Plane (Backend & Base de Datos)
1. **Base de Datos (InfluxDB):** Añadir un contenedor de InfluxDB al `docker-compose.yml` para almacenar la telemetría (Series Temporales). Configurar volúmenes persistentes en `database_data/`.
2. **Core Backend (Python/FastAPI):** * Crear el contenedor del backend.
   * Programar los endpoints REST para recibir los JSON de los agentes.
   * Integrar el SDK de Azure (`azure-mgmt-compute`) para habilitar la ejecución de acciones remotas.
3. **Frontend Real (React):** Reemplazar el contenedor Nginx temporal por una aplicación SPA (React o Vue) que consuma la API del backend para dibujar los gráficos y alertas.

### Fase 2: Conectividad y VPN Mesh
1. Instalar y configurar **Tailscale/WireGuard** en el nodo Debian para obtener una IP de la red superpuesta (rango `100.x.x.x`).
2. Validar que el servidor puede recibir tráfico a través de esta interfaz segura.

### Fase 3: Despliegue Cloud (Azure) y Agentes
1. Levantar la infraestructura en Azure: 1 VM Ubuntu, 1 VM Windows Server, 1 VM Alpine (Generador de tráfico).
2. Unir estas máquinas a la red Tailscale.
3. Escribir los scripts agentes (Python o Bash/PowerShell) para estas máquinas, que envíen un payload JSON cada 5-10 segundos al Nodo Central.

### Fase 4: Lógica de Alertas (Argus Eyes)
1. Programar la lógica en el backend que evalúe continuamente los datos de InfluxDB.
2. Probar un escenario de mitigación: Detectar alto consumo o logs SSH fallidos y enviar comando de apagado vía API de Azure.

---
**FIN DEL CONTEXTO.** *Instrucción para el Agente: Utiliza toda esta información para dar respuestas contextualizadas, precisas y enfocadas en la arquitectura definida cuando el usuario pida código, configuraciones o troubleshooting.*
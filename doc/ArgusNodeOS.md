# ArgusNode OS

* **Argus Server:** El panel de control central (donde llega toda la información).
* **ArgusNode OS:** El pequeño software (agente) que se instala en cada máquina de la red para que recolecte los logs, el uso de CPU, RAM, etc.
* **Argus Eyes:** El sistema de alertas que genera avisos ante fallos.

---

## Arquitectura detallada

### 1. El Inventario de Máquinas (Nodos)
* **Nodo Central (On-Premises):**
    * **1 Máquina Física o VM con Debian 13:** Es el nodo "Argus". En este entorno se ejecuta Docker con el contenedor de ArgusNode OS. Debe contar con visibilidad de la red local y acceso a Internet.
* **Nodos Remotos (Azure Cloud):**
    * **1 VM Windows Server (Argus-Win-01):** Fundamental para monitorizar el consumo de recursos (CPU, RAM, Red) y demostrar las capacidades del agente multiplataforma.

### 2. ¿Cómo se logra la "Modalidad Híbrida"?
**VPN Mesh (Tailscale o WireGuard):** Implementado en todas las máquinas. Esto crea una red privada virtual donde todas las máquinas (Azure y Debian) se comunican como si estuvieran en el mismo switch local, con IPs privadas seguras.

### 3. Flujo de Datos (El "Sistema de Vigilancia")
Para que ArgusNode OS funcione, el planteamiento debe ser *Push*:
* **Agente Local:** En la máquina de Azure, se instala un script (agente) que recolecta los datos.
* **Envío:** El agente envía un JSON de forma periódica hacia la API del contenedor en Debian a través de la VPN.
* **Acción Remota:** Para el encendido/apagado de Azure, la aplicación utiliza la Azure SDK (Python/JS) con una clave de API (Service Principal). Así, desde el panel local, se envía una orden que viaja a la API de Microsoft para gestionar la máquina.

### 4. Resumen de Stack Tecnológico
* **Orquestación:** Docker & Docker Compose.
* **Comunicación:** WireGuard (VPN) + HTTPS.
* **Backend:** Python (FastAPI) para gestionar las políticas y recibir métricas.
* **Gestión de Azure:** Azure CLI / SDK.

---

## DESGLOSE TÉCNICO DEL NODO CENTRAL: MÁQUINA ARGUS

El Nodo Central, bautizado como Argus, actúa como el cerebro orquestador de la infraestructura híbrida de observabilidad y cumplimiento. Su función principal es centralizar la ingesta de telemetría, procesar las políticas de control en tiempo real, servir la interfaz gráfica de administración y coordinar las acciones de automatización tanto locales como multicloud (vía API de Azure).

A continuación, se detallan los componentes de infraestructura, red y software que conforman este nodo.

### 1. Especificaciones del Sistema Operativo Base
* **Distribución:** Debian GNU/Linux 13 (Trixie) - Rama Stable.
* **Memoria:** 8 GB.
* **Procesador:** 2 Núcleos, 2 Hilos.
* **Adaptadores:** 2.
  
* **Tipo de Instalación:** Minimal (Netinstall), sin entorno gráfico (Headless Server).
  
* **Propósito de Seguridad (Hardening):** Al prescindir de un servidor X11/Wayland y entornos de escritorio (GNOME, KDE), se reduce drásticamente la superficie de ataque (superficie de exposición de vulnerabilidades) y se optimiza el consumo de recursos de computación. El sistema operativo en reposo consume aproximadamente ~150 MB - 200 MB de memoria RAM.
* **Servicios Base del Sistema:** Servidor OpenSSH (`sshd`) endurecido y utilidades del sistema estándar (`curl`, `wget`, `nano`).

### 2. Arquitectura de Red y Segmentación de Interfaces (Dual-NIC)
Para garantizar la resiliencia en la conectividad de la red y securizar el acceso de administración, el nodo Argus implementa una configuración de Doble Tarjeta de Red Virtual (Dual-NIC) a nivel de hipervisor, complementada con una interfaz virtual de VPN:

1.  **Interfaz WAN / Internet (`ens32`):** Proporciona salida dedicada a Internet para la máquina virtual. Permite la actualización de paquetes, la descarga de dependencias del motor Docker y la comunicación saliente hacia el Azure Resource Manager API para la orquestación multicloud (encendido/apagado de nodos remotos).
2.  **Interfaz de Administración Local (`ens34`):** Segmento de red aislado de tipo Host-Only (Solo Anfitrión). Establece un canal de comunicación directo y permanente entre el terminal físico del administrador y el servidor Debian. Al no poseer Gateway, se evitan conflictos en la tabla de enrutamiento del núcleo de Linux, forzando a que todo el tráfico de internet fluya estrictamente por `ens32`.
3.  **Interfaz Virtual VPN Mesh (`tailscale0`):** Interfaz de red superpuesta (overlay network) gestionada por Tailscale sobre el protocolo WireGuard. Permite la comunicación segura extremo a extremo con los nodos cloud en Azure, saltándose las restricciones de cortafuegos y tablas NAT de la red. Tailscale asigna una IP global privada (`100.x.x.x`) al nodo Debian, garantizando acceso SSH directo y seguro sin requerir enrutamiento complejo o apertura de puertos.
  
### 3. Capa de Virtualización y Orquestación de Servicios (Docker Stack)
La suite de servicios de ArgusNode OS se despliega de forma modular mediante contenedores utilizando Docker Engine y orquestada localmente a través de Docker Compose. Esto garantiza el aislamiento de dependencias y la portabilidad del Control Plane.

#### ¿Por qué esta versión de Docker?
* **Origen Oficial vs. Obsolescencia:** Se descarta el repositorio por defecto de Debian a favor del repositorio oficial de Docker Inc. Esto garantiza instalar la última versión estable (Docker CE) con todas las características modernas.
* **Integración Nativa de Compose V2:** En esta versión, Compose deja de ser un programa externo y pasa a ser un plugin integrado en el núcleo (`docker compose`). Esto lo hace mucho más rápido y eficiente gestionando la red de los contenedores.
* **Optimización con BuildKit:** El motor de compilación avanzado (BuildKit) viene activado por defecto. Permite compilar código en paralelo y utilizar caché inteligente, reduciendo drásticamente los tiempos de construcción y optimizando el consumo de CPU.
* **Seguridad y Gestión de Memoria (Cgroups v2):** Garantiza tener los últimos parches contra vulnerabilidades críticas y asegura una perfecta integración con el sistema de gestión de memoria más moderno del kernel de Linux.

#### Arquitectura de Contenedores
El stack está compuesto por tres contenedores principales interconectados en una red puente (*bridge network*) interna de Docker:

* **Contenedor 1: Frontend (Argus Webapp):** Panel de control (Dashboard) web interactivo. Renderiza en tiempo real los gráficos de consumo de hardware, alertas de seguridad lógicas (ej. alertas SIEM) y proporciona los botones de acción para activar las políticas.
* **Contenedor 2: Core Backend & Policy Engine:** El motor lógico del sistema. Expone endpoints RESTful para recibir la telemetría cifrada entrante desde la VPN. Alberga el Policy Engine, que evalúa las métricas frente a umbrales configurados para disparar remediaciones automatizadas (ej. enviar comandos de apagado fuera de banda a Azure).
* **Contenedor 3: Base de Datos de Telemetría (Database):** InfluxDB (Base de datos de series temporales - TSDB). Almacenamiento optimizado de las métricas de monitoreo indexadas por marcas de tiempo (timestamps).
  
## 4. Despliegue de la Fase 1: Control Plane (Backend & DB)

Una vez garantizada la conectividad remota segura mediante la VPN Mesh de Tailscale, el siguiente paso crítico en la arquitectura de ArgusNode OS es el despliegue del **Control Plane**. Este despliegue se ha orquestado íntegramente mediante contenedores Docker en el nodo Debian.

### 4.1. Archivo de Orquestación: `docker-compose.yml`

Este archivo YAML actúa como la plantilla declarativa que Docker Engine utiliza para levantar, conectar y gestionar el ciclo de vida de los servicios:
* **Servicio `influxdb`:** Instancia la imagen oficial de InfluxDB. Se expone el puerto TCP `8086` para permitir consultas a la API y se declara un volumen local (`./database_data:/var/lib/influxdb2`) para garantizar la persistencia de la telemetría.
* **Servicio `backend`:** Instruye a Docker para compilar la aplicación a partir del directorio `./backend`. El montaje del volumen (`./backend/app:/app`) implementa el patrón de **Hot-Reload** (recarga en caliente).
* **Red `argus-network`:** Crea una red en puente virtual (*bridge network*) aislada. Esto proporciona resolución DNS interna.

### 4.2. Entorno del Backend: `Dockerfile` y Dependencias

El backend de ArgusNode OS, que alberga el motor lógico Argus Eyes, está desarrollado en Python. Para garantizar su portabilidad, el entorno de ejecución inmutable se define mediante un `Dockerfile`.

**A. El archivo `Dockerfile`**

* Emplea `python:3.11-slim` como imagen base, lo cual minimiza el tamaño del contenedor y reduce drásticamente la superficie de exposición a vulnerabilidades.
* Optimiza el tiempo de construcción aprovechando la caché de capas (*layer caching*) de Docker.
* Define `uvicorn`, un servidor web asíncrono compatible con el estándar ASGI, como el proceso principal.

**B. El archivo de dependencias (`requirements.txt`)**

Define estrictamente las librerías necesarias para la lógica de negocio y la integración Cloud:
* **`fastapi` y `uvicorn`:** Conforman el framework web de alto rendimiento necesario para la ingesta concurrente de telemetría.
* **`pydantic`:** Aplica validación estructural y de tipos a los JSON entrantes, protegiendo al motor lógico de *payloads* malformados.
* **`influxdb-client`:** El SDK nativo optimizado para la escritura masiva de series temporales.
* **`azure-mgmt-compute` y `azure-identity`:** SDKs oficiales de Microsoft Azure. Resultan esenciales para la mitigación activa de amenazas, permitiendo acciones *out-of-band* como el aislamiento o apagado de instancias.

### 4.3. Motor Lógico Inicial: `main.py`

Este archivo conforma el punto de entrada principal (API Gateway) del backend.

* **Modelo Pydantic (`Telemetry`):** Establece el esquema estricto de validación. Si un script agente despliega un JSON carente de atributos críticos (como el `node_id` o el `cpu_usage`), FastAPI devuelve un código HTTP 422 (Unprocessable Entity) automáticamente.
* **Endpoint de estado (`GET /health`):** Implementa el patrón de diseño *Healthcheck*, proporcionando una ruta eficiente para que los administradores verifiquen la disponibilidad del sistema.
* **Endpoint de ingesta (`POST /api/telemetry`):** Representa el núcleo del modelo *Push* de la arquitectura. Funciona como el sumidero de datos al cual los nodos distribuidos reportan su estado.

### 4.4. Agente de Telemetría (Espionaje Forense)

Para que el modelo *Push* funcione, se requiere un software cliente desplegado en las máquinas objetivo (Target Machines). Este script (`agent_core.py`) actúa como un espía silencioso recolectando información vital.

* **Uso de `psutil`:** Permite extraer el consumo de CPU, la memoria RAM, e incluso iterar sobre los procesos activos para determinar el Top 5 de aplicaciones que más recursos consumen (ideal para detectar mineros de criptomonedas o ransomware).
* **Análisis de Red:** Calcula los bytes enviados y recibidos entre ciclos para establecer la tasa de transferencia (MB/s) en tiempo real.

## 5. Fase 2: Dashboard React y "Argus Eyes" SIEM

Una vez que la telemetría fluye hacia el servidor Debian y se almacena en InfluxDB, se desarrolló un Panel de Control en el frontend utilizando React.js y Vite.

La interfaz gráfica implementa un sistema de diseño *Dark Mode* avanzado, ofreciendo a los administradores una vista consolidada de la red híbrida. A nivel funcional, el Frontend expone:
* **Filtros Dinámicos:** Capacidad de buscar nodos específicos por IP o filtrar por Sistema Operativo.
* **Métricas Avanzadas:** Al expandir un nodo, se exponen visualmente las estadísticas de red y tabla de procesos principales.

### 5.1. El Motor SIEM (Argus Eyes)
Para evitar que un operador deba observar constantemente las gráficas, se implementó el motor *Argus Eyes* en el backend, el cual evalúa umbrales dinámicos.

* Si la máquina supera el 85% de CPU/RAM o excede los límites de red, el motor genera instantáneamente un evento de seguridad (Alerta).
* El Frontend cuenta con una pestaña dedicada "Alertas SIEM" para gestionar (Fijar, Archivar, Papelera) estos eventos de intrusión, siguiendo los estándares de los Centros de Operaciones de Seguridad (SOC).

## 6. Fase 3: Mitigación Out-of-Band (Aislamiento Cloud)

Al operar en un entorno Híbrido apoyado en la nube (Azure), ArgusNode OS puede realizar remediaciones físicas, superando las limitaciones tradicionales de los agentes instalados en el sistema operativo.

* **Botón de Pánico (AISLAR):** En caso de detectar un compromiso crítico (ej. infección por ransomware), el analista SOC puede aislar la máquina.
* **Gestión Fuera de Banda:** El backend emite un comando nativo (ej. `az vm deallocate`) directo al hipervisor de Microsoft. Esto corta físicamente la red virtual y detiene el cómputo de la máquina virtual infectada, mitigando la amenaza al instante.

## 7. Fase 4: Módulo Ofensivo Command and Control (C2)

Para demostrar capacidades de *Red Teaming*, el panel de ArgusNode OS se dotó de un Centro de Órdenes (C2). Dado que los firewalls de las redes modernas bloquean las conexiones entrantes hacia los nodos, se implementó una arquitectura de conexión saliente o *Polling / Beaconing*.

* **Beaconing:** El agente consulta periódicamente al servidor central si existen comandos pendientes en la cola para su ID de nodo.
* **Ejecución Nativa:** Al recibir una orden, el agente utiliza el submódulo `os` para lanzar comandos nativos del SO, logrando una Ejecución Remota de Código (RCE).
* El panel web permite enviar comandos ofensivos como: Apagar, Reiniciar, Bloquear Pantalla, Purgar DNS, y Matar Procesos específicos.

## 8. Fase 5: Stealth y Persistencia de Malware (Red Teaming)

El clímax de la arquitectura ofensiva se alcanza con el despliegue del módulo de Persistencia. Al enviar el comando de `persistencia` desde el C2, el agente ejecuta rutinas propias de Amenazas Persistentes Avanzadas (APT).

* **Evasión (Stealth):** El script se copia a sí mismo instalándose silenciosamente en una carpeta profunda del sistema (AppData). Al usar un nombre camuflado, reduce las probabilidades de detección por parte de un administrador inexperto.
* **Persistencia en el Registro (Windows):** Utilizando la librería `winreg`, el script inyecta la nueva ruta en la clave de auto-arranque `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`.
* Este mecanismo garantiza que, aunque el sistema se reinicie o el usuario cierre la sesión, el agente volverá a contactar con el C2 de ArgusNode OS indefinidamente.

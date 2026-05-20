# ArgusNode OS

* **Argus Server:** El panel de control central (donde llega toda la información).
* **ArgusNode OS:** El pequeño software (agente) que instalas en cada máquina de la red para que recolecte los logs, el uso de CPU, RAM, etc.
* **Argus Eyes:** El sistema de alertas que te avisa cuando algo falla.

---

## Arquitectura detallada

### 1. El Inventario de Máquinas (Nodos)
* **Nodo Central (On-Premises):**
    * **1 Máquina Física o VM con Debian 13:** Es tu "Argus". Aquí corre Docker con el contenedor de ArgusNode OS. Debe tener visibilidad de tu red local y acceso a Internet.
* **Nodos Remotos (Azure Cloud):**
    * **1 VM Linux (Ubuntu Server):** Para monitorizar servicios web, uso de CPU y logs de SSH.
    * **1 VM Windows Server (Core o con GUI):** Fundamental para demostrar que tu app es multiplataforma (monitoreo de servicios de Windows, consumo de RAM).
    * **1 VM Linux (Ligera/Alpine):** Actuando como un "atacante" o generador de tráfico para probar tus alertas de red.

### 2. ¿Cómo logramos la "Modalidad Híbrida"?
**VPN Mesh (Tailscale o WireGuard):** Implementado en todas las máquinas. Esto crea una red privada virtual donde todas las máquinas (Azure y Debian) se ven como si estuvieran en el mismo switch local, con IPs privadas seguras.

### 3. Flujo de Datos (El "Sistema de Vigilancia")
Para que ArgusNode OS funcione, el planteamiento debe ser *Push*:
* **Agente Local:** En cada máquina de Azure, instalas un pequeño script (agente) que recolecta los datos.
* **Envío:** El agente envía un JSON cada 5 o 10 segundos hacia la API de tu contenedor en Debian a través de la VPN.
* **Acción Remota:** Para el encendido/apagado de Azure, tu app usará la Azure SDK (Python/JS) con una clave de API (Service Principal). Así, desde tu panel local, mandas una orden que viaja a la API de Microsoft y apaga la máquina.

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
* **Distribución:**
    * Debian GNU/Linux 13 (Trixie) - Rama Stable.
    * Memoria: 8 GB.
    * Procesador: 2 Núcleos, 2 Hilos.
    * Adaptadores: 2.
    ![alt text](image.png)
* **Tipo de Instalación:** Minimal (Netinstall), sin entorno gráfico (Headless Server).
* **Propósito de Seguridad (Hardening):** Al prescindir de un servidor X11/Wayland y entornos de escritorio (GNOME, KDE), se reduce drásticamente la superficie de ataque (superficie de exposición de vulnerabilidades) y se optimiza el consumo de recursos de computación. El sistema operativo en reposo consume aproximadamente ~150 MB - 200 MB de memoria RAM.
* **Servicios Base del Sistema:** Servidor OpenSSH (`sshd`) endurecido y utilidades del sistema estándar (`curl`, `wget`, `nano`).

### 2. Arquitectura de Red y Segmentación de Interfaces (Dual-NIC)
Para garantizar la resiliencia en la conectividad del centro docente y securizar el acceso de administración, el nodo Argus implementa una configuración de Doble Tarjeta de Red Virtual (Dual-NIC) a nivel de hipervisor, complementada con una interfaz virtual de VPN:

1.  **Interfaz WAN / Internet (`ens32`):**
    * **Configuración:** Dinámica (DHCP a través de mecanismo NAT del hipervisor).
    * **Función:** Proporcionar salida dedicada a Internet para la máquina virtual. Permite la actualización de paquetes, la descarga de dependencias del motor Docker y, críticamente, la comunicación saliente hacia el Azure Resource Manager API para la orquestación multicloud (encendido/apagado de nodos remotos).
2.  **Interfaz de Administración Local (`ens34`):**
    * **Configuración:** Estática (`192.168.100.10/24`). Sin Puerta de Enlace (No Gateway). *(Nota de despliegue real: Configurada como `192.168.245.10` en el entorno actual).*
    * **Función:** Segmento de red aislado de tipo Host-Only (Solo Anfitrión). Establece un canal de comunicación directo y permanente entre el terminal físico del administrador (portátil) y el servidor Debian. Al no poseer Gateway, se evitan conflictos en la tabla de enrutamiento del núcleo de Linux, forzando a que todo el tráfico de internet fluya estrictamente por `ens32`.
3.  **Interfaz Virtual VPN Mesh (`tailscale0`):**
    * **Configuración:** Estática Global Privada (Rango CGNAT 100.x.x.x).
    * **Función:** Interfaz de red superpuesta (overlay network) gestionada por Tailscale sobre el protocolo WireGuard. Permite la comunicación segura extremo a extremo con los nodos cloud en Azure, saltándose las restricciones de cortafuegos y tablas NAT del enrutador del centro docente.

### 3. Capa de Virtualización y Orquestación de Servicios (Docker Stack)
La suite de servicios de ArgusNode OS se despliega de forma modular mediante contenedores utilizando Docker Engine y orquestada localmente a través de Docker Compose. Esto garantiza el aislamiento de dependencias y la portabilidad del Control Plane.

#### ¿Por qué esta versión de Docker?
* **Origen Oficial vs. Obsolescencia:** Se descarta el repositorio por defecto de Debian (que congela versiones durante años) a favor del repositorio oficial de Docker Inc. Esto garantiza instalar la última versión estable (Docker CE) con todas las características modernas.
* **Integración Nativa de Compose V2:** En esta versión, Compose deja de ser un programa externo y pasa a ser un plugin integrado en el núcleo (`docker compose`). Esto lo hace mucho más rápido y eficiente gestionando la red de los contenedores.
* **Optimización con BuildKit:** El motor de compilación avanzado (BuildKit) viene activado por defecto. Permite compilar código en paralelo y utilizar caché inteligente, reduciendo drásticamente los tiempos de construcción y optimizando el consumo de CPU.
* **Seguridad y Gestión de Memoria (Cgroups v2):** Garantiza tener los últimos parches contra vulnerabilidades críticas (ej. escapes de contenedores) y asegura una perfecta integración con el sistema de gestión de memoria más moderno del kernel de Linux.

#### Arquitectura de Contenedores
El stack está compuesto por tres contenedores principales interconectados en una red puente (*bridge network*) interna de Docker:

* **Contenedor 1: Frontend (Argus Webapp)**
    * **Tecnología:** React.js / Node.js.
    * **Función:** Panel de control (Dashboard) web interactivo. Renderiza en tiempo real los gráficos de consumo de hardware, alertas de seguridad lógicas (ej. alertas SIEM de logins SSH erróneos) y proporciona los botones de acción para activar las políticas.
* **Contenedor 2: Core Backend & Policy Engine**
    * **Tecnología:** Python (FastAPI o Flask) junto con el SDK oficial de Azure (`azure-mgmt-compute`).
    * **Función:** El motor lógico del sistema. Expone endpoints RESTful para recibir la telemetría cifrada entrante desde la VPN. Alberga el Policy Engine, un hilo de ejecución en segundo plano que evalúa las métricas frente a umbrales configurados para disparar remediaciones automatizadas (ej. aislar un nodo o enviar comandos de apagado fuera de banda a Azure).
* **Contenedor 3: Base de Datos de Telemetría (Database)**
    * **Tecnología:** InfluxDB (Base de datos de series temporales - TSDB).
    * **Función:** Almacenamiento optimizado de las métricas de monitoreo indexadas por marcas de tiempo (timestamps). Permite realizar consultas analíticas rápidas sobre la evolución del rendimiento de los nodos distribuidos.
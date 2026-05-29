# Guion y Escaleta de Grabación: ArgusNode OS 🎬

Este documento contiene la estructura detallada para grabar la demostración práctica (Video Pitch) de tu Trabajo de Fin de Máster. Está diseñado para durar entre 10 y 15 minutos, equilibrando la explicación técnica (enseñar el código) con el impacto visual (enseñar el panel y la infraestructura).

---

## 📅 PLANTEAMIENTO GENERAL (Tiempos Estimados)

1. **Introducción y Arquitectura (2 min):** ¿Qué es Argus y cómo está montado?
2. **Infraestructura y Redes (2 min):** El servidor local y la VPN.
3. **Paseo por el Código Clave (4 min):** Backend (FastAPI) y Agente Espía (Python).
4. **Demostración Práctica en Vivo (4 min):** Panel React, ingesta de telemetría y alertas SIEM.
5. **Mitigación y C2 (3 min):** Ejecución de persistencia y apagado del nodo.

---

## 🎥 ESCALETA DETALLADA (Qué decir y qué enseñar)

### Fase 1: Introducción (El Problema y la Solución)
* **Qué mostrar en pantalla:** Empieza mostrando el diagrama de arquitectura Mermaid que generamos (`argus_architecture_diagram.md` o el Word final).
* **Qué decir:** 
  > *"Bienvenidos a la presentación de ArgusNode OS. El problema actual de las empresas es la falta de visibilidad en entornos híbridos (servidores locales y nubes públicas). Para resolver esto, he desarrollado ArgusNode OS: una plataforma integral que unifica la monitorización, genera alertas de intrusión (SIEM) y permite ejecutar acciones ofensivas y defensivas (C2) sobre cualquier máquina, utilizando una red VPN privada y encriptada."*
* **Qué señalar:** Con el ratón, señala la parte de Azure (Nodos Remotos), la parte local (Debian) y cómo ambas están unidas por el túnel de Tailscale.

### Fase 2: Infraestructura Local (El "Cerebro")
* **Qué mostrar en pantalla:** Abre la consola de comandos de tu servidor Debian (pantalla negra).
* **Qué hacer/escribir:**
  1. Ejecuta `tailscale status` para mostrar cómo la máquina de Azure y el servidor Debian están en la misma red `100.x.x.x`.
  2. Ejecuta `docker ps` para mostrar el stack orquestado.
* **Qué decir:** 
  > *"El núcleo del sistema reside en un servidor headless Debian 13 en modo local. Todo el Control Plane está orquestado con Docker. Como podéis ver, tenemos 3 contenedores corriendo: La base de datos InfluxDB, el Backend en FastAPI y el Frontend en React. Además, observamos que estamos conectados por Tailscale, lo que nos permite hablar con la máquina en Azure sin abrir un solo puerto en el firewall perimetral."*

### Fase 3: El Código del Agente (El "Espía")
* **Qué mostrar en pantalla:** Abre VS Code. Entra al archivo `/argus-node/agents/agent_core.py`.
* **Qué señalar:**
  1. **Líneas de recolección de RAM/CPU:** Selecciona o haz scroll por la función `get_system_metrics()` donde usas la librería `psutil`.
  2. **Bloque de Persistencia:** Ve a la función `install_persistence()` y señala las líneas de `winreg`.
* **Qué decir:** 
  > *"Para extraer los datos, he programado un agente ligero en Python que se instala en los nodos remotos. Aquí vemos cómo utiliza la librería `psutil` para leer los recursos del sistema en tiempo real. Más abajo, he implementado técnicas de Red Teaming: este bloque inyecta una clave en el Registro de Windows (RegEdit) para lograr persistencia, garantizando que el agente vuelva a arrancar aunque el administrador reinicie el servidor atacado."*

### Fase 4: El Código del Backend (El "Motor SIEM")
* **Qué mostrar en pantalla:** Sigue en VS Code. Abre el archivo `/argus-node/backend/app/main.py`.
* **Qué señalar:**
  1. **Esquema Pydantic:** Señala la clase `class Telemetry(BaseModel):` al principio.
  2. **Lógica SIEM:** Ve al bloque dentro del endpoint POST que evalúa `if payload.cpu_usage > 85.0`.
* **Qué decir:** 
  > *"En el backend he utilizado FastAPI. Algo fundamental para la seguridad de la plataforma es la validación estricta de datos utilizando Pydantic; si un atacante intenta mandar un JSON malicioso, la API lo rechaza automáticamente. Además, aquí reside el motor SIEM (Argus Eyes): como veis en estas líneas, si la máquina supera el 85% de CPU, el sistema intercepta el evento y dispara una alerta crítica antes incluso de guardar el dato en InfluxDB."*

### Fase 5: Demostración en Vivo (El Dashboard)
* **Qué mostrar en pantalla:** Abre el navegador web y entra al panel de ArgusNode OS (`http://100.115.255.119:5173`).
* **Qué hacer:**
  1. Muestra la pestaña **"Visión General"**. Haz clic en la tarjeta del nodo Windows (`Argus-Win-01`) para que se expanda y se vean los gráficos moviéndose en tiempo real.
  2. Cambia a la pestaña **"Alertas SIEM"**.
* **Qué decir:** 
  > *"Toda esta arquitectura converge en este panel desarrollado en ReactJS. Aquí estamos recibiendo la telemetría cifrada directamente desde la nube de Azure en tiempo real. Podemos ver el consumo exacto y los procesos de la máquina Windows. Si nos vamos a la pestaña de Alertas SIEM, veremos registradas las anomalías que el motor del backend ha capturado de forma automática."*

### Fase 6: Mitigación (C2 y Acción Out-of-Band)
* **Qué mostrar en pantalla:** Ve a la pestaña **"Centro de Órdenes (C2)"**.
* **Qué hacer:**
  1. Selecciona la máquina de Azure.
  2. Haz clic en el botón rojo de "Aislar Máquina" o envía un comando de "Persistencia". *(Nota: Si la máquina de Azure está encendida y quieres demostrar el apagado real por API, ¡hazlo! Es el momento estrella).*
* **Qué decir:** 
  > *"Para concluir, ArgusNode OS no es solo una herramienta de lectura, sino de control activo. Desde el Centro de Órdenes (C2) podemos enviar comandos remotos (RCE) a los agentes. Y en caso de un incidente grave de ransomware, al estar integrados con la SDK de Microsoft Azure, puedo aislar y desasignar la máquina virtual directamente desde el hipervisor de la nube con un solo clic. Gracias a esto, la amenaza queda neutralizada en cuestión de segundos."*

---

## 💡 CONSEJOS PARA LA GRABACIÓN
- **Graba la pantalla completa** (puedes usar OBS Studio o la herramienta recortes de Windows).
- **Ten todos los programas abiertos:** Antes de darle a grabar, ten abierta la terminal de Debian, el VS Code con los archivos ya seleccionados y el Panel Web cargado en Chrome.
- **Transiciones fluidas:** Al saltar de un programa a otro, hazlo despacio (usa `Alt + Tab`).
- **Prueba de fuego (Opcional pero espectacular):** Si en la fase final le das al botón de "Aislar/Apagar" y muestras cómo la máquina en tu portal de Azure pasa a estado "Detenida (Desasignada)", el tribunal del TFM se quedará con la boca abierta.

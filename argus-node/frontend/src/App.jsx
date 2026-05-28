import { useState, useEffect } from 'react'
import './index.css'

function App() {
  const [telemetry, setTelemetry] = useState(null)
  
  // Efecto que lee datos reales del backend cada 2 segundos
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        // En un entorno de producción, la IP no debe estar hardcodeada,
        // pero para nuestro servidor local Debian de TFM en la VPN Tailscale usamos esta:
        const response = await fetch('http://100.115.255.119:8000/api/telemetry/latest')
        const data = await response.json()
        
        // Data es un array de nodos. Por ahora cogemos el primero (si hay)
        if (data && data.length > 0) {
          setTelemetry({
            node_id: data[0].node_id || 'Unknown',
            os_type: data[0].os_type || 'Unknown',
            cpu_usage: Math.round(data[0].cpu_usage) || 0,
            ram_usage: Math.round(data[0].ram_usage) || 0,
          })
        }
      } catch (error) {
        console.error("Error fetching telemetry:", error)
      }
    }

    // Llamar inmediatamente y luego cada 2 segundos
    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 2000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="dashboard-container">
      <nav className="sidebar">
        <div className="logo-area">
          <div className="logo-orb"></div>
          <h1>ArgusNode OS</h1>
        </div>
        <ul className="nav-links">
          <li className="active">Visión General</li>
          <li>Nodos Activos</li>
          <li>Alertas SIEM</li>
          <li>Ajustes</li>
        </ul>
      </nav>

      <main className="main-content">
        <header className="topbar">
          <h2>Panel de Control Híbrido</h2>
          <div className="status-badge pulse-green">
            Sistema Operativo
          </div>
        </header>

        <section className="metrics-grid">
          {/* Tarjeta CPU */}
          <div className="metric-card glass-panel">
            <div className="card-header">
              <h3>Uso de CPU</h3>
              <span className="node-badge">Nodo Central</span>
            </div>
            <div className="metric-value">
              {telemetry ? `${telemetry.cpu_usage}%` : '--%'}
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: telemetry ? `${telemetry.cpu_usage}%` : '0%' }}>
              </div>
            </div>
          </div>

          {/* Tarjeta RAM */}
          <div className="metric-card glass-panel">
            <div className="card-header">
              <h3>Uso de RAM</h3>
              <span className="node-badge">Nodo Central</span>
            </div>
            <div className="metric-value">
              {telemetry ? `${telemetry.ram_usage}%` : '--%'}
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill ram-fill" 
                style={{ width: telemetry ? `${telemetry.ram_usage}%` : '0%' }}>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App

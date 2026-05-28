import { useState, useEffect } from 'react'
import './index.css'

function App() {
  const [telemetry, setTelemetry] = useState(null)
  
  // En la Fase final, esto atacará al backend de Python
  // Por ahora, simulamos datos entrantes para poder diseñar el panel
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry({
        node_id: 'ARGUS-SERVER-CORE',
        os_type: 'Linux',
        cpu_usage: Math.floor(Math.random() * (40 - 10 + 1) + 10), // Random 10-40%
        ram_usage: Math.floor(Math.random() * (70 - 60 + 1) + 60), // Random 60-70%
      })
    }, 2000)
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

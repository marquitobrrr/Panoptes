import { useState, useEffect } from 'react'
import './index.css'

function App() {
  const [telemetry, setTelemetry] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [activeTab, setActiveTab] = useState('vision-general')
  
  // Efecto que lee datos reales del backend cada 2 segundos
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://100.115.255.119:8000/api/telemetry/latest')
        const data = await response.json()
        
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

    const fetchAlerts = async () => {
      try {
        const response = await fetch('http://100.115.255.119:8000/api/alerts')
        const data = await response.json()
        setAlerts(data)
      } catch (error) {
        console.error("Error fetching alerts:", error)
      }
    }

    const fetchAll = () => {
      fetchTelemetry()
      fetchAlerts()
    }

    fetchAll()
    const interval = setInterval(fetchAll, 2000)
    
    return () => clearInterval(interval)
  }, [])

  // Efecto para actualizar dinámicamente el título de la pestaña
  useEffect(() => {
    const titles = {
      'vision-general': 'ArgusNode OS | Visión General',
      'nodos': 'ArgusNode OS | Inventario de Nodos',
      'alertas': 'ArgusNode OS | Alertas SIEM',
      'ajustes': 'ArgusNode OS | Configuración',
    }
    document.title = titles[activeTab] || 'ArgusNode OS'
  }, [activeTab])

  // VISTAS
  const renderVisionGeneral = () => (
    <section className="metrics-grid">
      <div className="metric-card glass-panel">
        <div className="card-header">
          <h3>Carga de Procesador (CPU)</h3>
          <span className="node-badge">{telemetry ? telemetry.node_id : 'Sin conexión'}</span>
        </div>
        <div className="metric-value">
          {telemetry ? `${telemetry.cpu_usage}%` : '--%'}
        </div>
        <div className="progress-bar-bg">
          <div 
            className={`progress-bar-fill ${telemetry && telemetry.cpu_usage > 85 ? 'danger-fill' : ''}`} 
            style={{ width: telemetry ? `${telemetry.cpu_usage}%` : '0%' }}>
          </div>
        </div>
      </div>

      <div className="metric-card glass-panel">
        <div className="card-header">
          <h3>Memoria Volátil (RAM)</h3>
          <span className="node-badge">{telemetry ? telemetry.node_id : 'Sin conexión'}</span>
        </div>
        <div className="metric-value">
          {telemetry ? `${telemetry.ram_usage}%` : '--%'}
        </div>
        <div className="progress-bar-bg">
          <div 
            className={`progress-bar-fill ram-fill ${telemetry && telemetry.ram_usage > 90 ? 'danger-fill' : ''}`} 
            style={{ width: telemetry ? `${telemetry.ram_usage}%` : '0%' }}>
          </div>
        </div>
      </div>
    </section>
  )

  const renderAlertas = () => (
    <section className="alerts-container glass-panel">
      <div className="alerts-header">
        <h3>Motor Argus Eyes: Registro de Incidentes</h3>
        <span className="alert-count">{alerts.length} Eventos</span>
      </div>
      
      {alerts.length === 0 ? (
        <div className="no-alerts">
          <div className="shield-icon">🛡️</div>
          <p>La infraestructura opera dentro de los parámetros de seguridad. No hay anomalías.</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert-item ${alert.severity.toLowerCase()}`}>
              <div className="alert-severity-indicator"></div>
              <div className="alert-content">
                <div className="alert-meta">
                  <span className="alert-node">{alert.node_id}</span>
                  <span className="alert-time">{alert.timestamp}</span>
                </div>
                <div className="alert-message">
                  <strong>[{alert.severity}]</strong> {alert.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  const renderConstruccion = (titulo) => (
    <section className="glass-panel text-center padding-large">
      <h3 style={{color: 'var(--text-secondary)'}}>Módulo: {titulo}</h3>
      <p style={{marginTop: '1rem', color: 'var(--text-muted)'}}>
        Este componente se encuentra actualmente en desarrollo y se habilitará en las siguientes fases de la integración de ArgusNode OS.
      </p>
    </section>
  )

  return (
    <div className="dashboard-container">
      <nav className="sidebar">
        <div className="logo-area">
          <img src="/logo.jpg" alt="ArgusNode OS Logo" className="sidebar-logo" />
        </div>
        <ul className="nav-links">
          <li 
            className={activeTab === 'vision-general' ? 'active' : ''} 
            onClick={() => setActiveTab('vision-general')}
          >
            Visión General
          </li>
          <li 
            className={activeTab === 'nodos' ? 'active' : ''} 
            onClick={() => setActiveTab('nodos')}
          >
            Inventario Nodos
          </li>
          <li 
            className={activeTab === 'alertas' ? 'active' : ''} 
            onClick={() => setActiveTab('alertas')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>Alertas SIEM</span>
            {alerts.length > 0 && (
              <span className="badge-pill">{alerts.length}</span>
            )}
          </li>
          <li 
            className={activeTab === 'ajustes' ? 'active' : ''} 
            onClick={() => setActiveTab('ajustes')}
          >
            Configuración
          </li>
        </ul>
        
        <div className="sidebar-footer">
          <p>ArgusNode Security</p>
          <p className="version">v1.2.0 - Enterprise</p>
        </div>
      </nav>

      <main className="main-content">
        <header className="topbar">
          <h2>Centro de Operaciones Híbrido</h2>
          <div className="status-badge pulse-green">
            SOC Online
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'vision-general' && renderVisionGeneral()}
          {activeTab === 'alertas' && renderAlertas()}
          {activeTab === 'nodos' && renderConstruccion('Inventario de Nodos Activos')}
          {activeTab === 'ajustes' && renderConstruccion('Configuración del Policy Engine')}
        </div>
      </main>
    </div>
  )
}

export default App

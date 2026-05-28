import { useState, useEffect } from 'react'
import './index.css'

function App() {
  const [telemetry, setTelemetry] = useState([])
  const [alerts, setAlerts] = useState([])
  const [activeTab, setActiveTab] = useState('vision-general')
  const [mitigatingNode, setMitigatingNode] = useState(null)
  const [mitigationResult, setMitigationResult] = useState(null)
  
  // Efecto que lee datos reales del backend cada 2 segundos
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://100.115.255.119:8000/api/telemetry/latest')
        const data = await response.json()
        
        if (data && data.length > 0) {
          setTelemetry(data.map(node => ({
            node_id: node.node_id || 'Unknown',
            os_type: node.os_type || 'Unknown',
            cpu_usage: Math.round(node.cpu_usage) || 0,
            ram_usage: Math.round(node.ram_usage) || 0,
          })))
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

  const handleMitigate = async (nodeId) => {
    if (!window.confirm(`⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás seguro de que quieres aislar el nodo ${nodeId}? Esta acción apagará el servidor en Azure.`)) {
      return;
    }
    setMitigatingNode(nodeId)
    setMitigationResult(null)
    
    try {
      const res = await fetch(`http://100.115.255.119:8000/api/mitigate/${nodeId}`, { method: 'POST' })
      const data = await res.json()
      setMitigationResult(data)
    } catch (error) {
      setMitigationResult({ status: 'error', message: 'Fallo de conexión con el Core Engine.' })
    }
    setTimeout(() => setMitigatingNode(null), 3000)
  }

  // VISTAS
  const renderVisionGeneral = () => {
    // Calculamos la media de CPU y RAM de toda la infraestructura
    const totalCpu = telemetry.reduce((acc, node) => acc + node.cpu_usage, 0)
    const totalRam = telemetry.reduce((acc, node) => acc + node.ram_usage, 0)
    const avgCpu = telemetry.length > 0 ? Math.round(totalCpu / telemetry.length) : 0
    const avgRam = telemetry.length > 0 ? Math.round(totalRam / telemetry.length) : 0

    return (
      <section>
        <div style={{marginBottom: '2rem'}}>
          <h3 style={{color: 'var(--text-secondary)', marginBottom: '1rem'}}>Estado Global de la Infraestructura ({telemetry.length} Nodos)</h3>
          <div className="metrics-grid">
            <div className="metric-card glass-panel">
              <div className="card-header">
                <h3>Carga de Procesador Promedio</h3>
                <span className="node-badge">Global</span>
              </div>
              <div className="metric-value">
                {telemetry.length > 0 ? `${avgCpu}%` : '--%'}
              </div>
              <div className="progress-bar-bg">
                <div 
                  className={`progress-bar-fill ${avgCpu > 85 ? 'danger-fill' : ''}`} 
                  style={{ width: `${avgCpu}%` }}>
                </div>
              </div>
            </div>

            <div className="metric-card glass-panel">
              <div className="card-header">
                <h3>Memoria Volátil Promedio</h3>
                <span className="node-badge">Global</span>
              </div>
              <div className="metric-value">
                {telemetry.length > 0 ? `${avgRam}%` : '--%'}
              </div>
              <div className="progress-bar-bg">
                <div 
                  className={`progress-bar-fill ram-fill ${avgRam > 90 ? 'danger-fill' : ''}`} 
                  style={{ width: `${avgRam}%` }}>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const renderInventarioNodos = () => (
    <section>
      <h3 style={{color: 'var(--text-secondary)', marginBottom: '1.5rem'}}>Inventario de Nodos Híbridos Activos</h3>
      {telemetry.length === 0 ? (
        <div className="glass-panel text-center padding-large">
          <p style={{color: 'var(--text-muted)'}}>Esperando telemetría de los agentes...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {telemetry.map(node => (
            <div key={node.node_id} className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem' }}>{node.node_id}</h2>
                <span className="node-badge" style={{ backgroundColor: node.os_type.includes('Windows') ? 'rgba(0, 120, 212, 0.2)' : 'rgba(223, 72, 72, 0.2)' }}>
                  {node.os_type}
                </span>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  <span>CPU Usage</span>
                  <span style={{ color: node.cpu_usage > 85 ? 'var(--alert-critical)' : 'var(--text-primary)'}}>{node.cpu_usage}%</span>
                </div>
                <div className="progress-bar-bg" style={{ height: '6px' }}>
                  <div className={`progress-bar-fill ${node.cpu_usage > 85 ? 'danger-fill' : ''}`} style={{ width: `${node.cpu_usage}%` }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  <span>RAM Usage</span>
                  <span style={{ color: node.ram_usage > 90 ? 'var(--alert-critical)' : 'var(--text-primary)'}}>{node.ram_usage}%</span>
                </div>
                <div className="progress-bar-bg" style={{ height: '6px' }}>
                  <div className={`progress-bar-fill ram-fill ${node.ram_usage > 90 ? 'danger-fill' : ''}`} style={{ width: `${node.ram_usage}%` }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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

  const renderConfiguracion = () => (
    <section>
      <div className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid var(--alert-critical)' }}>
        <h2 style={{ color: 'var(--alert-critical)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span>🚨</span> Protocolo de Contención SIEM
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem' }}>
          Este módulo de Nivel 4 permite enviar instrucciones directas a la API de Microsoft Azure Cloud para aislar físicamente servidores comprometidos. 
          Al pulsar el Botón del Pánico, ArgusNode OS apagará el servidor de la nube inmediatamente para evitar movimiento lateral del atacante.
        </p>

        {telemetry.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No hay nodos conectados para aislar.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {telemetry.map(node => (
              <div key={node.node_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>{node.node_id}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Plataforma: {node.os_type}</span>
                </div>
                <button 
                  onClick={() => handleMitigate(node.node_id)}
                  disabled={mitigatingNode === node.node_id}
                  style={{
                    backgroundColor: mitigatingNode === node.node_id ? '#555' : 'var(--alert-critical)',
                    color: 'white',
                    border: 'none',
                    padding: '0.6rem 1.5rem',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    cursor: mitigatingNode === node.node_id ? 'wait' : 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    fontSize: '0.85rem',
                    letterSpacing: '1px'
                  }}
                >
                  {mitigatingNode === node.node_id ? 'Enviando...' : 'AISLAR NODO (Botón Pánico)'}
                </button>
              </div>
            ))}
          </div>
        )}

        {mitigationResult && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            backgroundColor: mitigationResult.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${mitigationResult.status === 'success' ? 'var(--accent-green)' : 'var(--alert-critical)'}`,
            borderRadius: '6px',
            color: mitigationResult.status === 'success' ? 'var(--accent-green)' : 'var(--alert-critical)'
          }}>
            <strong>Resultado:</strong> {mitigationResult.message}
          </div>
        )}
      </div>
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
          {activeTab === 'nodos' && renderInventarioNodos()}
          {activeTab === 'ajustes' && renderConfiguracion()}
        </div>
      </main>
    </div>
  )
}

export default App

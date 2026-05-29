import { useState, useEffect } from 'react'
import './index.css'

function App() {
  const [telemetry, setTelemetry] = useState([])
  const [alerts, setAlerts] = useState([])
  const [activeTab, setActiveTab] = useState('vision-general')
  const [mitigatingNode, setMitigatingNode] = useState(null)
  const [mitigationResult, setMitigationResult] = useState(null)
  
  // View states
  const [searchQuery, setSearchQuery] = useState('')
  const [osFilter, setOsFilter] = useState('All')
  const [expandedNode, setExpandedNode] = useState(null)
  
  // SIEM Alert states
  const [alertSearchQuery, setAlertSearchQuery] = useState('')
  const [alertOsFilter, setAlertOsFilter] = useState('All')
  const [alertParamFilter, setAlertParamFilter] = useState('All')
  const [alertView, setAlertView] = useState('active') // active, archived, trashed
  
  // C2 Command states
  const [cmdSearchQuery, setCmdSearchQuery] = useState('')
  const [cmdOsFilter, setCmdOsFilter] = useState('All')
  
  // Data polling interval
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://100.115.255.119:8000/api/telemetry/latest')
        const data = await response.json()
        
        if (data && data.length > 0) {
          setTelemetry(data.map(node => ({
            node_id: node.node_id || 'Unknown',
            os_type: node.os_type || 'Unknown',
            ip_address: node.ip_address || 'Unknown',
            cpu_usage: Math.round(node.cpu_usage) || 0,
            ram_usage: Math.round(node.ram_usage) || 0,
            temperature: node.temperature || 'N/A',
            net_upload_mbps: node.net_upload_mbps || 0,
            net_download_mbps: node.net_download_mbps || 0,
            top_processes: Array.isArray(node.top_processes) ? node.top_processes : [],
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

  // Document title sync
  useEffect(() => {
    const titles = {
      'vision-general': 'ArgusNode OS | Visión General',
      'alertas': 'ArgusNode OS | Alertas SIEM',
      'ordenes': 'ArgusNode OS | Centro de Órdenes',
    }
    document.title = titles[activeTab] || 'ArgusNode OS'
  }, [activeTab])

  const handleMitigate = async (nodeId) => {
    if (!window.confirm(`⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás seguro de que quieres aislar el nodo ${nodeId}?`)) {
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

  const handleC2Command = async (nodeId, command) => {
    if (command.includes('apagar') || command.includes('reiniciar') || command.includes('matar')) {
      if (!window.confirm(`⚠️ PELIGRO ⚠️\n\n¿Seguro que quieres enviar la orden '${command}' al nodo ${nodeId}? ¡Esto se ejecutará de verdad en la máquina!`)) {
        return;
      }
    }
    
    setMitigatingNode(`${nodeId}-${command}`)
    setMitigationResult(null)
    
    try {
      const res = await fetch(`http://100.115.255.119:8000/api/commands/${nodeId}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })
      const data = await res.json()
      setMitigationResult(data)
    } catch (error) {
      setMitigationResult({ status: 'error', message: 'Fallo de conexión con el C2.' })
    }
    setTimeout(() => setMitigatingNode(null), 3000)
  }

  const handleClearAlerts = async () => {
    if (!window.confirm("⚠️ ¿Estás seguro de que quieres mover todas las alertas activas a la papelera?")) return;
    try {
      await fetch('http://100.115.255.119:8000/api/alerts', { method: 'DELETE' })
      // Trigger a re-fetch manually or rely on the interval
    } catch (error) {
      console.error("Error clearing alerts:", error)
    }
  }

  const handleAlertAction = async (id, action) => {
    try {
      await fetch(`http://100.115.255.119:8000/api/alerts/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
    } catch (error) {
      console.error(`Error performing ${action} on alert ${id}:`, error)
    }
  }

  const handleDeletePermanent = async (id) => {
    if (!window.confirm("⚠️ Esta acción borrará permanentemente la alerta. ¿Continuar?")) return;
    try {
      await fetch(`http://100.115.255.119:8000/api/alerts/${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error("Error deleting alert permanently:", error)
    }
  }

  // Node filtering logic
  const filteredNodes = telemetry.filter(node => {
    const matchesSearch = node.node_id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          node.ip_address.includes(searchQuery);
    const matchesOs = osFilter === 'All' || node.os_type.includes(osFilter);
    return matchesSearch && matchesOs;
  })

  // View Renderers
  const renderVisionGeneral = () => {
    return (
      <section>
        {/* Control Bar */}
        <div className="controls-bar">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por Hostname o IP..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select 
            className="filter-select" 
            value={osFilter} 
            onChange={(e) => setOsFilter(e.target.value)}
          >
            <option value="All">Todos los Sistemas</option>
            <option value="Windows">Windows</option>
            <option value="Linux">Linux</option>
            <option value="Darwin">macOS</option>
          </select>
        </div>

        {/* Node Grid */}
        {filteredNodes.length === 0 ? (
          <div className="glass-panel text-center padding-large">
            <p style={{color: 'var(--text-muted)'}}>No se han encontrado nodos que coincidan con la búsqueda.</p>
          </div>
        ) : (
          <div className="nodes-grid">
            {filteredNodes.map(node => {
              const isExpanded = expandedNode === node.node_id;
              
              return (
                <div 
                  key={node.node_id} 
                  className={`glass-panel node-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => !isExpanded && setExpandedNode(node.node_id)}
                >
                  {isExpanded && (
                    <button className="close-btn" onClick={(e) => { e.stopPropagation(); setExpandedNode(null); }}>×</button>
                  )}
                  
                  {/* Node Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: isExpanded ? '1.5rem' : '1.2rem', marginBottom: '0.2rem' }}>{node.node_id}</h2>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{node.ip_address}</span>
                    </div>
                    <span className="node-badge" style={{ backgroundColor: node.os_type.includes('Windows') ? 'rgba(0, 120, 212, 0.2)' : 'rgba(16, 185, 129, 0.2)' }}>
                      {node.os_type}
                    </span>
                  </div>
                  
                  {/* Primary Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        <span>CPU</span>
                        <span style={{ color: node.cpu_usage > 85 ? 'var(--alert-critical)' : 'var(--text-primary)'}}>{node.cpu_usage}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className={`progress-bar-fill ${node.cpu_usage > 85 ? 'danger-fill' : ''}`} style={{ width: `${node.cpu_usage}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                        <span>RAM</span>
                        <span style={{ color: node.ram_usage > 90 ? 'var(--alert-critical)' : 'var(--text-primary)'}}>{node.ram_usage}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className={`progress-bar-fill ram-fill ${node.ram_usage > 90 ? 'danger-fill' : ''}`} style={{ width: `${node.ram_usage}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Metrics Panel */}
                  {isExpanded && (
                    <div className="expanded-content">
                      <div className="forensic-panel">
                        <h4>Métricas Avanzadas</h4>
                        
                        <div className="network-stats">
                          <div className="net-box">
                            <span>Subida (Upload)</span>
                            <strong>{node.net_upload_mbps} MB/s</strong>
                          </div>
                          <div className="net-box">
                            <span>Bajada (Download)</span>
                            <strong>{node.net_download_mbps} MB/s</strong>
                          </div>
                        </div>

                        <div className="net-box" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Temperatura CPU</span>
                          <strong style={{ color: node.temperature.includes('N/A') ? 'var(--text-secondary)' : 'var(--accent-green)'}}>
                            {node.temperature}
                          </strong>
                        </div>
                      </div>

                      <div className="forensic-panel">
                        <h4>Top Procesos (Consumo CPU)</h4>
                        {node.top_processes.length === 0 ? (
                          <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Cargando lista de procesos...</p>
                        ) : (
                          <table className="process-table">
                            <thead>
                              <tr>
                                <th>PID</th>
                                <th>Nombre</th>
                                <th>CPU %</th>
                                <th>RAM %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {node.top_processes.map(proc => (
                                <tr key={proc.pid}>
                                  <td style={{fontFamily: 'monospace'}}>{proc.pid}</td>
                                  <td>{proc.name}</td>
                                  <td style={{color: proc.cpu_percent > 50 ? '#ef4444' : 'inherit'}}>{proc.cpu_percent}%</td>
                                  <td>{proc.memory_percent}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  const renderAlertas = () => {
    // Filter alerts
    const filteredAlerts = alerts
      .filter(alert => (alert.status || 'active') === alertView)
      .filter(alert => {
        const matchesSearch = (alert.node_id && alert.node_id.toLowerCase().includes(alertSearchQuery.toLowerCase())) || 
                              (alert.ip_address && alert.ip_address.includes(alertSearchQuery));
        const matchesOs = alertOsFilter === 'All' || (alert.os_type && alert.os_type.includes(alertOsFilter));
        const matchesParam = alertParamFilter === 'All' || (alert.parameter && alert.parameter === alertParamFilter);
        return matchesSearch && matchesOs && matchesParam;
      })
      // Sort alerts (pinned first)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0; // In a real app we'd parse timestamps here to ensure descending order
      });

    const activeCount = alerts.filter(a => (a.status || 'active') === 'active').length;
    const trashCount = alerts.filter(a => (a.status || 'active') === 'trashed').length;

    return (
    <section className="alerts-container glass-panel">
      <div className="alerts-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1.5rem' }}>
        
        {/* Header and Global Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <h3>Motor Argus Eyes: Registro de Incidentes</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="alert-count">{filteredAlerts.length} Eventos</span>
            {alertView === 'active' && filteredAlerts.length > 0 && (
              <button 
                onClick={handleClearAlerts}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  padding: '0.4rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  fontSize: '0.85rem'
                }}
                onMouseOver={e => { e.target.style.backgroundColor = '#ef4444'; e.target.style.color = 'white'; }}
                onMouseOut={e => { e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; e.target.style.color = '#ef4444'; }}
              >
                Borrar Activas (a Papelera)
              </button>
            )}
          </div>
        </div>

        {/* State Navigation */}
        <div className="alerts-tabs" style={{ width: '100%' }}>
          <button className={`alert-tab ${alertView === 'active' ? 'active' : ''}`} onClick={() => setAlertView('active')}>
            Activas {activeCount > 0 && <span style={{marginLeft: '5px', background:'red', color:'white', padding:'2px 6px', borderRadius:'10px', fontSize:'0.7rem'}}>{activeCount}</span>}
          </button>
          <button className={`alert-tab ${alertView === 'archived' ? 'active' : ''}`} onClick={() => setAlertView('archived')}>
            Archivadas
          </button>
          <button className={`alert-tab ${alertView === 'trashed' ? 'active' : ''}`} onClick={() => setAlertView('trashed')}>
            Papelera {trashCount > 0 && `(${trashCount})`}
          </button>
        </div>

        {/* Alert Filters */}
        <div className="controls-bar" style={{ width: '100%', marginBottom: 0 }}>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar alerta por Hostname o IP..." 
            value={alertSearchQuery}
            onChange={(e) => setAlertSearchQuery(e.target.value)}
          />
          <select 
            className="filter-select" 
            value={alertOsFilter} 
            onChange={(e) => setAlertOsFilter(e.target.value)}
          >
            <option value="All">Cualquier OS</option>
            <option value="Windows">Windows</option>
            <option value="Linux">Linux</option>
          </select>
          <select 
            className="filter-select" 
            value={alertParamFilter} 
            onChange={(e) => setAlertParamFilter(e.target.value)}
          >
            <option value="All">Cualquier Parámetro</option>
            <option value="CPU">CPU</option>
            <option value="RAM">RAM</option>
            <option value="Red">Red</option>
          </select>
        </div>
      </div>
      
      {filteredAlerts.length === 0 ? (
        <div className="no-alerts">
          <div className="shield-icon">{alertView === 'trashed' ? '🗑️' : '🛡️'}</div>
          <p>{alertView === 'trashed' ? 'La papelera está vacía.' : 'La infraestructura opera dentro de los parámetros de seguridad. No hay anomalías que coincidan con la búsqueda.'}</p>
        </div>
      ) : (
        <div className="alerts-list">
          {filteredAlerts.map((alert) => (
            <div key={alert.id} className={`alert-item ${alert.severity.toLowerCase()} ${alert.pinned ? 'pinned' : ''}`}>
              <div className="alert-severity-indicator"></div>
              <div className="alert-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="alert-meta">
                    <span className="alert-node">{alert.node_id} {alert.ip_address ? `(${alert.ip_address})` : ''}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {alert.os_type && <span className="node-badge" style={{ fontSize: '0.7rem' }}>{alert.os_type}</span>}
                      {alert.parameter && <span className="node-badge" style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)' }}>{alert.parameter}</span>}
                      <span className="alert-time">{alert.timestamp}</span>
                    </div>
                  </div>
                  <div className="alert-message">
                    <strong>[{alert.severity}]</strong> {alert.message}
                  </div>
                </div>
                
                {/* Alert Actions */}
                <div className="alert-actions">
                  {(alertView === 'active' || alertView === 'archived') && (
                    <button className="action-btn pin-btn" title="Fijar" onClick={() => handleAlertAction(alert.id, 'pin')}>
                      📌
                    </button>
                  )}
                  {alertView === 'active' && (
                    <button className="action-btn" title="Archivar" onClick={() => handleAlertAction(alert.id, 'archive')}>
                      📦
                    </button>
                  )}
                  {(alertView === 'active' || alertView === 'archived') && (
                    <button className="action-btn trash-btn" title="Mover a Papelera" onClick={() => handleAlertAction(alert.id, 'trash')}>
                      🗑️
                    </button>
                  )}
                  {alertView === 'trashed' && (
                    <>
                      <button className="action-btn restore-btn" title="Restaurar" onClick={() => handleAlertAction(alert.id, 'restore')}>
                        ♻️
                      </button>
                      <button className="action-btn trash-btn" title="Destruir Permanentemente" onClick={() => handleDeletePermanent(alert.id)}>
                        ❌
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
    )
  }

  const renderOrdenes = () => {
    const filteredCmdNodes = telemetry.filter(node => {
      const matchesSearch = node.node_id.toLowerCase().includes(cmdSearchQuery.toLowerCase()) || 
                            node.ip_address.includes(cmdSearchQuery);
      const matchesOs = cmdOsFilter === 'All' || node.os_type.includes(cmdOsFilter);
      return matchesSearch && matchesOs;
    })

    return (
    <section>
      <div className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid #8b5cf6' }}>
        <h2 style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span>⚡</span> Centro de Mando y Control (C2)
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
          Módulo de nivel ofensivo. Permite enviar instrucciones de ejecución remota nativas a nivel de sistema operativo directamente al Agente Argus.
        </p>

        {/* Command Filters */}
        <div className="controls-bar" style={{ marginBottom: '2rem' }}>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar nodo por Hostname o IP..." 
            value={cmdSearchQuery}
            onChange={(e) => setCmdSearchQuery(e.target.value)}
          />
          <select 
            className="filter-select" 
            value={cmdOsFilter} 
            onChange={(e) => setCmdOsFilter(e.target.value)}
          >
            <option value="All">Todos los Sistemas</option>
            <option value="Windows">Windows</option>
            <option value="Linux">Linux</option>
          </select>
        </div>

        {filteredCmdNodes.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No hay nodos conectados que coincidan con la búsqueda.</p>
        ) : (
          <div className="nodes-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
            {filteredCmdNodes.map(node => (
              <div key={node.node_id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem' }}>{node.node_id}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{node.ip_address} | {node.os_type}</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button 
                    onClick={() => handleC2Command(node.node_id, 'apagar')}
                    disabled={mitigatingNode === `${node.node_id}-apagar`}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.target.style.background = '#ef4444'; e.target.style.color = 'white'; }}
                    onMouseOut={e => { e.target.style.background = 'rgba(239, 68, 68, 0.1)'; e.target.style.color = '#ef4444'; }}
                  >
                    ⚡ Apagar
                  </button>
                  <button 
                    onClick={() => handleC2Command(node.node_id, 'reiniciar')}
                    disabled={mitigatingNode === `${node.node_id}-reiniciar`}
                    style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.target.style.background = '#f59e0b'; e.target.style.color = 'white'; }}
                    onMouseOut={e => { e.target.style.background = 'rgba(245, 158, 11, 0.1)'; e.target.style.color = '#f59e0b'; }}
                  >
                    🔄 Reiniciar
                  </button>
                  <button 
                    onClick={() => handleC2Command(node.node_id, 'matar_programas')}
                    disabled={mitigatingNode === `${node.node_id}-matar_programas`}
                    style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.target.style.background = '#10b981'; e.target.style.color = 'white'; }}
                    onMouseOut={e => { e.target.style.background = 'rgba(16, 185, 129, 0.1)'; e.target.style.color = '#10b981'; }}
                  >
                    🛑 Matar Apps
                  </button>
                  <button 
                    onClick={() => handleC2Command(node.node_id, 'bloquear_pantalla')}
                    disabled={mitigatingNode === `${node.node_id}-bloquear_pantalla`}
                    style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid #3b82f6', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.target.style.background = '#3b82f6'; e.target.style.color = 'white'; }}
                    onMouseOut={e => { e.target.style.background = 'rgba(59, 130, 246, 0.1)'; e.target.style.color = '#3b82f6'; }}
                  >
                    🔒 Bloquear
                  </button>
                  <button 
                    onClick={() => handleC2Command(node.node_id, 'purgar_dns')}
                    disabled={mitigatingNode === `${node.node_id}-purgar_dns`}
                    style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid #a855f7', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', gridColumn: '1 / span 2' }}
                    onMouseOver={e => { e.target.style.background = '#a855f7'; e.target.style.color = 'white'; }}
                    onMouseOut={e => { e.target.style.background = 'rgba(168, 85, 247, 0.1)'; e.target.style.color = '#a855f7'; }}
                  >
                    🧹 Purgar DNS / Red
                  </button>
                  
                  {/* Persistence Injection Action */}
                  <button 
                    onClick={() => handleC2Command(node.node_id, 'persistencia')}
                    disabled={mitigatingNode === `${node.node_id}-persistencia`}
                    style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid #ec4899', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', gridColumn: '1 / span 2' }}
                    onMouseOver={e => { e.target.style.background = '#ec4899'; e.target.style.color = 'white'; }}
                    onMouseOut={e => { e.target.style.background = 'rgba(236, 72, 153, 0.1)'; e.target.style.color = '#ec4899'; }}
                  >
                    🕷️ Instalar Persistencia
                  </button>
                  
                  {/* Isolation Action */}
                  <button 
                    onClick={() => handleMitigate(node.node_id)}
                    disabled={mitigatingNode === node.node_id}
                    style={{
                      marginTop: '0.5rem',
                      gridColumn: '1 / span 2',
                      backgroundColor: mitigatingNode === node.node_id ? '#555' : 'var(--alert-critical)',
                      color: 'white',
                      border: 'none',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      cursor: mitigatingNode === node.node_id ? 'wait' : 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      fontSize: '0.85rem'
                    }}
                  >
                    {mitigatingNode === node.node_id ? 'Enviando API...' : 'AISLAR (API Azure)'}
                  </button>
                </div>
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
  }

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
            className={activeTab === 'alertas' ? 'active' : ''} 
            onClick={() => setActiveTab('alertas')}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>Alertas SIEM</span>
            {alerts.filter(a => (a.status || 'active') === 'active').length > 0 && (
              <span className="badge-pill">{alerts.filter(a => (a.status || 'active') === 'active').length}</span>
            )}
          </li>
          <li 
            className={activeTab === 'ordenes' ? 'active' : ''} 
            onClick={() => setActiveTab('ordenes')}
          >
            Centro de Órdenes (C2)
          </li>
        </ul>
        
        <div className="sidebar-footer">
          <p>ArgusNode Security</p>
          <p className="version">v1.3.0 - Enterprise</p>
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
          {activeTab === 'ordenes' && renderOrdenes()}
        </div>
      </main>
    </div>
  )
}

export default App

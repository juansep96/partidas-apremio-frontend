import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sileo } from 'sileo';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import { estadisticasApi, alertasApi } from '../../api/recaudacionApi';
import './DashboardPage.css';

function formatMonto(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}
function formatFecha(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function timeAgo(str) {
  if (!str) return '—';
  const diff = Date.now() - new Date(str).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

const ESTADO_COLORS = {
  deuda_informada: '#94a3b8',
  en_intimacion: '#f59e0b',
  notificada: '#3b82f6',
  rechazada: '#ef4444',
  marcada_apremio: '#f97316',
  asignada_legales: '#8b5cf6',
  en_juicio: '#6366f1',
  finalizada: '#10b981',
};

const ALERT_COLORS = {
  vencimiento: '#ef4444',
  recordatorio: '#f59e0b',
  actualizacion: '#3b82f6',
  sistema: '#8b5cf6',
};

const ALERT_ICONS = {
  vencimiento: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 4.5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  recordatorio: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2a4 4 0 014 4v2.5l1 2H3l1-2V6a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  actualizacion: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13 8A5 5 0 113 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 5v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  sistema: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
    </svg>
  ),
};

const FUNNEL_STEPS = [
  { key: 'deuda_informada', label: 'Deuda Informada' },
  { key: 'en_intimacion', label: 'En Intimación' },
  { key: 'notificada', label: 'Notificada' },
  { key: 'marcada_apremio', label: 'Marcada Apremio' },
  { key: 'asignada_legales', label: 'Asignada Legales' },
  { key: 'en_juicio', label: 'En Juicio' },
  { key: 'finalizada', label: 'Finalizada' },
];

export default function DashboardPage() {
  const [resumen, setResumen] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marcandoLeida, setMarcandoLeida] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [resData, alertasData] = await Promise.all([
          estadisticasApi.resumen(),
          alertasApi.list({ leida: 0, per_page: 10 }),
        ]);
        setResumen(resData);
        setAlertas(alertasData.data || alertasData || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setTimeout(() => setAnimated(true), 50);
      }
    })();
  }, []);

  const marcarLeida = async (id) => {
    setMarcandoLeida(id);
    try {
      await alertasApi.marcarLeida(id);
      setAlertas((prev) => prev.filter((a) => a.id !== id));
      sileo.success({ title: 'Alerta marcada como leída' });
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setMarcandoLeida(null);
    }
  };

  const porEstado = resumen?.por_estado || {};
  const totalPorEstado = Object.values(porEstado).reduce((a, b) => a + (Number(b) || 0), 0);

  const enProceso = ['deuda_informada', 'en_intimacion', 'notificada', 'marcada_apremio', 'asignada_legales', 'en_juicio']
    .reduce((sum, k) => sum + (Number(porEstado[k]) || 0), 0);

  const clockStr = clock.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = clock.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <AppLayout>
      <div className="pj-dash-page">

        {/* ── Hero ── */}
        <div className="pj-dash-hero">
          <div className="pj-dash-hero-grid" />
          <div className="pj-dash-hero-content">
            <div className="pj-dash-hero-left">
              <div className="pj-dash-hero-eyebrow">
                <span className="pj-dash-hero-dot" />
                Sistema de Recupero Judicial
              </div>
              <h1 className="pj-dash-hero-title">Partidas Judicializadas</h1>
              <p className="pj-dash-hero-sub">Panel de control del módulo de apremio municipal</p>
            </div>
            <div className="pj-dash-hero-right">
              <div className="pj-dash-clock-time">{clockStr}</div>
              <div className="pj-dash-clock-date">{dateStr}</div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="pj-dash-loading">
            <div className="pj-dash-spinner" />
            Cargando datos...
          </div>
        )}
        {error && <div className="pj-dash-error">Error al cargar datos: {error}</div>}

        {!loading && !error && resumen && (
          <>
            {/* ── KPI Cards ── */}
            <div className={`pj-dash-kpi-grid${animated ? ' pj-dash-animated' : ''}`}>
              <KpiCard
                icon={<IconLegajos />}
                label="Total Legajos"
                value={resumen.total_legajos ?? '—'}
                color="#015a6a"
                delay="0ms"
              />
              <KpiCard
                icon={<IconCapital />}
                label="Capital Total"
                value={formatMonto(resumen.total_capital)}
                color="#3b82f6"
                small
                delay="60ms"
              />
              <KpiCard
                icon={<IconIntereses />}
                label="Intereses Total"
                value={formatMonto(resumen.total_intereses)}
                color="#8b5cf6"
                small
                delay="120ms"
              />
              <KpiCard
                icon={<IconAlertas />}
                label="Alertas Pendientes"
                value={alertas.length}
                color={alertas.length > 0 ? '#ef4444' : '#10b981'}
                alert={alertas.length > 0}
                delay="180ms"
              />
              <KpiCard
                icon={<IconProceso />}
                label="En Proceso"
                value={enProceso}
                color="#f97316"
                delay="240ms"
              />
            </div>

            {/* ── Estado Distribution ── */}
            {totalPorEstado > 0 && (
              <div className={`pj-dash-section${animated ? ' pj-dash-animated' : ''}`} style={{ '--delay': '300ms' }}>
                <div className="pj-dash-section-header">
                  <span className="pj-dash-section-title">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                      <rect x="1" y="4" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    Distribución por Estado
                  </span>
                  <Link to="/recaudacion/partidas" className="pj-dash-section-link">
                    Ver todas las partidas →
                  </Link>
                </div>
                <div className="pj-dash-section-body">
                  <StackedBar porEstado={porEstado} total={totalPorEstado} />
                </div>
              </div>
            )}

            {/* ── Workflow Funnel ── */}
            <div className={`pj-dash-section${animated ? ' pj-dash-animated' : ''}`} style={{ '--delay': '360ms' }}>
              <div className="pj-dash-section-header">
                <span className="pj-dash-section-title">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                    <path d="M2 3h12L9 9v5l-2-1V9L2 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                  Pipeline de Recupero
                </span>
                {porEstado.rechazada != null && (
                  <span className="pj-dash-rechazada-badge">
                    Rechazadas: <strong>{porEstado.rechazada}</strong>
                  </span>
                )}
              </div>
              <div className="pj-dash-section-body">
                <WorkflowFunnel porEstado={porEstado} />
              </div>
            </div>
          </>
        )}

        {/* ── Alerts Table ── */}
        <div className={`pj-dash-section${animated ? ' pj-dash-animated' : ''}`} style={{ '--delay': '420ms' }}>
          <div className="pj-dash-section-header">
            <span className="pj-dash-section-title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                <path d="M8 2a4 4 0 014 4v2.5l1 2H3l1-2V6a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Mis Alertas
            </span>
            {alertas.length > 0 && (
              <span className="pj-dash-badge-count pj-dash-badge-count--red">{alertas.length}</span>
            )}
          </div>
          {loading ? (
            <div className="pj-dash-loading">Cargando...</div>
          ) : alertas.length === 0 ? (
            <div className="pj-dash-empty">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ marginBottom: '0.5rem', opacity: 0.3 }}>
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
                <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>Sin alertas pendientes</div>
            </div>
          ) : (
            <div className="pj-dash-alerts-list">
              {alertas.map((a) => {
                const tipo = (a.tipo || 'sistema').toLowerCase();
                const color = ALERT_COLORS[tipo] || '#64748b';
                const icon = ALERT_ICONS[tipo] || ALERT_ICONS.sistema;
                return (
                  <div key={a.id} className="pj-dash-alert-row" style={{ '--alert-color': color }}>
                    <div className="pj-dash-alert-accent" />
                    <div className="pj-dash-alert-icon" style={{ color }}>
                      {icon}
                    </div>
                    <div className="pj-dash-alert-body">
                      <div className="pj-dash-alert-msg">{a.mensaje}</div>
                      <div className="pj-dash-alert-meta">
                        <span className="pj-dash-alert-tipo" style={{ color }}>{(a.tipo || 'sistema').replace(/_/g, ' ')}</span>
                        {a.legajo?.partida?.nro_partida && (
                          <>
                            <span className="pj-dash-alert-sep">·</span>
                            <Link to="/recaudacion/partidas" className="pj-dash-alert-partida">
                              #{a.legajo.partida.nro_partida}
                            </Link>
                          </>
                        )}
                        <span className="pj-dash-alert-sep">·</span>
                        <span className="pj-dash-alert-time">{timeAgo(a.created_at)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="pj-dash-alert-dismiss"
                      onClick={() => marcarLeida(a.id)}
                      disabled={marcandoLeida === a.id}
                      title="Marcar como leída"
                    >
                      {marcandoLeida === a.id ? (
                        <span className="pj-dash-mini-spinner" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

/* ── Sub-components ── */

function KpiCard({ icon, label, value, color, small, alert, delay }) {
  return (
    <div className={`pj-dash-kpi-card${alert ? ' pj-dash-kpi-card--alert' : ''}`} style={{ '--kpi-color': color, '--delay': delay }}>
      <div className="pj-dash-kpi-icon" style={{ color }}>
        {icon}
      </div>
      <div className="pj-dash-kpi-label">{label}</div>
      <div className={`pj-dash-kpi-value${small ? ' pj-dash-kpi-value--sm' : ''}`} style={{ color }}>
        {value}
      </div>
      <div className="pj-dash-kpi-glow" />
    </div>
  );
}

function StackedBar({ porEstado, total }) {
  const entries = Object.entries(porEstado).filter(([, v]) => Number(v) > 0);
  return (
    <div>
      <Link to="/recaudacion/partidas" style={{ textDecoration: 'none', display: 'block' }}>
        <div className="pj-dash-stacked-bar">
          {entries.map(([estado, count]) => {
            const pct = (Number(count) / total) * 100;
            const color = ESTADO_COLORS[estado] || '#94a3b8';
            return (
              <div
                key={estado}
                className="pj-dash-stacked-segment"
                style={{ width: `${pct}%`, background: color }}
                title={`${estado.replace(/_/g, ' ')}: ${count}`}
              />
            );
          })}
        </div>
      </Link>
      <div className="pj-dash-stacked-legend">
        {entries.map(([estado, count]) => {
          const color = ESTADO_COLORS[estado] || '#94a3b8';
          const pct = Math.round((Number(count) / total) * 100);
          return (
            <div key={estado} className="pj-dash-legend-item">
              <span className="pj-dash-legend-dot" style={{ background: color }} />
              <span className="pj-dash-legend-label">{estado.replace(/_/g, ' ')}</span>
              <span className="pj-dash-legend-count">{count}</span>
              <span className="pj-dash-legend-pct">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowFunnel({ porEstado }) {
  return (
    <div className="pj-dash-funnel-wrapper">
      <div className="pj-dash-funnel">
        {FUNNEL_STEPS.map((step, i) => {
          const count = Number(porEstado[step.key]) || 0;
          const color = ESTADO_COLORS[step.key] || '#94a3b8';
          const isLast = i === FUNNEL_STEPS.length - 1;
          return (
            <div key={step.key} className={`pj-dash-funnel-step${isLast ? ' pj-dash-funnel-step--end' : ''}`}>
              <div
                className="pj-dash-funnel-node"
                style={{ '--step-color': color, borderColor: color }}
              >
                <div className="pj-dash-funnel-count" style={{ color }}>{count}</div>
                <div className="pj-dash-funnel-label">{step.label}</div>
              </div>
              {!isLast && (
                <div className="pj-dash-funnel-arrow" style={{ color: '#475569' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {porEstado.rechazada != null && (
        <div className="pj-dash-funnel-branch">
          <div className="pj-dash-funnel-branch-line" />
          <div className="pj-dash-funnel-node" style={{ '--step-color': '#ef4444', borderColor: '#ef4444' }}>
            <div className="pj-dash-funnel-count" style={{ color: '#ef4444' }}>{porEstado.rechazada}</div>
            <div className="pj-dash-funnel-label">Rechazada</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Icons ── */

function IconLegajos() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="2" width="13" height="17" rx="2" stroke="currentColor" strokeWidth="1.75"/>
      <path d="M7 7h6M7 11h6M7 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="12" y="14" width="7" height="6" rx="1.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M15.5 16.5v2M14.5 17.5h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}
function IconCapital() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.75"/>
      <path d="M11 6v1.5M11 14.5V16M8.5 9.5a2.5 2 0 015 0c0 1.5-2.5 2-2.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="11" cy="13.5" r="0.75" fill="currentColor"/>
    </svg>
  );
}
function IconIntereses() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 18L18 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.75"/>
      <circle cx="15" cy="15" r="2.5" stroke="currentColor" strokeWidth="1.75"/>
    </svg>
  );
}
function IconAlertas() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3a5.5 5.5 0 015.5 5.5v3.5l1.5 2.5H4L5.5 12V8.5A5.5 5.5 0 0111 3z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
      <path d="M8.5 17a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function IconProceso() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 11a7 7 0 017-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M18 11a7 7 0 01-7 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
      <path d="M11 4l2-2-2-2M11 18l-2 2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sileo } from 'sileo';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import { legajoApi } from '../../api/recaudacionApi';
import './BandejaSecretarioPage.css';

function formatCapital(monto) {
  if (monto == null) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(monto);
}

function abogadoNombre(abogado) {
  if (!abogado) return null;
  return [abogado.firstName, abogado.lastName].filter(Boolean).join(' ') || null;
}

function getBorderColor(estado) {
  if (estado === 'asignada_legales') return '#8b5cf6';
  if (estado === 'en_juicio') return '#f59e0b';
  if (estado === 'finalizada') return '#10b981';
  return '#64748b';
}

export default function BandejaSecretarioPage() {
  const [pendientes, setPendientes] = useState([]);
  const [asignados, setAsignados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { legajoId, abogados }
  const [abogadoId, setAbogadoId] = useState('');
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resPendientes, resAsignados] = await Promise.all([
        legajoApi.list({ estado: 'marcada_apremio', per_page: 50 }),
        legajoApi.list({ estado: 'asignada_legales,en_juicio,finalizada', per_page: 50 }),
      ]);
      setPendientes(resPendientes.data || resPendientes || []);
      setAsignados(resAsignados.data || resAsignados || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const openAsignar = (legajo) => {
    setAbogadoId('');
    setModal({ legajoId: legajo.id, abogados: legajo.abogados_disponibles || [] });
  };

  const handleAsignar = async () => {
    if (!abogadoId) return sileo.error({ title: 'Seleccioná un abogado' });
    setSaving(true);
    try {
      await legajoApi.asignarAbogado(modal.legajoId, { abogado_id: abogadoId });
      sileo.success({ title: 'Abogado asignado correctamente' });
      setModal(null);
      await cargar();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const enJuicio = asignados.filter(l => l.estado === 'en_juicio').length;
  const finalizados = asignados.filter(l => l.estado === 'finalizada').length;

  return (
    <AppLayout>
      <div className="pj-sec-page">

        {/* ── Hero ── */}
        <div className="pj-sec-hero">
          <div className="pj-sec-hero-inner">
            <div className="pj-sec-hero-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-4 0v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <div>
              <h1 className="pj-sec-hero-title">Bandeja del Secretario Legal</h1>
              <p className="pj-sec-hero-sub">Gestión de asignaciones de abogados para legajos en apremio</p>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="pj-sec-kpi-row">
          <div className="pj-sec-kpi-card">
            <div className="pj-sec-kpi-top">
              <span className="pj-sec-kpi-label">Pendientes de asignación</span>
              <span className="pj-sec-kpi-badge pj-sec-kpi-badge--orange">urgente</span>
            </div>
            <div className="pj-sec-kpi-value pj-sec-kpi-value--orange">{pendientes.length}</div>
          </div>
          <div className="pj-sec-kpi-card">
            <div className="pj-sec-kpi-top">
              <span className="pj-sec-kpi-label">En Juicio</span>
            </div>
            <div className="pj-sec-kpi-value pj-sec-kpi-value--amber">{enJuicio}</div>
          </div>
          <div className="pj-sec-kpi-card">
            <div className="pj-sec-kpi-top">
              <span className="pj-sec-kpi-label">Finalizados</span>
            </div>
            <div className="pj-sec-kpi-value pj-sec-kpi-value--green">{finalizados}</div>
          </div>
        </div>

        {loading && (
          <div className="pj-sec-state-msg">
            <div className="pj-sec-spinner" />
            Cargando bandeja…
          </div>
        )}
        {error && <div className="pj-sec-state-msg pj-sec-state-msg--error">Error: {error}</div>}

        {!loading && !error && (
          <>
            {/* ── Pendientes section ── */}
            <div className="pj-sec-section">
              <div className="pj-sec-section-header pj-sec-section-header--orange">
                <span className="pj-sec-section-title">Pendientes de asignación</span>
                <span className="pj-sec-section-count">{pendientes.length}</span>
              </div>

              {pendientes.length === 0 ? (
                <div className="pj-sec-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8M12 8v8" />
                  </svg>
                  <p>Sin legajos pendientes de asignación</p>
                </div>
              ) : (
                <div className="pj-sec-cards">
                  {pendientes.map(l => (
                    <div key={l.id} className="pj-sec-card pj-sec-card--orange">
                      <div className="pj-sec-card-body">
                        <div className="pj-sec-card-main">
                          <div className="pj-sec-card-partida">
                            Partida&nbsp;
                            <strong>{l.partida?.nro_partida || '—'}</strong>
                          </div>
                          <div className="pj-sec-card-titular">
                            {l.partida?.titular || l.titular || '—'}
                          </div>
                        </div>
                        <div className="pj-sec-card-meta">
                          <div className="pj-sec-capital-tag">
                            {formatCapital(l.monto_capital)}
                          </div>
                          <EstadoBadge estado={l.estado} />
                        </div>
                        <div className="pj-sec-card-actions">
                          <button
                            type="button"
                            className="pj-sec-btn pj-sec-btn--primary"
                            onClick={() => openAsignar(l)}
                          >
                            Asignar abogado
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Asignados section ── */}
            <div className="pj-sec-section">
              <div className="pj-sec-section-header pj-sec-section-header--teal">
                <span className="pj-sec-section-title">Legajos asignados</span>
                <span className="pj-sec-section-count">{asignados.length}</span>
              </div>

              {asignados.length === 0 ? (
                <div className="pj-sec-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <p>Sin legajos asignados todavía</p>
                </div>
              ) : (
                <div className="pj-sec-cards">
                  {asignados.map(l => {
                    const nombre = abogadoNombre(l.abogado);
                    const initials = nombre
                      ? nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                      : '?';
                    const borderColor = getBorderColor(l.estado);
                    return (
                      <div
                        key={l.id}
                        className="pj-sec-card"
                        style={{ '--pj-sec-border': borderColor }}
                      >
                        <div className="pj-sec-card-body">
                          <div className="pj-sec-card-main">
                            <div className="pj-sec-card-partida">
                              Partida&nbsp;
                              <strong>{l.partida?.nro_partida || '—'}</strong>
                            </div>
                            <div className="pj-sec-card-titular">
                              {l.partida?.titular || l.titular || '—'}
                            </div>
                          </div>
                          <div className="pj-sec-card-meta">
                            {nombre ? (
                              <div className="pj-sec-abogado-pill">
                                <span className="pj-sec-abogado-avatar">{initials}</span>
                                <span className="pj-sec-abogado-name">{nombre}</span>
                              </div>
                            ) : (
                              <span className="pj-sec-abogado-pill pj-sec-abogado-pill--none">Sin abogado</span>
                            )}
                            <EstadoBadge estado={l.estado} />
                          </div>
                          <div className="pj-sec-card-actions">
                            <Link
                              to={`/recaudacion/legajos/${l.id}`}
                              className="pj-sec-btn pj-sec-btn--ghost"
                            >
                              Ver legajo →
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal: Asignar Abogado ── */}
      {modal && (
        <div
          className="pj-sec-modal-overlay"
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div className="pj-sec-modal">
            <div className="pj-sec-modal-header">
              <h2>Asignar Abogado</h2>
              <button
                type="button"
                className="pj-sec-modal-close"
                onClick={() => setModal(null)}
                aria-label="Cerrar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="pj-sec-modal-body">
              <div className="pj-sec-modal-field">
                <label htmlFor="pj-sec-abogado-select">Abogado</label>
                <select
                  id="pj-sec-abogado-select"
                  value={abogadoId}
                  onChange={e => setAbogadoId(e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {modal.abogados.map(a => (
                    <option key={a.id} value={a.id}>
                      {[a.firstName, a.lastName].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              </div>

              {modal.abogados.length === 0 && (
                <p className="pj-sec-modal-hint">
                  No hay abogados disponibles. Contactá con el administrador del sistema.
                </p>
              )}
            </div>

            <div className="pj-sec-modal-actions">
              <button
                type="button"
                className="pj-sec-btn pj-sec-btn--ghost"
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pj-sec-btn pj-sec-btn--primary"
                disabled={saving || !abogadoId}
                onClick={handleAsignar}
              >
                {saving ? 'Guardando…' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sileo } from 'sileo';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import { legajoApi } from '../../api/recaudacionApi';
import './BandejaSecretarioPage.css';

function formatMonto(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
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

function formatFecha(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export default function BandejaSecretarioPage() {
  const [pendientes, setPendientes] = useState([]);
  const [asignados, setAsignados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal asignar abogado
  const [modal, setModal] = useState(null); // { legajoId, abogados }
  const [abogadoId, setAbogadoId] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal detalle legajo
  const [detalle, setDetalle] = useState(null);       // datos del legajo
  const [detalleLoading, setDetalleLoading] = useState(false);

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

  const openDetalle = async (legajoId) => {
    setDetalle(null);
    setDetalleLoading(true);
    try {
      const res = await legajoApi.get(legajoId);
      setDetalle(res.data || res);
    } catch (err) {
      sileo.error({ title: 'Error al cargar el legajo', description: err.message });
    } finally {
      setDetalleLoading(false);
    }
  };

  const openAsignar = (legajo) => {
    setAbogadoId('');
    setModal({ legajoId: legajo.id, abogados: legajo.abogados_disponibles || detalle?.abogados_disponibles || [] });
  };

  const handleAsignar = async () => {
    if (!abogadoId) return sileo.error({ title: 'Seleccioná un abogado' });
    setSaving(true);
    try {
      await legajoApi.asignarAbogado(modal.legajoId, { abogado_id: abogadoId });
      sileo.success({ title: 'Abogado asignado correctamente' });
      setModal(null);
      setDetalle(null);
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
                  {pendientes.map(l => {
                    const capital = l.partida?.monto_capital ?? l.monto_capital ?? null;
                    const intereses = l.partida?.monto_intereses ?? l.monto_intereses ?? null;
                    const total = (capital || 0) + (intereses || 0);
                    const cuotas = l.partida?.cuotas_adeudadas ?? l.cuotas_adeudadas ?? null;
                    const dni = l.partida?.titular_dni ?? l.titular_dni ?? null;
                    const domicilio = l.partida?.titular_domicilio ?? l.titular_domicilio ?? null;
                    const zona = l.partida?.zona ?? l.zona ?? null;
                    const cp = l.partida?.codigo_postal ?? l.codigo_postal ?? null;
                    const titular = l.partida?.titular_nombre ?? l.partida?.titular ?? l.titular ?? '—';

                    return (
                      <div key={l.id} className="pj-sec-card pj-sec-card--orange">
                        <div className="pj-sec-card-body">

                          <div className="pj-sec-card-top-row">
                            <div className="pj-sec-card-partida-num">
                              Partida <strong>{l.partida?.nro_partida || '—'}</strong>
                            </div>
                            <EstadoBadge estado={l.estado} />
                          </div>

                          <div className="pj-sec-card-titular">{titular}</div>

                          <div className="pj-sec-card-chips">
                            {dni && <span className="pj-sec-chip">DNI {dni}</span>}
                            {domicilio && <span className="pj-sec-chip">{domicilio}</span>}
                            {(zona || cp) && (
                              <span className="pj-sec-chip">{[zona, cp].filter(Boolean).join(' · ')}</span>
                            )}
                          </div>

                          <div className="pj-sec-card-financiero">
                            <div className="pj-sec-fin-item">
                              <span className="pj-sec-fin-label">Capital</span>
                              <span className="pj-sec-fin-value">{formatMonto(capital)}</span>
                            </div>
                            <div className="pj-sec-fin-sep" />
                            <div className="pj-sec-fin-item">
                              <span className="pj-sec-fin-label">Intereses</span>
                              <span className="pj-sec-fin-value">{formatMonto(intereses)}</span>
                            </div>
                            <div className="pj-sec-fin-sep" />
                            <div className="pj-sec-fin-item pj-sec-fin-item--total">
                              <span className="pj-sec-fin-label">Total</span>
                              <span className="pj-sec-fin-value pj-sec-fin-value--total">{formatMonto(total)}</span>
                            </div>
                            {cuotas != null && (
                              <>
                                <div className="pj-sec-fin-sep" />
                                <div className="pj-sec-fin-item">
                                  <span className="pj-sec-fin-label">Cuotas</span>
                                  <span className="pj-sec-fin-value">{cuotas}</span>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="pj-sec-card-actions">
                            <button
                              type="button"
                              className="pj-sec-btn pj-sec-btn--ghost"
                              onClick={() => openDetalle(l.id)}
                            >
                              Ver detalle
                            </button>
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
                    );
                  })}
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
                    const titular = l.partida?.titular_nombre ?? l.partida?.titular ?? l.titular ?? '—';
                    return (
                      <div key={l.id} className="pj-sec-card" style={{ '--pj-sec-border': borderColor }}>
                        <div className="pj-sec-card-body">
                          <div className="pj-sec-card-top-row">
                            <div className="pj-sec-card-partida-num">
                              Partida <strong>{l.partida?.nro_partida || '—'}</strong>
                            </div>
                            <EstadoBadge estado={l.estado} />
                          </div>
                          <div className="pj-sec-card-titular">{titular}</div>
                          <div className="pj-sec-card-meta">
                            {nombre ? (
                              <div className="pj-sec-abogado-pill">
                                <span className="pj-sec-abogado-avatar">{initials}</span>
                                <span className="pj-sec-abogado-name">{nombre}</span>
                              </div>
                            ) : (
                              <span className="pj-sec-abogado-pill pj-sec-abogado-pill--none">Sin abogado</span>
                            )}
                          </div>
                          <div className="pj-sec-card-actions">
                            <button
                              type="button"
                              className="pj-sec-btn pj-sec-btn--ghost"
                              onClick={() => openDetalle(l.id)}
                            >
                              Ver detalle
                            </button>
                            <Link to={`/recaudacion/legajos/${l.id}`} className="pj-sec-btn pj-sec-btn--ghost">
                              Ir al legajo →
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

      {/* ── Modal: Detalle legajo ── */}
      {(detalle || detalleLoading) && (
        <div className="pj-sec-modal-overlay" onClick={e => e.target === e.currentTarget && setDetalle(null)}>
          <div className="pj-sec-modal pj-sec-modal--wide">
            <div className="pj-sec-modal-header">
              <div>
                <h2>
                  {detalleLoading ? 'Cargando…' : `Partida ${detalle?.partida?.nro_partida || '—'}`}
                </h2>
                {detalle && (
                  <p className="pj-sec-modal-subhead">{detalle.partida?.titular_nombre ?? detalle.titular ?? ''}</p>
                )}
              </div>
              <button type="button" className="pj-sec-modal-close" onClick={() => setDetalle(null)}>
                <IconX />
              </button>
            </div>

            {detalleLoading && (
              <div className="pj-sec-modal-loading">
                <div className="pj-sec-spinner" />
                Cargando datos del legajo…
              </div>
            )}

            {detalle && (
              <>
                <div className="pj-sec-modal-body pj-sec-modal-body--detail">

                  {/* Estado */}
                  <div className="pj-sec-det-row">
                    <EstadoBadge estado={detalle.estado} />
                  </div>

                  {/* Titular */}
                  <div className="pj-sec-det-section">
                    <p className="pj-sec-det-section-title">Titular</p>
                    <div className="pj-sec-det-grid">
                      {detalle.partida?.titular_dni && (
                        <div className="pj-sec-det-field">
                          <span className="pj-sec-det-label">DNI</span>
                          <span className="pj-sec-det-value">{detalle.partida.titular_dni}</span>
                        </div>
                      )}
                      {detalle.partida?.titular_domicilio && (
                        <div className="pj-sec-det-field pj-sec-det-field--wide">
                          <span className="pj-sec-det-label">Domicilio</span>
                          <span className="pj-sec-det-value">{detalle.partida.titular_domicilio}</span>
                        </div>
                      )}
                      {detalle.partida?.zona && (
                        <div className="pj-sec-det-field">
                          <span className="pj-sec-det-label">Zona</span>
                          <span className="pj-sec-det-value">{detalle.partida.zona}</span>
                        </div>
                      )}
                      {detalle.partida?.codigo_postal && (
                        <div className="pj-sec-det-field">
                          <span className="pj-sec-det-label">Código Postal</span>
                          <span className="pj-sec-det-value">{detalle.partida.codigo_postal}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Deuda */}
                  <div className="pj-sec-det-section">
                    <p className="pj-sec-det-section-title">Deuda</p>
                    <div className="pj-sec-det-grid">
                      <div className="pj-sec-det-field">
                        <span className="pj-sec-det-label">Capital</span>
                        <span className="pj-sec-det-value pj-sec-det-value--money">{formatMonto(detalle.partida?.monto_capital)}</span>
                      </div>
                      <div className="pj-sec-det-field">
                        <span className="pj-sec-det-label">Intereses</span>
                        <span className="pj-sec-det-value pj-sec-det-value--money">{formatMonto(detalle.partida?.monto_intereses)}</span>
                      </div>
                      <div className="pj-sec-det-field">
                        <span className="pj-sec-det-label">Total</span>
                        <span className="pj-sec-det-value pj-sec-det-value--total">
                          {formatMonto((detalle.partida?.monto_capital || 0) + (detalle.partida?.monto_intereses || 0))}
                        </span>
                      </div>
                      {detalle.partida?.cuotas_adeudadas != null && (
                        <div className="pj-sec-det-field">
                          <span className="pj-sec-det-label">Cuotas adeudadas</span>
                          <span className="pj-sec-det-value">{detalle.partida.cuotas_adeudadas}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proceso */}
                  <div className="pj-sec-det-section">
                    <p className="pj-sec-det-section-title">Proceso</p>
                    <div className="pj-sec-det-grid">
                      {detalle.fecha_cutoff && (
                        <div className="pj-sec-det-field">
                          <span className="pj-sec-det-label">Fecha cut-off</span>
                          <span className="pj-sec-det-value">{formatFecha(detalle.fecha_cutoff)}</span>
                        </div>
                      )}
                      {detalle.abogado && (
                        <div className="pj-sec-det-field">
                          <span className="pj-sec-det-label">Abogado</span>
                          <span className="pj-sec-det-value">{abogadoNombre(detalle.abogado)}</span>
                        </div>
                      )}
                      {detalle.nro_expediente && (
                        <div className="pj-sec-det-field">
                          <span className="pj-sec-det-label">Nro. Expediente</span>
                          <span className="pj-sec-det-value pj-sec-det-value--mono">{detalle.nro_expediente}</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                <div className="pj-sec-modal-actions">
                  <Link to={`/recaudacion/legajos/${detalle.id}`} className="pj-sec-btn pj-sec-btn--ghost">
                    Ir al legajo →
                  </Link>
                  {detalle.estado === 'marcada_apremio' && (
                    <button
                      type="button"
                      className="pj-sec-btn pj-sec-btn--primary"
                      onClick={() => openAsignar(detalle)}
                    >
                      Asignar abogado
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Asignar Abogado ── */}
      {modal && (
        <div className="pj-sec-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="pj-sec-modal">
            <div className="pj-sec-modal-header">
              <h2>Asignar Abogado</h2>
              <button type="button" className="pj-sec-modal-close" onClick={() => setModal(null)}>
                <IconX />
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
              <button type="button" className="pj-sec-btn pj-sec-btn--ghost" onClick={() => setModal(null)}>
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

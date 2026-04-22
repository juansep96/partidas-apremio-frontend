import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import LegajoTimeline from '../../components/recaudacion/LegajoTimeline';
import DocumentosPanel from '../../components/recaudacion/DocumentosPanel';
import { useAuth } from '../../context/AuthContext';
import { legajoApi } from '../../api/recaudacionApi';
import './LegajoDetailPage.css';

function formatMonto(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function formatFecha(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

const ESTADO_LABELS = {
  deuda_informada: 'Deuda Informada',
  en_intimacion: 'En Intimación',
  notificada: 'Notificada',
  rechazada: 'Rechazada',
  marcada_apremio: 'Marcada Apremio',
  asignada_legales: 'Asignada Legales',
  en_juicio: 'En Juicio',
  finalizada: 'Finalizada',
};

// Main workflow states (excluding rechazada which is a branch)
const WORKFLOW_STATES = [
  'deuda_informada',
  'en_intimacion',
  'notificada',
  'marcada_apremio',
  'asignada_legales',
  'en_juicio',
  'finalizada',
];

// SVG icons
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

const IconLock = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect x="6" y="15" width="20" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M10 15v-4a6 6 0 0112 0v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    <circle cx="16" cy="21.5" r="1.5" fill="currentColor"/>
  </svg>
);

// Modal
function PjModal({ open, onClose, title, children, danger }) {
  if (!open) return null;
  return (
    <div className="pj-det-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pj-det-modal">
        <div className={`pj-det-modal-header${danger ? ' pj-det-modal-header--danger' : ''}`}>
          <h2 className="pj-det-modal-title">{title}</h2>
          <button type="button" className="pj-det-modal-close" onClick={onClose} aria-label="Cerrar">
            <IconX />
          </button>
        </div>
        <div className="pj-det-modal-body">{children}</div>
      </div>
    </div>
  );
}

// Workflow stepper
function WorkflowStepper({ estado }) {
  const currentIdx = WORKFLOW_STATES.indexOf(estado);
  const isRechazada = estado === 'rechazada';

  return (
    <div className="pj-det-stepper">
      <div className="pj-det-stepper-track">
        {WORKFLOW_STATES.map((s, i) => {
          const isPast = !isRechazada && i < currentIdx;
          const isCurrent = !isRechazada && i === currentIdx;
          const color = ESTADO_COLORS[s];

          return (
            <div key={s} className="pj-det-stepper-item">
              {i > 0 && (
                <div
                  className={`pj-det-stepper-line${isPast || isCurrent ? ' pj-det-stepper-line--active' : ''}`}
                  style={isPast || isCurrent ? { background: `linear-gradient(90deg, ${ESTADO_COLORS[WORKFLOW_STATES[i-1]]}, ${color})` } : {}}
                />
              )}
              <div
                className={`pj-det-stepper-node${isPast ? ' past' : ''}${isCurrent ? ' current' : ''}`}
                style={isCurrent ? { background: color, boxShadow: `0 0 0 4px ${color}33, 0 0 12px ${color}66` } : isPast ? { background: color } : {}}
                title={ESTADO_LABELS[s]}
              >
                {isPast ? <IconCheck /> : isCurrent ? null : null}
                {isCurrent && <div className="pj-det-stepper-pulse" style={{ background: color }} />}
              </div>
              <span
                className={`pj-det-stepper-label${isCurrent ? ' current' : ''}${isPast ? ' past' : ''}`}
                style={isCurrent ? { color } : {}}
              >
                {ESTADO_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rechazada branch */}
      {isRechazada && (
        <div className="pj-det-stepper-rechazada">
          <div className="pj-det-stepper-rechazada-line" />
          <div className="pj-det-stepper-rechazada-node">
            <IconX />
          </div>
          <span className="pj-det-stepper-rechazada-label">Rechazada</span>
        </div>
      )}
    </div>
  );
}

export default function LegajoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, systems } = useAuth();
  const recSystem = systems?.find(s => s.modules?.some(m => m.route?.startsWith('/recaudacion')));
  const pjRole = recSystem?.role;
  const isSuperAdmin = user?.globalRole === 'SUPERADMIN';

  const [legajo, setLegajo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [abogados, setAbogados] = useState([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await legajoApi.get(id);
      setLegajo(res.data || res);
      if (res.abogados_disponibles) setAbogados(res.abogados_disponibles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const openModal = (type, defaults = {}) => {
    setModalForm(defaults);
    setModal(type);
  };

  const closeModal = () => {
    setModal(null);
    setModalForm({});
  };

  const handleAction = async (apiCall, successMsg) => {
    setSaving(true);
    try {
      await apiCall();
      sileo.success({ title: successMsg });
      closeModal();
      await cargar();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="pj-det-loading-wrap">
          <div className="pj-det-loading-spinner" />
          <p>Cargando legajo...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="pj-det-error-wrap">
          <p>Error: {error}</p>
          <button className="pj-det-btn pj-det-btn--ghost" onClick={cargar}>Reintentar</button>
        </div>
      </AppLayout>
    );
  }

  if (!legajo) return null;

  const estado = legajo.estado;
  const estadoColor = ESTADO_COLORS[estado] || '#94a3b8';
  const titular = legajo.partida?.titular_nombre || legajo.partida?.titular || legajo.titular || '—';
  const titularDni = legajo.partida?.titular_dni || legajo.titular_dni || null;
  const titularDomicilio = legajo.partida?.titular_domicilio || legajo.titular_domicilio || null;
  const zona = legajo.partida?.zona || legajo.zona || null;
  const codigoPostal = legajo.partida?.codigo_postal || legajo.codigo_postal || null;
  const nroPartida = legajo.partida?.nro_partida || legajo.nro_partida || `#${legajo.id}`;
  const historial = legajo.historial || [];
  const montoCapital = legajo.partida?.monto_capital ?? legajo.monto_capital ?? null;
  const montoIntereses = legajo.partida?.monto_intereses ?? legajo.monto_intereses ?? null;
  const cuotasAdeudadas = legajo.partida?.cuotas_adeudadas ?? legajo.cuotas_adeudadas ?? null;
  const total = (montoCapital || 0) + (montoIntereses || 0);
  const abogadoNombre = legajo.abogado
    ? [legajo.abogado.firstName, legajo.abogado.lastName].filter(Boolean).join(' ')
    : null;

  // Role-based actions
  const canCargarAcuse = (isSuperAdmin || pjRole === 'Recaudacion') && estado === 'en_intimacion';
  const canMarcarApremio = (isSuperAdmin || pjRole === 'Sistemas') && ['notificada', 'rechazada'].includes(estado);
  const canAsignarAbogado = (isSuperAdmin || pjRole === 'SecretarioLegal') && estado === 'marcada_apremio';
  const canIniciarJuicio = (isSuperAdmin || pjRole === 'Abogado') && estado === 'asignada_legales';
  const canAmpliarDemanda = (isSuperAdmin || pjRole === 'Abogado') && estado === 'en_juicio';
  const canFinalizar = (isSuperAdmin || pjRole === 'Abogado') && estado === 'en_juicio';
  const canSubirCdc = (isSuperAdmin || pjRole === 'Sistemas') && estado === 'en_juicio';
  const canConfirmarDesbloqueo = (isSuperAdmin || pjRole === 'Sistemas') && estado === 'finalizada';

  const hasActions = canCargarAcuse || canMarcarApremio || canAsignarAbogado || canIniciarJuicio ||
    canAmpliarDemanda || canFinalizar || canSubirCdc || canConfirmarDesbloqueo;

  return (
    <AppLayout>
      <div className="pj-det-page">

        {/* ── HERO ── */}
        <div className="pj-det-hero" style={{ '--estado-color': estadoColor }}>
          <div className="pj-det-hero-bg" />
          <div className="pj-det-hero-content">
            <div className="pj-det-hero-left">
              <button type="button" className="pj-det-back-btn" onClick={() => navigate(-1)}>
                <IconArrowLeft />
                <span>Volver</span>
              </button>
              <div className="pj-det-hero-title-row">
                <h1 className="pj-det-hero-title">Partida {nroPartida}</h1>
                {legajo.finalizado_at && (
                  <span className="pj-det-finalizado-ribbon">
                    <IconCheck /> Finalizado
                  </span>
                )}
              </div>
              <p className="pj-det-hero-titular">{titular}</p>
              <div className="pj-det-hero-meta">
                {titularDni && <span className="pj-det-hero-meta-chip">DNI {titularDni}</span>}
                {titularDomicilio && <span className="pj-det-hero-meta-chip">{titularDomicilio}</span>}
                {(zona || codigoPostal) && (
                  <span className="pj-det-hero-meta-chip">
                    {[zona, codigoPostal].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
            <div className="pj-det-hero-right">
              <div className="pj-det-hero-estado-wrap">
                <div
                  className="pj-det-hero-estado-glow"
                  style={{ background: estadoColor, boxShadow: `0 0 40px 12px ${estadoColor}55` }}
                />
                <EstadoBadge estado={estado} />
              </div>
            </div>
          </div>
        </div>

        {/* ── STEPPER ── */}
        <div className="pj-det-stepper-wrap">
          <WorkflowStepper estado={estado} />
        </div>

        {/* ── FINANCIAL CARDS ── */}
        <div className="pj-det-cards-section">
          <p className="pj-det-cards-section-label">Información financiera</p>
          <div className="pj-det-cards-grid pj-det-cards-grid--financial">
            <div className="pj-det-card pj-det-card--financial">
              <span className="pj-det-card-label">Capital</span>
              <span className="pj-det-card-value pj-det-card-value--teal">{formatMonto(montoCapital)}</span>
            </div>
            <div className="pj-det-card pj-det-card--financial">
              <span className="pj-det-card-label">Intereses</span>
              <span className="pj-det-card-value">{formatMonto(montoIntereses)}</span>
            </div>
            <div className="pj-det-card pj-det-card--financial pj-det-card--total">
              <span className="pj-det-card-label">Total</span>
              <span className="pj-det-card-value pj-det-card-value--green">{formatMonto(total)}</span>
              <span className="pj-det-card-sublabel">Capital + Intereses</span>
            </div>
            <div className="pj-det-card pj-det-card--financial">
              <span className="pj-det-card-label">Cuotas Adeudadas</span>
              <span className="pj-det-card-value">{cuotasAdeudadas ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* ── PROCESS CARDS ── */}
        <div className="pj-det-cards-section">
          <p className="pj-det-cards-section-label">Datos del proceso</p>
          <div className="pj-det-cards-grid">
            {abogadoNombre && (
              <div className="pj-det-card">
                <span className="pj-det-card-label">Abogado asignado</span>
                <span className="pj-det-card-value pj-det-card-value--name">{abogadoNombre}</span>
              </div>
            )}
            {legajo.nro_expediente && (
              <div className="pj-det-card">
                <span className="pj-det-card-label">Nro. Expediente</span>
                <span className="pj-det-card-value pj-det-card-value--mono">{legajo.nro_expediente}</span>
              </div>
            )}
            <div className="pj-det-card">
              <span className="pj-det-card-label">Fecha Cut-off</span>
              <span className="pj-det-card-value">{formatFecha(legajo.fecha_cutoff || legajo.partida?.fecha_cutoff)}</span>
            </div>
            {legajo.fecha_inicio_juicio && (
              <div className="pj-det-card">
                <span className="pj-det-card-label">Inicio de Juicio</span>
                <span className="pj-det-card-value">{formatFecha(legajo.fecha_inicio_juicio)}</span>
              </div>
            )}
            {zona && (
              <div className="pj-det-card">
                <span className="pj-det-card-label">Zona</span>
                <span className="pj-det-card-value">{zona}</span>
              </div>
            )}
            {codigoPostal && (
              <div className="pj-det-card">
                <span className="pj-det-card-label">Código Postal</span>
                <span className="pj-det-card-value">{codigoPostal}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── ACTIONS PANEL ── */}
        <div className="pj-det-actions-panel">
          <div className="pj-det-actions-header">
            <span className="pj-det-actions-title">Acciones disponibles</span>
            <span className="pj-det-actions-subtitle">
              {hasActions ? `Acciones habilitadas para el estado "${ESTADO_LABELS[estado]}"` : 'Sin acciones disponibles'}
            </span>
          </div>

          {hasActions ? (
            <div className="pj-det-actions-grid">
              {canCargarAcuse && (
                <button type="button" className="pj-det-action-btn pj-det-action-btn--primary" onClick={() => openModal('acuse')}>
                  <span className="pj-det-action-icon">📋</span>
                  <span className="pj-det-action-label">Cargar Acuse</span>
                  <span className="pj-det-action-desc">Registrar resultado de notificación</span>
                </button>
              )}
              {canMarcarApremio && (
                <button type="button" className="pj-det-action-btn pj-det-action-btn--warning" onClick={() => openModal('apremio')}>
                  <span className="pj-det-action-icon">⚡</span>
                  <span className="pj-det-action-label">Marcar para Apremio</span>
                  <span className="pj-det-action-desc">Escalar a proceso de apremio</span>
                </button>
              )}
              {canAsignarAbogado && (
                <button type="button" className="pj-det-action-btn pj-det-action-btn--primary" onClick={() => openModal('abogado')}>
                  <span className="pj-det-action-icon">⚖️</span>
                  <span className="pj-det-action-label">Asignar Abogado</span>
                  <span className="pj-det-action-desc">Designar letrado responsable</span>
                </button>
              )}
              {canIniciarJuicio && (
                <button type="button" className="pj-det-action-btn pj-det-action-btn--primary" onClick={() => openModal('juicio')}>
                  <span className="pj-det-action-icon">🏛️</span>
                  <span className="pj-det-action-label">Iniciar Juicio</span>
                  <span className="pj-det-action-desc">Registrar inicio del proceso judicial</span>
                </button>
              )}
              {canAmpliarDemanda && (
                <button
                  type="button"
                  className="pj-det-action-btn pj-det-action-btn--ghost"
                  onClick={() => handleAction(() => legajoApi.ampliarDemanda(id, {}), 'Demanda ampliada')}
                  disabled={saving}
                >
                  <span className="pj-det-action-icon">📎</span>
                  <span className="pj-det-action-label">Ampliar Demanda</span>
                  <span className="pj-det-action-desc">Incorporar nuevos períodos</span>
                </button>
              )}
              {canFinalizar && (
                <button type="button" className="pj-det-action-btn pj-det-action-btn--danger" onClick={() => openModal('finalizar')}>
                  <span className="pj-det-action-icon">✅</span>
                  <span className="pj-det-action-label">Finalizar</span>
                  <span className="pj-det-action-desc">Cerrar el legajo judicial</span>
                </button>
              )}
              {canConfirmarDesbloqueo && (
                <button type="button" className="pj-det-action-btn pj-det-action-btn--ghost" onClick={() => openModal('desbloqueo')}>
                  <span className="pj-det-action-icon">🔓</span>
                  <span className="pj-det-action-label">Confirmar Desbloqueo Unix</span>
                  <span className="pj-det-action-desc">Confirmar desbloqueo en sistema</span>
                </button>
              )}
            </div>
          ) : (
            <div className="pj-det-no-actions">
              <span className="pj-det-no-actions-icon"><IconLock /></span>
              <p>Sin acciones disponibles para este estado</p>
            </div>
          )}
        </div>

        {/* ── LOWER SECTION ── */}
        <div className="pj-det-lower">
          {/* Timeline */}
          <div className="pj-det-card-wrap pj-det-card-wrap--timeline">
            <div className="pj-det-card-wrap-header">
              <span className="pj-det-card-wrap-title">Historial del legajo</span>
              <span className="pj-det-card-wrap-count">{historial.length} eventos</span>
            </div>
            <div className="pj-det-card-wrap-body">
              <LegajoTimeline historial={historial} />
            </div>
          </div>

          {/* Documentos */}
          <div className="pj-det-card-wrap pj-det-card-wrap--docs">
            <div className="pj-det-card-wrap-header">
              <span className="pj-det-card-wrap-title">Documentos</span>
            </div>
            <div className="pj-det-card-wrap-body">
              <DocumentosPanel legajo={legajo} userRole={isSuperAdmin ? 'Sistemas' : pjRole} onRefresh={cargar} />
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Acuse */}
      <PjModal open={modal === 'acuse'} onClose={closeModal} title="Cargar Acuse de Recibo">
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Fecha de Retorno</label>
          <input
            className="pj-det-modal-input"
            type="date"
            value={modalForm.fecha_retorno || ''}
            onChange={e => setModalForm(p => ({ ...p, fecha_retorno: e.target.value }))}
          />
        </div>
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Resultado</label>
          <select
            className="pj-det-modal-input"
            value={modalForm.resultado || ''}
            onChange={e => setModalForm(p => ({ ...p, resultado: e.target.value }))}
          >
            <option value="">— Seleccionar —</option>
            <option value="entregado">Entregado</option>
            <option value="rechazado">Rechazado</option>
            <option value="ausente">Ausente</option>
          </select>
        </div>
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Archivo PDF</label>
          <input
            className="pj-det-modal-input pj-det-modal-input--file"
            type="file"
            accept=".pdf"
            onChange={e => setModalForm(p => ({ ...p, archivo: e.target.files[0] || null }))}
          />
        </div>
        <div className="pj-det-modal-actions">
          <button type="button" className="pj-det-btn pj-det-btn--ghost" onClick={closeModal}>Cancelar</button>
          <button
            type="button"
            className="pj-det-btn pj-det-btn--primary"
            disabled={saving}
            onClick={() => {
              const fd = new FormData();
              if (modalForm.fecha_retorno) fd.append('fecha_retorno', modalForm.fecha_retorno);
              if (modalForm.resultado) fd.append('resultado', modalForm.resultado);
              if (modalForm.archivo) fd.append('archivo', modalForm.archivo);
              handleAction(() => legajoApi.subirAcuse(id, fd), 'Acuse cargado correctamente');
            }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </PjModal>

      {/* Marcar Apremio */}
      <PjModal open={modal === 'apremio'} onClose={closeModal} title="Marcar para Apremio">
        <p className="pj-det-modal-desc">¿Confirmar marcar este legajo para apremio?</p>
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Observaciones</label>
          <textarea
            className="pj-det-modal-input"
            rows={3}
            value={modalForm.observaciones || ''}
            onChange={e => setModalForm(p => ({ ...p, observaciones: e.target.value }))}
            placeholder="Observaciones opcionales..."
          />
        </div>
        <div className="pj-det-modal-actions">
          <button type="button" className="pj-det-btn pj-det-btn--ghost" onClick={closeModal}>Cancelar</button>
          <button
            type="button"
            className="pj-det-btn pj-det-btn--warning"
            disabled={saving}
            onClick={() => handleAction(() => legajoApi.marcarApremio(id, { observaciones: modalForm.observaciones }), 'Legajo marcado para apremio')}
          >
            {saving ? '...' : 'Confirmar'}
          </button>
        </div>
      </PjModal>

      {/* Asignar Abogado */}
      <PjModal open={modal === 'abogado'} onClose={closeModal} title="Asignar Abogado">
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Abogado</label>
          <select
            className="pj-det-modal-input"
            value={modalForm.abogado_id || ''}
            onChange={e => setModalForm(p => ({ ...p, abogado_id: e.target.value }))}
          >
            <option value="">— Seleccionar abogado —</option>
            {abogados.map(a => (
              <option key={a.id} value={a.id}>
                {[a.firstName, a.lastName].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="pj-det-modal-actions">
          <button type="button" className="pj-det-btn pj-det-btn--ghost" onClick={closeModal}>Cancelar</button>
          <button
            type="button"
            className="pj-det-btn pj-det-btn--primary"
            disabled={saving || !modalForm.abogado_id}
            onClick={() => handleAction(() => legajoApi.asignarAbogado(id, { abogado_id: modalForm.abogado_id }), 'Abogado asignado correctamente')}
          >
            {saving ? '...' : 'Asignar'}
          </button>
        </div>
      </PjModal>

      {/* Iniciar Juicio */}
      <PjModal open={modal === 'juicio'} onClose={closeModal} title="Iniciar Juicio">
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Nro. de Expediente *</label>
          <input
            className="pj-det-modal-input pj-det-modal-input--mono"
            type="text"
            placeholder="Ej: 12345/2026"
            value={modalForm.nro_expediente || ''}
            onChange={e => setModalForm(p => ({ ...p, nro_expediente: e.target.value }))}
          />
        </div>
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Fecha de Inicio</label>
          <input
            className="pj-det-modal-input"
            type="date"
            value={modalForm.fecha_inicio || ''}
            onChange={e => setModalForm(p => ({ ...p, fecha_inicio: e.target.value }))}
          />
        </div>
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Observaciones</label>
          <textarea
            className="pj-det-modal-input"
            rows={3}
            value={modalForm.observaciones || ''}
            onChange={e => setModalForm(p => ({ ...p, observaciones: e.target.value }))}
            placeholder="Observaciones opcionales..."
          />
        </div>
        <div className="pj-det-modal-actions">
          <button type="button" className="pj-det-btn pj-det-btn--ghost" onClick={closeModal}>Cancelar</button>
          <button
            type="button"
            className="pj-det-btn pj-det-btn--primary"
            disabled={saving || !modalForm.nro_expediente}
            onClick={() => handleAction(
              () => legajoApi.iniciarJuicio(id, {
                nro_expediente: modalForm.nro_expediente,
                fecha_inicio: modalForm.fecha_inicio,
                observaciones: modalForm.observaciones,
              }),
              'Juicio iniciado correctamente'
            )}
          >
            {saving ? '...' : 'Iniciar Juicio'}
          </button>
        </div>
      </PjModal>

      {/* Finalizar */}
      <PjModal open={modal === 'finalizar'} onClose={closeModal} title="Finalizar Legajo" danger>
        <p className="pj-det-modal-desc">Esta acción cerrará el legajo judicial definitivamente.</p>
        <div className="pj-det-modal-field">
          <label className="pj-det-modal-label">Observaciones</label>
          <textarea
            className="pj-det-modal-input"
            rows={3}
            value={modalForm.observaciones || ''}
            onChange={e => setModalForm(p => ({ ...p, observaciones: e.target.value }))}
            placeholder="Motivo de finalización..."
          />
        </div>
        <div className="pj-det-modal-actions">
          <button type="button" className="pj-det-btn pj-det-btn--ghost" onClick={closeModal}>Cancelar</button>
          <button
            type="button"
            className="pj-det-btn pj-det-btn--danger"
            disabled={saving}
            onClick={() => handleAction(() => legajoApi.finalizar(id, { observaciones: modalForm.observaciones }), 'Legajo finalizado')}
          >
            {saving ? '...' : 'Finalizar'}
          </button>
        </div>
      </PjModal>

      {/* Desbloqueo */}
      <PjModal open={modal === 'desbloqueo'} onClose={closeModal} title="Confirmar Desbloqueo Unix">
        <p className="pj-det-modal-desc">¿Confirmar el desbloqueo Unix para este legajo finalizado?</p>
        <div className="pj-det-modal-actions">
          <button type="button" className="pj-det-btn pj-det-btn--ghost" onClick={closeModal}>Cancelar</button>
          <button
            type="button"
            className="pj-det-btn pj-det-btn--primary"
            disabled={saving}
            onClick={() => handleAction(() => legajoApi.confirmarDesbloqueo(id, {}), 'Desbloqueo confirmado')}
          >
            {saving ? '...' : 'Confirmar Desbloqueo'}
          </button>
        </div>
      </PjModal>
    </AppLayout>
  );
}

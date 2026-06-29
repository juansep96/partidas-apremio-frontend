import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sileo } from 'sileo';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import { useAuth } from '../../context/AuthContext';
import { legajoApi, partidaApi, padronApi } from '../../api/recaudacionApi';
import './PartidaListPage.css';

function formatMonto(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

const ESTADOS = [
  '', 'deuda_informada', 'en_intimacion', 'notificada', 'rechazada',
  'marcada_apremio', 'asignada_legales', 'en_juicio', 'finalizada',
];

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

// SVG Icons
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
  </svg>
);

const IconUpload = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 9V2M4 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const IconArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M4 7h6M8 5l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconInbox = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <rect x="4" y="10" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M4 22h9l3 5h8l3-5h9" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
  </svg>
);

// Modal component
function PjListModal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="pj-list-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`pj-list-modal${wide ? ' pj-list-modal--wide' : ''}`}>
        <div className="pj-list-modal-header">
          <h2 className="pj-list-modal-title">{title}</h2>
          <button type="button" className="pj-list-modal-close" onClick={onClose} aria-label="Cerrar">
            <IconX />
          </button>
        </div>
        <div className="pj-list-modal-body">{children}</div>
      </div>
    </div>
  );
}

// Legajo card row
function LegajoCard({ legajo }) {
  const estado = legajo.estado;
  const color = ESTADO_COLORS[estado] || '#94a3b8';
  const nroPartida = legajo.partida?.nro_partida || legajo.nro_partida || `#${legajo.id}`;
  const titular = legajo.partida?.titular_nombre || legajo.partida?.titular || legajo.titular || '—';
  const capital = legajo.partida?.monto_capital ?? legajo.monto_capital ?? null;
  const zona = legajo.partida?.zona || legajo.zona || null;

  return (
    <div className="pj-list-card" style={{ '--estado-color': color }}>
      <div className="pj-list-card-strip" />
      <div className="pj-list-card-main">
        <div className="pj-list-card-left">
          <span className="pj-list-card-partida">{nroPartida}</span>
          <span className="pj-list-card-titular">{titular}</span>
        </div>
        <div className="pj-list-card-right">
          {capital != null && (
            <span className="pj-list-card-capital">{formatMonto(capital)}</span>
          )}
          <div className="pj-list-card-badges">
            <EstadoBadge estado={estado} />
            {zona && <span className="pj-list-card-zona">{zona}</span>}
          </div>
          <Link to={`/recaudacion/legajos/${legajo.id}`} className="pj-list-card-link">
            <span>Ver legajo</span>
            <IconArrowRight />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PartidaListPage() {
  const { user, systems } = useAuth();
  const recSystem = systems?.find(s => s.modules?.some(m => m.route?.startsWith('/recaudacion')));
  const pjRole = recSystem?.role;
  const isSuperAdmin = user?.globalRole === 'SUPERADMIN';
  const canImport = isSuperAdmin || ['Sistemas', 'Recaudacion'].includes(pjRole);

  const [legajos, setLegajos] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', estado: '', zona: '', abogado_id: '' });
  const [applied, setApplied] = useState({ q: '', estado: '', zona: '', abogado_id: '' });
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  // Padrón: 'upload' -> seleccionar archivo; 'preview' -> mostrar diff y confirmar
  const [padronStep, setPadronStep] = useState('upload');
  const [padronDiff, setPadronDiff] = useState(null);

  const resetPadron = () => {
    setImportModal(false);
    setImportFile(null);
    setPadronStep('upload');
    setPadronDiff(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const emptyManual = { nro_partida: '', titular_nombre: '', titular_dni: '', titular_domicilio: '', zona: '', codigo_postal: '', monto_capital: '', monto_intereses: '', cuotas_adeudadas: '' };
  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManual);
  const [savingManual, setSavingManual] = useState(false);

  const cargar = async (p = page, f = applied) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p, per_page: 15 };
      if (f.q) params.q = f.q;
      if (f.estado) params.estado = f.estado;
      if (f.zona) params.zona = f.zona;
      if (f.abogado_id) params.abogado_id = f.abogado_id;
      const res = await legajoApi.list(params);
      setLegajos(res.data || res || []);
      setMeta(res.meta || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(1, applied); }, []);

  const handleApply = () => {
    setPage(1);
    setApplied({ ...filters });
    cargar(1, filters);
  };

  const handleClear = () => {
    const empty = { q: '', estado: '', zona: '', abogado_id: '' };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
    cargar(1, empty);
  };

  const handlePage = (p) => {
    setPage(p);
    cargar(p, applied);
  };

  // Paso 1: subir padrón y obtener diff (sin aplicar)
  const handlePadronPreview = async (e) => {
    e.preventDefault();
    if (!importFile) return sileo.error({ title: 'Seleccioná el archivo del padrón' });
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('archivo', importFile);
      const diff = await padronApi.preview(fd);
      setPadronDiff(diff);
      setPadronStep('preview');
    } catch (err) {
      sileo.error({ title: 'Error al analizar el padrón', description: err.message });
    } finally {
      setImporting(false);
    }
  };

  // Paso 2: confirmar y aplicar
  const handlePadronConfirm = async () => {
    if (!padronDiff?.token) return;
    setImporting(true);
    try {
      const res = await padronApi.confirmar(padronDiff.token);
      sileo.success({
        title: 'Padrón actualizado',
        description: `${res.insertadas} nuevas · ${res.actualizadas} actualizadas`,
      });
      resetPadron();
      cargar(1, applied);
    } catch (err) {
      sileo.error({ title: 'Error al aplicar el padrón', description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setSavingManual(true);
    try {
      const payload = {
        ...manualForm,
        monto_capital: parseFloat(manualForm.monto_capital) || 0,
        monto_intereses: parseFloat(manualForm.monto_intereses) || 0,
        cuotas_adeudadas: parseInt(manualForm.cuotas_adeudadas) || 0,
      };
      const legajo = await partidaApi.crearManual(payload);
      sileo.success({ title: 'Partida creada', description: `Legajo ${legajo.partida?.nro_partida || ''} en estado Deuda Informada` });
      setManualModal(false);
      setManualForm(emptyManual);
      cargar(1, applied);
    } catch (err) {
      sileo.error({ title: 'Error al crear', description: err.message });
    } finally {
      setSavingManual(false);
    }
  };

  const totalPages = meta ? Math.ceil(meta.total / (meta.per_page || 15)) : 1;

  // Stats derived from loaded data
  const enProceso = legajos.filter(l => !['finalizada', 'rechazada'].includes(l.estado)).length;
  const finalizadas = legajos.filter(l => l.estado === 'finalizada').length;
  const totalCapital = legajos.reduce((s, l) => s + (l.partida?.monto_capital || l.monto_capital || 0), 0);

  // Build page number array for pagination
  const buildPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages));
    return Array.from(pages).sort((a, b) => a - b);
  };

  const pageNums = buildPages();

  return (
    <AppLayout>
      <div className="pj-list-page">

        {/* ── HERO ── */}
        <div className="pj-list-hero">
          <div className="pj-list-hero-bg" />
          <div className="pj-list-hero-content">
            <div className="pj-list-hero-left">
              <p className="pj-list-hero-eyebrow">Sistema Judicial Municipal</p>
              <h1 className="pj-list-hero-title">Partidas y Legajos</h1>
              {meta && (
                <p className="pj-list-hero-subtitle">
                  {meta.total.toLocaleString('es-AR')} legajos registrados en el sistema
                </p>
              )}
            </div>
            {canImport && (
              <div className="pj-list-hero-actions">
                <button type="button" className="pj-list-btn pj-list-btn--primary" onClick={() => setManualModal(true)}>
                  <IconPlus />
                  <span>Nueva partida</span>
                </button>
                <button type="button" className="pj-list-btn pj-list-btn--glass" onClick={() => { setPadronStep('upload'); setPadronDiff(null); setImportFile(null); setImportModal(true); }}>
                  <IconUpload />
                  <span>Actualizar Padrón</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {!loading && meta && (
          <div className="pj-list-stats-bar">
            <div className="pj-list-stat">
              <span className="pj-list-stat-value">{meta.total.toLocaleString('es-AR')}</span>
              <span className="pj-list-stat-label">Total partidas</span>
            </div>
            <div className="pj-list-stat-divider" />
            <div className="pj-list-stat">
              <span className="pj-list-stat-value pj-list-stat-value--teal">{formatMonto(totalCapital)}</span>
              <span className="pj-list-stat-label">Capital en esta página</span>
            </div>
            <div className="pj-list-stat-divider" />
            <div className="pj-list-stat">
              <span className="pj-list-stat-value pj-list-stat-value--orange">{enProceso}</span>
              <span className="pj-list-stat-label">En proceso</span>
            </div>
            <div className="pj-list-stat-divider" />
            <div className="pj-list-stat">
              <span className="pj-list-stat-value pj-list-stat-value--green">{finalizadas}</span>
              <span className="pj-list-stat-label">Finalizadas</span>
            </div>
          </div>
        )}

        {/* ── FILTER BAR ── */}
        <div className="pj-list-filter-bar">
          {/* Search */}
          <div className="pj-list-filter-search">
            <span className="pj-list-filter-search-icon"><IconSearch /></span>
            <input
              type="text"
              className="pj-list-filter-input pj-list-filter-input--search"
              placeholder="Buscar por partida, titular..."
              value={filters.q}
              onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleApply()}
            />
          </div>

          {/* Estado */}
          <div className="pj-list-filter-field">
            <select
              className="pj-list-filter-input pj-list-filter-input--select"
              value={filters.estado}
              onChange={e => setFilters(p => ({ ...p, estado: e.target.value }))}
            >
              {ESTADOS.map(e => (
                <option key={e} value={e}>{e ? ESTADO_LABELS[e] : 'Todos los estados'}</option>
              ))}
            </select>
          </div>

          {/* Zona */}
          <div className="pj-list-filter-field">
            <input
              type="text"
              className="pj-list-filter-input"
              placeholder="Zona"
              value={filters.zona}
              onChange={e => setFilters(p => ({ ...p, zona: e.target.value }))}
            />
          </div>

          <button type="button" className="pj-list-btn pj-list-btn--primary pj-list-btn--sm" onClick={handleApply}>
            Filtrar
          </button>
          <button type="button" className="pj-list-filter-clear" onClick={handleClear}>
            Limpiar
          </button>
        </div>

        {/* ── CONTENT ── */}
        <div className="pj-list-content">
          {loading && (
            <div className="pj-list-loading-wrap">
              <div className="pj-list-spinner" />
              <p>Cargando legajos...</p>
            </div>
          )}

          {error && (
            <div className="pj-list-error-wrap">
              <p>Error: {error}</p>
              <button className="pj-list-btn pj-list-btn--ghost pj-list-btn--sm" onClick={() => cargar()}>Reintentar</button>
            </div>
          )}

          {!loading && !error && legajos.length === 0 && (
            <div className="pj-list-empty">
              <span className="pj-list-empty-icon"><IconInbox /></span>
              <p className="pj-list-empty-title">Sin resultados</p>
              <p className="pj-list-empty-sub">No hay legajos que coincidan con los filtros seleccionados.</p>
              <button type="button" className="pj-list-btn pj-list-btn--ghost pj-list-btn--sm" onClick={handleClear}>
                Limpiar filtros
              </button>
            </div>
          )}

          {!loading && !error && legajos.length > 0 && (
            <>
              <div className="pj-list-cards">
                {legajos.map(l => <LegajoCard key={l.id} legajo={l} />)}
              </div>

              {/* Pagination */}
              {meta && totalPages > 1 && (
                <div className="pj-list-pagination">
                  <span className="pj-list-pagination-info">
                    Página {page} de {totalPages} · {meta.total} resultados
                  </span>
                  <div className="pj-list-pagination-pills">
                    <button
                      type="button"
                      className="pj-list-page-pill pj-list-page-pill--nav"
                      onClick={() => handlePage(page - 1)}
                      disabled={page <= 1}
                    >
                      ←
                    </button>

                    {pageNums.map((p, i) => {
                      const prevP = pageNums[i - 1];
                      const showEllipsis = prevP && p - prevP > 1;
                      return (
                        <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          {showEllipsis && (
                            <span className="pj-list-page-ellipsis">…</span>
                          )}
                          <button
                            type="button"
                            className={`pj-list-page-pill${p === page ? ' pj-list-page-pill--active' : ''}`}
                            onClick={() => p !== page && handlePage(p)}
                          >
                            {p}
                          </button>
                        </span>
                      );
                    })}

                    <button
                      type="button"
                      className="pj-list-page-pill pj-list-page-pill--nav"
                      onClick={() => handlePage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MODAL: Nueva Partida ── */}
      <PjListModal open={manualModal} onClose={() => { setManualModal(false); setManualForm(emptyManual); }} title="Nueva Partida" wide>
        <form onSubmit={handleManualSubmit}>
          <div className="pj-list-modal-grid">
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">Nro. de Partida *</label>
              <input
                className="pj-list-modal-input pj-list-modal-input--mono"
                type="text"
                placeholder="ej: 12345-6"
                value={manualForm.nro_partida}
                onChange={e => setManualForm(p => ({ ...p, nro_partida: e.target.value }))}
                required
              />
            </div>
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">DNI del titular</label>
              <input
                className="pj-list-modal-input"
                type="text"
                placeholder="Sin puntos"
                value={manualForm.titular_dni}
                onChange={e => setManualForm(p => ({ ...p, titular_dni: e.target.value }))}
              />
            </div>
            <div className="pj-list-modal-field pj-list-modal-field--full">
              <label className="pj-list-modal-label">Nombre del titular *</label>
              <input
                className="pj-list-modal-input"
                type="text"
                placeholder="Apellido, Nombre"
                value={manualForm.titular_nombre}
                onChange={e => setManualForm(p => ({ ...p, titular_nombre: e.target.value }))}
                required
              />
            </div>
            <div className="pj-list-modal-field pj-list-modal-field--full">
              <label className="pj-list-modal-label">Domicilio</label>
              <input
                className="pj-list-modal-input"
                type="text"
                placeholder="Calle y número"
                value={manualForm.titular_domicilio}
                onChange={e => setManualForm(p => ({ ...p, titular_domicilio: e.target.value }))}
              />
            </div>
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">Zona</label>
              <input
                className="pj-list-modal-input"
                type="text"
                value={manualForm.zona}
                onChange={e => setManualForm(p => ({ ...p, zona: e.target.value }))}
              />
            </div>
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">Código Postal</label>
              <input
                className="pj-list-modal-input"
                type="text"
                value={manualForm.codigo_postal}
                onChange={e => setManualForm(p => ({ ...p, codigo_postal: e.target.value }))}
              />
            </div>
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">Capital ($) *</label>
              <input
                className="pj-list-modal-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={manualForm.monto_capital}
                onChange={e => setManualForm(p => ({ ...p, monto_capital: e.target.value }))}
                required
              />
            </div>
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">Intereses ($)</label>
              <input
                className="pj-list-modal-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={manualForm.monto_intereses}
                onChange={e => setManualForm(p => ({ ...p, monto_intereses: e.target.value }))}
              />
            </div>
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">Cuotas adeudadas</label>
              <input
                className="pj-list-modal-input"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={manualForm.cuotas_adeudadas}
                onChange={e => setManualForm(p => ({ ...p, cuotas_adeudadas: e.target.value }))}
              />
            </div>
          </div>
          <div className="pj-list-modal-actions">
            <button type="button" className="pj-list-btn pj-list-btn--ghost" onClick={() => { setManualModal(false); setManualForm(emptyManual); }}>
              Cancelar
            </button>
            <button type="submit" className="pj-list-btn pj-list-btn--primary" disabled={savingManual}>
              {savingManual ? 'Guardando...' : 'Crear partida'}
            </button>
          </div>
        </form>
      </PjListModal>

      {/* ── MODAL: Actualizar Padrón (dry-run + confirmar) ── */}
      <PjListModal open={importModal} onClose={resetPadron} title="Actualizar Padrón" wide={padronStep === 'preview'}>
        {padronStep === 'upload' && (
          <form onSubmit={handlePadronPreview}>
            <p className="pj-list-modal-desc">
              Subí el padrón municipal (.txt / .DAT). Se analizará y verás qué partidas se crean
              o actualizan <strong>antes</strong> de aplicar los cambios.
            </p>
            <div className="pj-list-modal-field">
              <label className="pj-list-modal-label">Archivo del padrón</label>
              <input
                ref={fileRef}
                className="pj-list-modal-input pj-list-modal-input--file"
                type="file"
                accept=".txt,.dat,.DAT"
                onChange={e => setImportFile(e.target.files[0] || null)}
              />
            </div>
            <div className="pj-list-modal-actions">
              <button type="button" className="pj-list-btn pj-list-btn--ghost" onClick={resetPadron}>
                Cancelar
              </button>
              <button type="submit" className="pj-list-btn pj-list-btn--primary" disabled={importing}>
                {importing ? 'Analizando...' : 'Analizar'}
              </button>
            </div>
          </form>
        )}

        {padronStep === 'preview' && padronDiff && (
          <div>
            <p className="pj-list-modal-desc">
              <strong>{padronDiff.nombre_archivo}</strong> — revisá los cambios antes de confirmar.
            </p>
            <div className="pj-padron-resumen">
              <span className="pj-padron-chip pj-padron-chip--new">{padronDiff.resumen.nuevas} nuevas</span>
              <span className="pj-padron-chip pj-padron-chip--upd">{padronDiff.resumen.actualizar} a actualizar</span>
              <span className="pj-padron-chip">{padronDiff.resumen.sin_cambios} sin cambios</span>
              {padronDiff.resumen.duplicadas_archivo > 0 && (
                <span className="pj-padron-chip pj-padron-chip--warn">{padronDiff.resumen.duplicadas_archivo} duplicadas en archivo</span>
              )}
              {padronDiff.resumen.invalidas > 0 && (
                <span className="pj-padron-chip pj-padron-chip--err">{padronDiff.resumen.invalidas} líneas inválidas</span>
              )}
            </div>

            {padronDiff.muestra?.length > 0 && (
              <div className="pj-padron-muestra">
                <table className="pj-table">
                  <thead>
                    <tr><th>Partida</th><th>Titular</th><th>Acción</th><th>Cambios</th></tr>
                  </thead>
                  <tbody>
                    {padronDiff.muestra.map((m, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{m.nro_partida}</td>
                        <td>{m.titular || '—'}</td>
                        <td>{m.accion === 'nueva' ? 'Nueva' : 'Actualizar'}</td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {m.accion === 'nueva'
                            ? '—'
                            : Object.entries(m.cambios).slice(0, 4).map(([campo, v]) => (
                                <div key={campo}>
                                  <strong>{campo}</strong>: {String(v.antes ?? '∅')} → {String(v.despues ?? '∅')}
                                </div>
                              ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="pj-list-modal-desc" style={{ fontSize: '0.78rem' }}>
                  Mostrando hasta {padronDiff.muestra.length} de {padronDiff.resumen.nuevas + padronDiff.resumen.actualizar} cambios.
                </p>
              </div>
            )}

            <div className="pj-list-modal-actions">
              <button type="button" className="pj-list-btn pj-list-btn--ghost" onClick={() => setPadronStep('upload')}>
                Volver
              </button>
              <button type="button" className="pj-list-btn pj-list-btn--primary" disabled={importing} onClick={handlePadronConfirm}>
                {importing ? 'Aplicando...' : `Confirmar (${padronDiff.resumen.nuevas + padronDiff.resumen.actualizar} cambios)`}
              </button>
            </div>
          </div>
        )}
      </PjListModal>
    </AppLayout>
  );
}

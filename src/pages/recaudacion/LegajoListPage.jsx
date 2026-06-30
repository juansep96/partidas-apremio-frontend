import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import { legajoApi } from '../../api/recaudacionApi';
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

export default function LegajoListPage() {
  const [legajos, setLegajos] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const EMPTY_FILTERS = { q: '', estado: '', zona: '', abogado_id: '', localidad: '', circunscripcion: '', ejercicio: '', con_contacto: false };
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [moreFilters, setMoreFilters] = useState(false);

  const cargar = async (p = page, f = applied) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p, per_page: 15 };
      if (f.q) params.q = f.q;
      if (f.estado) params.estado = f.estado;
      if (f.zona) params.zona = f.zona;
      if (f.abogado_id) params.abogado_id = f.abogado_id;
      if (f.localidad) params.localidad = f.localidad;
      if (f.circunscripcion) params.circunscripcion = f.circunscripcion;
      if (f.ejercicio) params.ejercicio = f.ejercicio;
      if (f.con_contacto) params.con_contacto = 1;
      const res = await legajoApi.list(params);
      setLegajos(res.data || res || []);
      // Laravel paginator trae total/per_page/current_page al nivel raíz (no en `meta`)
      const meta = res.meta
        || (res.total !== undefined
          ? { total: res.total, per_page: res.per_page, current_page: res.current_page, last_page: res.last_page }
          : null);
      setMeta(meta);
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
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
    cargar(1, EMPTY_FILTERS);
  };

  const handlePage = (p) => {
    setPage(p);
    cargar(p, applied);
  };

  const totalPages = meta ? Math.ceil(meta.total / (meta.per_page || 15)) : 1;

  // Stats derived from loaded data
  const enProceso = legajos.filter(l => !['finalizada', 'rechazada'].includes(l.estado)).length;
  const finalizadas = legajos.filter(l => l.estado === 'finalizada').length;
  const totalCapital = legajos.reduce((s, l) => s + (l.partida?.monto_capital || l.monto_capital || 0), 0);

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
              <h1 className="pj-list-hero-title">Legajos</h1>
              {meta && (
                <p className="pj-list-hero-subtitle">
                  {meta.total.toLocaleString('es-AR')} legajos en gestión de apremio
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {!loading && meta && (
          <div className="pj-list-stats-bar">
            <div className="pj-list-stat">
              <span className="pj-list-stat-value">{meta.total.toLocaleString('es-AR')}</span>
              <span className="pj-list-stat-label">Total legajos</span>
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

          <div className="pj-list-filter-field">
            <input
              type="text"
              className="pj-list-filter-input"
              placeholder="Zona"
              value={filters.zona}
              onChange={e => setFilters(p => ({ ...p, zona: e.target.value }))}
            />
          </div>

          <button type="button" className="pj-list-filter-clear" onClick={() => setMoreFilters(o => !o)}>
            {moreFilters ? 'Menos filtros ▴' : 'Más filtros ▾'}
          </button>
          <button type="button" className="pj-list-btn pj-list-btn--primary pj-list-btn--sm" onClick={handleApply}>
            Filtrar
          </button>
          <button type="button" className="pj-list-filter-clear" onClick={handleClear}>
            Limpiar
          </button>
        </div>

        {/* ── FILTROS AVANZADOS ── */}
        {moreFilters && (
          <div className="pj-list-filter-bar pj-list-filter-bar--more">
            <div className="pj-list-filter-field">
              <input type="text" className="pj-list-filter-input" placeholder="Localidad"
                value={filters.localidad} onChange={e => setFilters(p => ({ ...p, localidad: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleApply()} />
            </div>
            <div className="pj-list-filter-field">
              <input type="text" className="pj-list-filter-input" placeholder="Circunscripción"
                value={filters.circunscripcion} onChange={e => setFilters(p => ({ ...p, circunscripcion: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleApply()} />
            </div>
            <div className="pj-list-filter-field">
              <input type="number" className="pj-list-filter-input" placeholder="Ejercicio (año)"
                value={filters.ejercicio} onChange={e => setFilters(p => ({ ...p, ejercicio: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleApply()} />
            </div>
            <label className="pj-list-filter-checklabel">
              <input type="checkbox" checked={filters.con_contacto}
                onChange={e => setFilters(p => ({ ...p, con_contacto: e.target.checked }))} />
              Solo con contacto (mail/tel)
            </label>
          </div>
        )}

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
    </AppLayout>
  );
}

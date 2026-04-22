import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import { useAuth } from '../../context/AuthContext';
import { estadisticasApi, alertasApi } from '../../api/recaudacionApi';
import './EstadisticasPage.css';

/* ─────────────────── Formatters ─────────────────── */
function formatMonto(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}
function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmt2(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

/* ─────────────────── Constants ─────────────────── */
const ESTADO_COLORS = {
  deuda_informada:  '#94a3b8',
  en_intimacion:    '#f59e0b',
  notificada:       '#3b82f6',
  rechazada:        '#ef4444',
  marcada_apremio:  '#f97316',
  asignada_legales: '#8b5cf6',
  en_juicio:        '#6366f1',
  finalizada:       '#10b981',
};

const ESTADO_LABELS = {
  deuda_informada:  'Deuda informada',
  en_intimacion:    'En intimación',
  notificada:       'Notificada',
  rechazada:        'Rechazada',
  marcada_apremio:  'Marcada apremio',
  asignada_legales: 'Asignada legales',
  en_juicio:        'En juicio',
  finalizada:       'Finalizada',
};

const FUNNEL_STATES = [
  'deuda_informada',
  'en_intimacion',
  'notificada',
  'marcada_apremio',
  'asignada_legales',
  'en_juicio',
  'finalizada',
];

const ABOGADO_SORT_OPTIONS = [
  { key: 'total_asignados', label: 'Total asignados' },
  { key: 'finalizados',     label: 'Finalizados' },
  { key: 'capital_gestionado', label: 'Capital gestionado' },
];

/* ─────────────────── Skeleton ─────────────────── */
function Skeleton({ h = 24, w = '100%', radius = 8, mb = 0 }) {
  return (
    <div
      className="pj-stats-skeleton"
      style={{ height: h, width: w, borderRadius: radius, marginBottom: mb }}
    />
  );
}

function SectionSkeleton() {
  return (
    <div className="pj-stats-section" style={{ padding: '1.375rem' }}>
      <Skeleton h={18} w="40%" mb={16} />
      <Skeleton h={12} mb={10} />
      <Skeleton h={12} w="85%" mb={10} />
      <Skeleton h={12} w="70%" mb={10} />
      <Skeleton h={12} w="55%" />
    </div>
  );
}

/* ─────────────────── Error Card ─────────────────── */
function ErrorCard({ message, onRetry }) {
  return (
    <div className="pj-stats-error-card">
      <div className="pj-stats-error-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="#ef4444" strokeWidth="2"/>
          <path d="M16 9v8M16 20v2" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="pj-stats-error-msg">Error al cargar: {message}</div>
      <button className="pj-stats-retry-btn" onClick={onRetry}>Reintentar</button>
    </div>
  );
}

/* ─────────────────── Empty State ─────────────────── */
function EmptyState({ label = 'Sin datos para el período seleccionado' }) {
  return (
    <div className="pj-stats-empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="14" width="36" height="26" rx="4" stroke="#cbd5e1" strokeWidth="2"/>
        <path d="M16 14v-3a8 8 0 0116 0v3" stroke="#cbd5e1" strokeWidth="2"/>
        <path d="M18 26h12M18 32h8" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <p>{label}</p>
    </div>
  );
}

/* ─────────────────── Donut SVG ─────────────────── */
function DonutChart({ segments, size = 180, centerLabel, centerSub }) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.34;
  const stroke = size * 0.16;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {total === 0 ? null : segments.map((seg, i) => {
        const pct = seg.value / total;
        const dashLen = pct * circ;
        const dashGap = circ - dashLen;
        const dashOffset = circ * (1 - offset) - circ * 0.25;
        offset += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={stroke}
            strokeDasharray={`${dashLen} ${dashGap}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.7s ease', transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
          />
        );
      })}
      <text x={cx} y={cy - 9} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: size * 0.17, fontWeight: 800, fill: '#0f172a', fontFamily: 'inherit' }}>
        {centerLabel ?? total}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: size * 0.085, fill: '#94a3b8', fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {centerSub ?? 'total'}
      </text>
    </svg>
  );
}

/* ─────────────────── Tendencia SVG Chart ─────────────────── */
function TendenciaChart({ meses, animated }) {
  const W = 640, H = 300;
  const PAD = { top: 24, right: 70, bottom: 52, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  if (!meses || meses.length === 0) return <EmptyState />;

  const maxLegajos = Math.max(...meses.map(m => m.legajos_creados || 0), 1);
  const maxCapital  = Math.max(...meses.map(m => m.capital_ingresado || 0), 1);
  const barW = (chartW / meses.length) * 0.55;
  const gap  = chartW / meses.length;

  const bx = i => PAD.left + i * gap + gap / 2;
  const by = v => PAD.top + chartH - (v / maxLegajos) * chartH;
  const ly = v => PAD.top + chartH - (v / maxCapital) * chartH;

  const linePath = meses
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${bx(i).toFixed(1)},${ly(m.capital_ingresado || 0).toFixed(1)}`)
    .join(' ');

  const gridLines = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible', display: 'block' }}>
      {/* grid */}
      {gridLines.map(f => (
        <line key={f}
          x1={PAD.left} x2={W - PAD.right}
          y1={PAD.top + chartH * (1 - f)} y2={PAD.top + chartH * (1 - f)}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
      ))}
      {/* Y left axis ticks */}
      {gridLines.map(f => (
        <text key={f}
          x={PAD.left - 8} y={PAD.top + chartH * (1 - f) + 4}
          textAnchor="end"
          style={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'inherit' }}>
          {Math.round(maxLegajos * f)}
        </text>
      ))}
      {/* Y right axis label */}
      <text x={W - PAD.right + 8} y={PAD.top}
        textAnchor="start"
        style={{ fontSize: 10, fill: '#f59e0b', fontFamily: 'inherit', fontWeight: 700 }}>
        capital
      </text>
      {/* bars */}
      {meses.map((m, i) => {
        const barHeight = animated ? ((m.legajos_creados || 0) / maxLegajos) * chartH : 0;
        const barY = animated ? by(m.legajos_creados || 0) : PAD.top + chartH;
        return (
          <rect key={i}
            x={bx(i) - barW / 2} y={barY}
            width={barW} height={barHeight}
            fill="#015a6a" fillOpacity="0.75" rx="3"
            style={{ transition: 'y 0.7s cubic-bezier(.4,0,.2,1), height 0.7s cubic-bezier(.4,0,.2,1)' }}
          />
        );
      })}
      {/* finalizados overlay bars */}
      {meses.map((m, i) => {
        const barHeight = animated ? ((m.finalizados || 0) / maxLegajos) * chartH : 0;
        const barY = animated ? by(m.finalizados || 0) : PAD.top + chartH;
        return (
          <rect key={i}
            x={bx(i) - barW / 2} y={barY}
            width={barW * 0.45} height={barHeight}
            fill="#10b981" fillOpacity="0.8" rx="2"
            style={{ transition: 'y 0.7s cubic-bezier(.4,0,.2,1) 0.1s, height 0.7s cubic-bezier(.4,0,.2,1) 0.1s' }}
          />
        );
      })}
      {/* capital line */}
      <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ opacity: animated ? 1 : 0, transition: 'opacity 0.6s ease 0.4s' }} />
      {/* dots */}
      {meses.map((m, i) => (
        <circle key={i} cx={bx(i)} cy={ly(m.capital_ingresado || 0)} r="4.5"
          fill="#f59e0b" stroke="white" strokeWidth="2"
          style={{ opacity: animated ? 1 : 0, transition: `opacity 0.4s ease ${0.5 + i * 0.03}s` }} />
      ))}
      {/* X axis labels */}
      {meses.map((m, i) => (
        <text key={i}
          x={bx(i)} y={H - 10}
          textAnchor="middle"
          style={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'inherit' }}>
          {(m.label || m.mes || '').slice(0, 6)}
        </text>
      ))}
      {/* axis lines */}
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + chartH + 4} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  );
}

/* ─────────────────── Funnel ─────────────────── */
function FunnelChart({ funnel }) {
  const steps = FUNNEL_STATES.map(key => ({
    key,
    label: ESTADO_LABELS[key] || key,
    count: funnel?.[key] ?? 0,
    color: ESTADO_COLORS[key],
  }));
  const topCount = steps[0]?.count || 1;

  const tasaJudicializacion = topCount > 0
    ? (((funnel?.en_juicio || 0) / topCount) * 100).toFixed(1)
    : '0.0';
  const tasaFinalizacion = topCount > 0
    ? (((funnel?.finalizada || 0) / topCount) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="pj-stats-funnel-wrap">
      <div className="pj-stats-funnel-steps">
        {steps.map((step, i) => {
          const pct = topCount > 0 ? Math.max((step.count / topCount) * 100, 4) : 4;
          const pctLabel = topCount > 0 ? ((step.count / topCount) * 100).toFixed(1) : '0.0';
          const widthBase = 100 - (100 - pct) * 0.5;
          const clipTop = 100 - (widthBase);
          const clipBot = Math.max(100 - (pct), 0);
          return (
            <div key={step.key} className="pj-stats-funnel-step-wrap">
              <div
                className="pj-stats-funnel-step"
                style={{
                  background: step.color,
                  clipPath: `polygon(${clipTop / 2}% 0%, ${100 - clipTop / 2}% 0%, ${100 - clipBot / 2}% 100%, ${clipBot / 2}% 100%)`,
                  opacity: 0.88 - i * 0.05,
                }}
              >
                <span className="pj-stats-funnel-label">{step.label}</span>
                <span className="pj-stats-funnel-count">{step.count}</span>
                <span className="pj-stats-funnel-pct">{pctLabel}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pj-stats-funnel-rates">
        <div className="pj-stats-funnel-rate">
          <span className="pj-stats-funnel-rate-label">Tasa de judicialización</span>
          <span className="pj-stats-funnel-rate-val" style={{ color: '#6366f1' }}>{tasaJudicializacion}%</span>
        </div>
        <div className="pj-stats-funnel-rate">
          <span className="pj-stats-funnel-rate-label">Tasa de finalización</span>
          <span className="pj-stats-funnel-rate-val" style={{ color: '#10b981' }}>{tasaFinalizacion}%</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Bar Row ─────────────────── */
function BarRow({ label, count, maxCount, color, monto, pct, animated }) {
  const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="pj-stats-bar-row">
      <div className="pj-stats-bar-label">
        <span className="pj-stats-bar-dot" style={{ background: color }} />
        <span className="pj-stats-bar-name">{label}</span>
      </div>
      <div className="pj-stats-bar-track-wrap">
        <div className="pj-stats-bar-track">
          <div className="pj-stats-bar-fill" style={{ width: animated ? `${barPct}%` : '0%', background: color }} />
        </div>
      </div>
      <div className="pj-stats-bar-meta">
        <span className="pj-stats-bar-count" style={{ color }}>{count}</span>
        <span className="pj-stats-bar-pct">{pct}%</span>
        {monto != null && <span className="pj-stats-bar-monto">{formatMonto(monto)}</span>}
      </div>
    </div>
  );
}

/* ─────────────────── Zona Table ─────────────────── */
function ZonasTable({ zonas }) {
  const [sortKey, setSortKey] = useState('capital_total');
  const [sortDir, setSortDir] = useState('desc');

  if (!zonas || zonas.length === 0) return <EmptyState label="Sin datos de zonas para el período" />;

  const maxCap = Math.max(...zonas.map(z => z.capital_total || 0), 1);

  const sorted = [...zonas].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const maxCapSorted = Math.max(...sorted.map(z => z.capital_total || 0), 1);
  const topZona = sorted[0]?.zona_nombre || sorted[0]?.zona;

  const handleSort = (key) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 4, verticalAlign: 'middle', opacity: sortKey === col ? 1 : 0.35 }}>
      {sortDir === 'asc' && sortKey === col
        ? <path d="M5 2L9 8H1z" fill="currentColor" />
        : <path d="M5 8L1 2h8z" fill="currentColor" />
      }
    </svg>
  );

  return (
    <div className="pj-stats-zonas-table-wrap">
      <table className="pj-stats-zonas-table">
        <thead>
          <tr>
            {[
              { key: 'zona_nombre', label: 'Zona' },
              { key: 'partidas',    label: 'Partidas' },
              { key: 'capital_total', label: 'Capital total' },
              { key: 'intereses',   label: 'Intereses' },
              { key: 'en_juicio',   label: 'En juicio' },
              { key: 'finalizados', label: 'Finalizados' },
            ].map(col => (
              <th key={col.key} onClick={() => handleSort(col.key)} className="pj-stats-zonas-th">
                {col.label}<SortIcon col={col.key} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((zona, i) => {
            const nombre = zona.zona_nombre || zona.zona || `Zona ${i + 1}`;
            const isTop = nombre === topZona;
            const capPct = maxCapSorted > 0 ? (zona.capital_total / maxCapSorted) * 100 : 0;
            return (
              <tr key={nombre} className={`pj-stats-zonas-row${isTop ? ' pj-stats-zonas-row--top' : ''}`}>
                <td className="pj-stats-zonas-td pj-stats-zonas-zona">
                  {isTop && <span className="pj-stats-zonas-crown">★</span>}
                  {nombre}
                </td>
                <td className="pj-stats-zonas-td pj-stats-zonas-num">{zona.partidas ?? '—'}</td>
                <td className="pj-stats-zonas-td pj-stats-zonas-capital">
                  <div className="pj-stats-zonas-cap-bar-wrap">
                    <div className="pj-stats-zonas-cap-bar" style={{ width: `${capPct}%` }} />
                    <span className="pj-stats-zonas-cap-label">{formatMonto(zona.capital_total)}</span>
                  </div>
                </td>
                <td className="pj-stats-zonas-td pj-stats-zonas-num">{formatMonto(zona.intereses)}</td>
                <td className="pj-stats-zonas-td pj-stats-zonas-num" style={{ color: '#6366f1', fontWeight: 700 }}>{zona.en_juicio ?? '—'}</td>
                <td className="pj-stats-zonas-td pj-stats-zonas-num" style={{ color: '#10b981', fontWeight: 700 }}>{zona.finalizados ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────── Abogado Card ─────────────────── */
const AVATAR_COLORS = ['#015a6a', '#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#6366f1', '#ec4899', '#0891b2'];

function AbogadoCard({ abogado, index }) {
  const nombre = abogado.nombre || [abogado.firstName, abogado.lastName].filter(Boolean).join(' ') || '—';
  const enJuicio    = abogado.en_juicio ?? 0;
  const finalizados = abogado.finalizados ?? 0;
  const total       = abogado.total_asignados ?? (enJuicio + finalizados);
  const tiempoProm  = abogado.tiempo_promedio_dias ?? abogado.tiempo_promedio_resolucion ?? null;
  const capitalG    = abogado.capital_gestionado ?? null;
  const ratio       = total > 0 ? (finalizados / total) * 100 : 0;
  const initials    = nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color       = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <div className="pj-stats-abogado-card">
      <div className="pj-stats-abogado-avatar" style={{ background: color }}>{initials}</div>
      <div className="pj-stats-abogado-body">
        <div className="pj-stats-abogado-name">{nombre}</div>
        <div className="pj-stats-abogado-badges">
          <span className="pj-stats-badge pj-stats-badge--juicio">{enJuicio} en juicio</span>
          <span className="pj-stats-badge pj-stats-badge--fin">{finalizados} finalizados</span>
          <span className="pj-stats-badge pj-stats-badge--total">{total} total</span>
          {tiempoProm != null && (
            <span className="pj-stats-badge pj-stats-badge--time">{tiempoProm} días prom.</span>
          )}
        </div>
        {capitalG != null && (
          <div className="pj-stats-abogado-capital">{formatMonto(capitalG)} gestionado</div>
        )}
        <div className="pj-stats-abogado-progress-track">
          <div className="pj-stats-abogado-progress-fill" style={{ width: `${ratio}%`, background: color }} />
        </div>
        <div className="pj-stats-abogado-ratio">{ratio.toFixed(0)}% de resolución</div>
      </div>
    </div>
  );
}

/* ─────────────────── KPI Card ─────────────────── */
function KpiCard({ icon, label, value, subtext, color, delay, glow }) {
  return (
    <div className="pj-stats-kpi-card" style={{ '--kpi-color': color, '--delay': delay, '--glow': glow ? '1' : '0' }}>
      <div className="pj-stats-kpi-icon" style={{ color }}>{icon}</div>
      <div className="pj-stats-kpi-label">{label}</div>
      <div className="pj-stats-kpi-value" style={{ color }}>{value}</div>
      {subtext && <div className="pj-stats-kpi-sub">{subtext}</div>}
      <div className="pj-stats-kpi-glow" />
    </div>
  );
}

/* ─────────────────── KPI Icons ─────────────────── */
const IcoLegajos = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M4 4h12v12H4z" stroke="currentColor" strokeWidth="1.75" rx="2"/>
    <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcoCapital = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M10 6.5v7M8 8.5c0-.83.67-1.5 2-1.5s2 .5 2 1.5-1 1.5-2 1.5-2 .67-2 1.5S9 13 10 13s2-.5 2-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcoTasa = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 16L8 10l4 3 5-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="7" r="1.75" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.25"/>
  </svg>
);
const IcoClock = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M10 6.5V10l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoJuicio = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 2.5L12 8h5.5L13 11.5l1.9 5.5L10 13.5 5.1 17l1.9-5.5L2.5 8H8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const IcoNotif = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 2a6 6 0 016 6v3l1.5 2.5h-15L4 11V8a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.75"/>
    <path d="M8.5 15.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─────────────────── Main Page ─────────────────── */
export default function EstadisticasPage() {
  const { user, systems } = useAuth();
  const pjSystem = systems?.find(s => s.modules?.some(m => m.route?.startsWith('/recaudacion')));
  const pjRole = pjSystem?.role;
  const isSuperAdmin = user?.globalRole === 'SUPERADMIN';
  const canVerLegales = isSuperAdmin || ['SecretarioLegal', 'Sistemas'].includes(pjRole);

  /* Filters */
  const today = new Date();
  const defaultDesde = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const defaultHasta = today.toISOString().slice(0, 10);

  const [filters, setFilters]       = useState({ desde: defaultDesde, hasta: defaultHasta });
  const [draftFilters, setDraft]    = useState({ desde: defaultDesde, hasta: defaultHasta });
  const [activePreset, setPreset]   = useState('90d');

  /* Data */
  const [resumen, setResumen]       = useState(null);
  const [tendencia, setTendencia]   = useState(null);
  const [funnelData, setFunnel]     = useState(null);
  const [zonas, setZonas]           = useState(null);
  const [metricas, setMetricas]     = useState(null);

  /* UI */
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [animated, setAnimated]     = useState(false);
  const [abogadoSort, setAbogadoSort] = useState('total_asignados');

  const fetchAll = useCallback(async (f) => {
    setLoading(true);
    setError(null);
    setAnimated(false);
    try {
      const params = { desde: f.desde || undefined, hasta: f.hasta || undefined };
      const calls = [
        estadisticasApi.resumen(params),
        estadisticasApi.tendencia(params),
        estadisticasApi.funnel(params),
        estadisticasApi.porZona(params),
      ];
      if (canVerLegales) calls.push(estadisticasApi.metricasLegales(params));
      const results = await Promise.all(calls.map(p => p.catch(e => null)));
      setResumen(results[0]);
      setTendencia(results[1]);
      setFunnel(results[2]);
      setZonas(results[3]);
      if (canVerLegales && results[4]) setMetricas(results[4]);
    } catch (err) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
      setTimeout(() => setAnimated(true), 80);
    }
  }, [canVerLegales]);

  useEffect(() => { fetchAll(filters); }, [filters]);

  /* Preset handlers */
  const applyPreset = (preset) => {
    const now = new Date();
    let desde = '';
    let hasta = now.toISOString().slice(0, 10);
    if (preset === '30d') {
      desde = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
    } else if (preset === '90d') {
      desde = new Date(now - 90 * 86400000).toISOString().slice(0, 10);
    } else if (preset === 'year') {
      desde = `${now.getFullYear()}-01-01`;
    } else {
      desde = ''; hasta = '';
    }
    setPreset(preset);
    setDraft({ desde, hasta });
    setFilters({ desde, hasta });
  };

  const applyCustom = () => {
    setPreset('custom');
    setFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    setDraft({ desde: '', hasta: '' });
    setPreset('all');
    setFilters({ desde: '', hasta: '' });
  };

  const hasActiveFilter = filters.desde || filters.hasta;

  /* Derived values */
  const porEstado = resumen?.por_estado || {};
  const totalLegajos = resumen?.total_legajos || Object.values(porEstado).reduce((a, b) => a + (Number(b) || 0), 0) || 0;
  const maxCount = Math.max(...Object.values(porEstado).map(v => typeof v === 'object' ? (v.count || 0) : Number(v) || 0), 1);

  const tasaResolucion = resumen?.tasa_resolucion ?? (
    totalLegajos > 0
      ? ((Number(porEstado.finalizada || 0) / totalLegajos) * 100).toFixed(1)
      : '0.0'
  );
  const tasaNotif = resumen?.tasa_notificacion ?? null;
  const tiempoProm = resumen?.tiempo_promedio_resolucion ?? null;
  const enJuicioCount = resumen?.por_estado?.en_juicio ?? 0;

  const tasaColor = parseFloat(tasaResolucion) > 30 ? '#10b981' : parseFloat(tasaResolucion) > 10 ? '#f59e0b' : '#ef4444';

  const mesesData = tendencia?.meses || [];

  // Normalizar funnelData: backend devuelve { funnel: [...], tasa_judicializacion, tasa_finalizacion }
  // FunnelChart espera objeto keyed por estado
  const funnelNorm = funnelData
    ? {
        ...(Array.isArray(funnelData.funnel)
          ? funnelData.funnel.reduce((acc, item) => { acc[item.estado] = item.count; return acc; }, {})
          : funnelData),
        tasa_judicializacion: funnelData.tasa_judicializacion ?? funnelData.tasaJudicializacion,
        tasa_finalizacion: funnelData.tasa_finalizacion ?? funnelData.tasaFinalizacion,
      }
    : null;

  /* Capital breakdown */
  const capitalTotal     = resumen?.total_capital || 0;
  const capitalEnJuicio  = resumen?.capital_en_juicio || 0;
  const capitalFinalizado = resumen?.capital_finalizado || 0;
  const capitalPendiente = Math.max(capitalTotal - capitalEnJuicio - capitalFinalizado, 0);
  const capMax = capitalTotal || 1;

  /* Notificaciones */
  const notifExitosas   = resumen?.notificaciones_exitosas ?? null;
  const notifRechazadas = resumen?.notificaciones_rechazadas ?? null;
  const notifTotal      = (notifExitosas ?? 0) + (notifRechazadas ?? 0);
  const notifTasa       = notifTotal > 0 ? ((notifExitosas / notifTotal) * 100).toFixed(1) : null;

  /* Abogados sorted */
  const abogados = metricas?.abogados || [];
  const abogadosSorted = [...abogados].sort((a, b) => (b[abogadoSort] ?? 0) - (a[abogadoSort] ?? 0));

  /* Donut segments for estado */
  const donutSegments = Object.entries(porEstado)
    .map(([k, v]) => ({
      label: ESTADO_LABELS[k] || k,
      value: typeof v === 'object' ? (v.count || 0) : Number(v) || 0,
      color: ESTADO_COLORS[k] || '#94a3b8',
    }))
    .filter(s => s.value > 0);

  /* ──────── Loading skeleton ──────── */
  if (loading) return (
    <AppLayout>
      <div className="pj-stats-page">
        <HeroSection />
        <div className="pj-stats-inner">
          <div className="pj-stats-kpi-grid" style={{ opacity: 1 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="pj-stats-kpi-card" style={{ opacity: 1, transform: 'none', animation: 'none' }}>
                <Skeleton h={36} w={36} radius={8} mb={10} />
                <Skeleton h={11} w="60%" mb={8} />
                <Skeleton h={28} w="80%" mb={4} />
                <Skeleton h={10} w="50%" />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      </div>
    </AppLayout>
  );

  /* ──────── Error ──────── */
  if (error) return (
    <AppLayout>
      <div className="pj-stats-page">
        <HeroSection />
        <div className="pj-stats-inner">
          <ErrorCard message={error} onRetry={() => fetchAll(filters)} />
        </div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="pj-stats-page">

        {/* ═══ HERO ═══ */}
        <HeroSection />

        {/* ═══ STICKY FILTER BAR ═══ */}
        <div className="pj-stats-filter-bar">
          <div className="pj-stats-filter-inner">
            <div className="pj-stats-filter-dates">
              <label className="pj-stats-filter-label">Desde</label>
              <input type="date" className="pj-stats-date-input"
                value={draftFilters.desde}
                onChange={e => { setDraft(d => ({ ...d, desde: e.target.value })); setPreset('custom'); }}
              />
              <label className="pj-stats-filter-label">Hasta</label>
              <input type="date" className="pj-stats-date-input"
                value={draftFilters.hasta}
                onChange={e => { setDraft(d => ({ ...d, hasta: e.target.value })); setPreset('custom'); }}
              />
            </div>
            <div className="pj-stats-filter-presets">
              {[
                { key: '30d',  label: 'Últimos 30 días' },
                { key: '90d',  label: 'Últimos 90 días' },
                { key: 'year', label: 'Este año' },
                { key: 'all',  label: 'Todo' },
              ].map(p => (
                <button key={p.key}
                  className={`pj-stats-preset-btn${activePreset === p.key ? ' pj-stats-preset-btn--active' : ''}`}
                  onClick={() => applyPreset(p.key)}
                >{p.label}</button>
              ))}
            </div>
            <div className="pj-stats-filter-actions">
              <button className="pj-stats-apply-btn" onClick={applyCustom}>Aplicar</button>
              {hasActiveFilter && (
                <button className="pj-stats-clear-btn" onClick={clearFilters}>Limpiar filtros</button>
              )}
            </div>
            {hasActiveFilter && (
              <div className="pj-stats-filter-pill">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.25"/>
                  <path d="M6 4v2.5L7.5 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                </svg>
                Filtrado: {filters.desde ? fmt2(filters.desde) : '—'} – {filters.hasta ? fmt2(filters.hasta) : '—'}
              </div>
            )}
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        <div className="pj-stats-inner">

          {/* ══ KPI STRIP ══ */}
          <div className={`pj-stats-kpi-grid${animated ? ' pj-stats-animated' : ''}`}>
            <KpiCard icon={<IcoLegajos />} label="Total Legajos"
              value={totalLegajos} subtext="en el período"
              color="#0f172a" delay="0ms" />
            <KpiCard icon={<IcoCapital />} label="Capital en Cartera"
              value={formatMonto(capitalTotal)} subtext="deuda total registrada"
              color="#015a6a" delay="60ms" />
            <KpiCard icon={<IcoTasa />} label="Tasa de Resolución"
              value={`${tasaResolucion}%`} subtext="legajos finalizados"
              color={tasaColor} delay="120ms" />
            <KpiCard icon={<IcoClock />} label="Tiempo Promedio"
              value={tiempoProm != null ? `${tiempoProm}d` : '—'} subtext="días hasta resolución"
              color="#8b5cf6" delay="180ms" />
            <KpiCard icon={<IcoJuicio />} label="En Juicio"
              value={enJuicioCount} subtext="legajos activos en proceso"
              color="#f97316" delay="240ms" glow />
            <KpiCard icon={<IcoNotif />} label="Tasa de Notificación"
              value={tasaNotif != null ? `${tasaNotif}%` : '—'} subtext="notificaciones exitosas"
              color="#3b82f6" delay="300ms" />
          </div>

          {/* ══ TENDENCIA + FUNNEL ══ */}
          {(mesesData.length > 0 || funnelNorm) && (
          <div className={`pj-stats-two-col${animated ? ' pj-stats-animated' : ''}`} style={{ '--delay': '340ms' }}>

            {/* Tendencia */}
            <div className="pj-stats-section pj-stats-section--tendencia">
              <div className="pj-stats-section-header">
                <span className="pj-stats-section-title">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                    <path d="M2 13L6 8l3.5 2.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Evolución mensual
                </span>
                <div className="pj-stats-chart-legend">
                  <span className="pj-stats-legend-item">
                    <span className="pj-stats-legend-box" style={{ background: '#015a6a' }} /> Legajos creados
                  </span>
                  <span className="pj-stats-legend-item">
                    <span className="pj-stats-legend-box" style={{ background: '#10b981' }} /> Finalizados
                  </span>
                  <span className="pj-stats-legend-item">
                    <span className="pj-stats-legend-line" style={{ background: '#f59e0b' }} /> Capital
                  </span>
                </div>
              </div>
              <div className="pj-stats-section-body pj-stats-tendencia-body">
                {mesesData.length === 0
                  ? <EmptyState />
                  : <TendenciaChart meses={mesesData} animated={animated} />
                }
              </div>
            </div>

            {/* Funnel */}
            <div className="pj-stats-section pj-stats-section--funnel">
              <div className="pj-stats-section-header">
                <span className="pj-stats-section-title">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                    <path d="M2 3h12l-4 5v5l-4-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                  Embudo de conversión
                </span>
              </div>
              <div className="pj-stats-section-body">
                <FunnelChart funnel={funnelNorm} />
              </div>
            </div>
          </div>
          )}

          {/* ══ DISTRIBUCIÓN POR ESTADO ══ */}
          <div className={`pj-stats-section${animated ? ' pj-stats-animated' : ''}`} style={{ '--delay': '380ms' }}>
            <div className="pj-stats-section-header">
              <span className="pj-stats-section-title">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                  <rect x="2" y="10" width="3" height="4" rx="1" fill="currentColor" opacity="0.5"/>
                  <rect x="6.5" y="6" width="3" height="8" rx="1" fill="currentColor" opacity="0.7"/>
                  <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor"/>
                </svg>
                Distribución por Estado
              </span>
              <span className="pj-stats-total-badge">{totalLegajos} legajos</span>
            </div>
            {Object.keys(porEstado).length === 0 ? (
              <EmptyState />
            ) : (
              <div className="pj-stats-estado-cols">
                {/* Bar chart */}
                <div className="pj-stats-section-body pj-stats-bars-col">
                  {Object.entries(porEstado).map(([estado, info]) => {
                    const count = typeof info === 'object' ? (info.count || info.cantidad || 0) : Number(info) || 0;
                    const monto = typeof info === 'object' ? (info.monto_total || info.capital || null) : null;
                    const pct = totalLegajos > 0 ? Math.round((count / totalLegajos) * 100) : 0;
                    const color = ESTADO_COLORS[estado] || '#94a3b8';
                    return (
                      <BarRow key={estado}
                        label={ESTADO_LABELS[estado] || estado.replace(/_/g, ' ')}
                        count={count} maxCount={maxCount}
                        color={color} monto={monto} pct={pct} animated={animated} />
                    );
                  })}
                </div>
                {/* Donut */}
                <div className="pj-stats-donut-col">
                  <DonutChart segments={donutSegments} size={180} centerSub="legajos" />
                  <div className="pj-stats-donut-legend">
                    {donutSegments.map((seg, i) => {
                      const pct = totalLegajos > 0 ? Math.round((seg.value / totalLegajos) * 100) : 0;
                      return (
                        <div key={i} className="pj-stats-donut-legend-row">
                          <span className="pj-stats-donut-swatch" style={{ background: seg.color }} />
                          <span className="pj-stats-donut-tipo">{seg.label}</span>
                          <span className="pj-stats-donut-count" style={{ color: seg.color }}>{seg.value}</span>
                          <span className="pj-stats-donut-pct">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ══ MAPA POR ZONA ══ */}
          {(zonas && (Array.isArray(zonas) ? zonas.length > 0 : (zonas.zonas || []).length > 0)) && (
            <div className={`pj-stats-section${animated ? ' pj-stats-animated' : ''}`} style={{ '--delay': '420ms' }}>
              <div className="pj-stats-section-header">
                <span className="pj-stats-section-title">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                    <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 2v1M8 11v1M8 13c0 0 5 3 5-3a5 5 0 00-10 0c0 6 5 3 5 3z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                  </svg>
                  Análisis por Zona Geográfica
                </span>
                <span className="pj-stats-total-badge">
                  {(Array.isArray(zonas) ? zonas : zonas.zonas || []).length} zonas
                </span>
              </div>
              <ZonasTable zonas={Array.isArray(zonas) ? zonas : (zonas.zonas || [])} />
            </div>
          )}

          {/* ══ MÉTRICAS POR ABOGADO ══ */}
          {canVerLegales && (
            <div className={`pj-stats-section${animated ? ' pj-stats-animated' : ''}`} style={{ '--delay': '460ms' }}>
              <div className="pj-stats-section-header">
                <span className="pj-stats-section-title">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                    <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M1 14c0-2.76 2.24-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 14c0-2.21 1.79-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Métricas por Abogado
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {ABOGADO_SORT_OPTIONS.map(opt => (
                    <button key={opt.key}
                      className={`pj-stats-tab-btn${abogadoSort === opt.key ? ' pj-stats-tab-btn--active' : ''}`}
                      onClick={() => setAbogadoSort(opt.key)}>
                      {opt.label}
                    </button>
                  ))}
                  {abogados.length > 0 && (
                    <span className="pj-stats-total-badge" style={{ marginLeft: '0.5rem' }}>{abogados.length} abogados</span>
                  )}
                </div>
              </div>
              {abogadosSorted.length === 0 ? (
                <div style={{ padding: '2.5rem' }}>
                  <EmptyState label="Sin abogados asignados en este período" />
                </div>
              ) : (
                <div className="pj-stats-abogados-grid">
                  {abogadosSorted.map((a, i) => (
                    <AbogadoCard key={a.id || a.nombre || i} abogado={a} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ ACTIVIDAD DEL PERÍODO ══ */}
          <div className={`pj-stats-section${animated ? ' pj-stats-animated' : ''}`} style={{ '--delay': '500ms' }}>
            <div className="pj-stats-section-header">
              <span className="pj-stats-section-title">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}>
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 8h6M5 5h3M5 11h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                </svg>
                Actividad del período
              </span>
            </div>
            <div className="pj-stats-actividad-body">

              {/* Notificaciones split bar */}
              {notifTotal > 0 && (
                <div className="pj-stats-actividad-block">
                  <div className="pj-stats-actividad-block-title">Notificaciones</div>
                  <div className="pj-stats-notif-split-wrap">
                    <div className="pj-stats-notif-split-bar">
                      <div className="pj-stats-notif-split-green"
                        style={{ width: `${(notifExitosas / notifTotal) * 100}%` }} />
                      <div className="pj-stats-notif-split-red"
                        style={{ width: `${(notifRechazadas / notifTotal) * 100}%` }} />
                    </div>
                    <div className="pj-stats-notif-split-labels">
                      <span className="pj-stats-notif-label pj-stats-notif-label--ok">
                        <span className="pj-stats-notif-dot" style={{ background: '#10b981' }} />
                        {notifExitosas} exitosas
                      </span>
                      <span className="pj-stats-notif-label pj-stats-notif-label--fail">
                        <span className="pj-stats-notif-dot" style={{ background: '#ef4444' }} />
                        {notifRechazadas} rechazadas
                      </span>
                      <span className="pj-stats-notif-tasa">{notifTasa}% tasa de éxito</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Capital breakdown */}
              <div className="pj-stats-actividad-block">
                <div className="pj-stats-actividad-block-title">Capital — desglose</div>
                <div className="pj-stats-capital-breakdown">
                  <CapitalSegBar
                    segments={[
                      { label: 'En juicio', value: capitalEnJuicio, color: '#6366f1' },
                      { label: 'Recuperado', value: capitalFinalizado, color: '#10b981' },
                      { label: 'Pendiente', value: capitalPendiente, color: '#e2e8f0' },
                    ]}
                    total={capMax}
                    animated={animated}
                  />
                  <div className="pj-stats-cap-break-legend">
                    <CapLegItem label="En juicio"  value={capitalEnJuicio}   color="#6366f1" />
                    <CapLegItem label="Recuperado" value={capitalFinalizado}  color="#10b981" />
                    <CapLegItem label="Pendiente"  value={capitalPendiente}   color="#94a3b8" />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}

/* ─────────────────── Hero ─────────────────── */
function HeroSection() {
  return (
    <div className="pj-stats-hero">
      <div className="pj-stats-hero-grid" />
      <div className="pj-stats-hero-orb pj-stats-hero-orb--1" />
      <div className="pj-stats-hero-orb pj-stats-hero-orb--2" />
      <div className="pj-stats-hero-content">
        <div className="pj-stats-hero-eyebrow">
          <span className="pj-stats-hero-dot" />
          Módulo de Apremio Municipal
        </div>
        <h1 className="pj-stats-hero-title">Estadísticas del Módulo de Apremio</h1>
        <p className="pj-stats-hero-sub">Análisis completo del proceso de recupero de deuda municipal</p>
      </div>
    </div>
  );
}

/* ─────────────────── Capital Bar ─────────────────── */
function CapitalSegBar({ segments, total, animated }) {
  return (
    <div className="pj-stats-cap-bar-track">
      {segments.map((seg, i) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0;
        return (
          <div key={i} className="pj-stats-cap-bar-seg"
            style={{
              width: animated ? `${pct}%` : '0%',
              background: seg.color,
              transition: `width 0.8s cubic-bezier(.4,0,.2,1) ${0.1 + i * 0.12}s`,
            }}
            title={`${seg.label}: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(seg.value)}`}
          />
        );
      })}
    </div>
  );
}

function CapLegItem({ label, value, color }) {
  return (
    <div className="pj-stats-cap-leg-item">
      <span className="pj-stats-cap-leg-dot" style={{ background: color }} />
      <span className="pj-stats-cap-leg-label">{label}</span>
      <span className="pj-stats-cap-leg-value">{formatMonto(value)}</span>
    </div>
  );
}

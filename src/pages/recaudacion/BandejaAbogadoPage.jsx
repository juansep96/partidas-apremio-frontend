import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import EstadoBadge from '../../components/recaudacion/EstadoBadge';
import { useAuth } from '../../context/AuthContext';
import { legajoApi } from '../../api/recaudacionApi';
import './BandejaAbogadoPage.css';

const GRUPOS = [
  {
    estado: 'asignada_legales',
    label: 'Asignados',
    sub: 'Pendientes de iniciar juicio',
    colorClass: 'pj-abg-group--purple',
  },
  {
    estado: 'en_juicio',
    label: 'En Juicio',
    sub: 'Expedientes en curso',
    colorClass: 'pj-abg-group--amber',
  },
  {
    estado: 'finalizada',
    label: 'Finalizados',
    sub: 'Procesos completados',
    colorClass: 'pj-abg-group--green',
  },
];

function formatFecha(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCapital(monto) {
  if (monto == null) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(monto);
}

export default function BandejaAbogadoPage() {
  const { user } = useAuth();
  const [legajos, setLegajos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await legajoApi.list({ abogado_id: 'me', per_page: 100 });
        setLegajos(res.data || res || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nombre = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Abogado';
  const initials = nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const asignados  = legajos.filter(l => l.estado === 'asignada_legales').length;
  const enJuicio   = legajos.filter(l => l.estado === 'en_juicio').length;
  const finalizados = legajos.filter(l => l.estado === 'finalizada').length;

  return (
    <AppLayout>
      <div className="pj-abg-page">

        {/* ── Hero ── */}
        <div className="pj-abg-hero">
          <div className="pj-abg-hero-inner">
            <div className="pj-abg-hero-avatar">{initials}</div>
            <div>
              <div className="pj-abg-hero-role">Abogado</div>
              <h1 className="pj-abg-hero-title">Bandeja de {nombre}</h1>
              <p className="pj-abg-hero-sub">Legajos asignados y en proceso judicial</p>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="pj-abg-kpi-row">
          <div className="pj-abg-kpi-card">
            <div className="pj-abg-kpi-label">Asignados</div>
            <div className="pj-abg-kpi-value pj-abg-kpi-value--purple">{asignados}</div>
            <div className="pj-abg-kpi-sub">pendientes de iniciar</div>
          </div>
          <div className="pj-abg-kpi-card pj-abg-kpi-card--glow-amber">
            <div className="pj-abg-kpi-label">En Juicio</div>
            <div className="pj-abg-kpi-value pj-abg-kpi-value--amber">{enJuicio}</div>
            <div className="pj-abg-kpi-sub">expedientes activos</div>
          </div>
          <div className="pj-abg-kpi-card pj-abg-kpi-card--glow-green">
            <div className="pj-abg-kpi-label">Finalizados</div>
            <div className="pj-abg-kpi-value pj-abg-kpi-value--green">{finalizados}</div>
            <div className="pj-abg-kpi-sub">procesos completados</div>
          </div>
        </div>

        {/* ── States ── */}
        {loading && (
          <div className="pj-abg-state-msg">
            <div className="pj-abg-spinner" />
            Cargando bandeja…
          </div>
        )}
        {error && (
          <div className="pj-abg-state-msg pj-abg-state-msg--error">
            Error: {error}
          </div>
        )}

        {!loading && !error && legajos.length === 0 && (
          <div className="pj-abg-global-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
            <p>No tenés legajos asignados actualmente.</p>
          </div>
        )}

        {/* ── Group sections ── */}
        {!loading && !error && GRUPOS.map(grupo => {
          const items = legajos.filter(l => l.estado === grupo.estado);
          return (
            <div key={grupo.estado} className={`pj-abg-group ${grupo.colorClass}`}>
              <div className="pj-abg-group-header">
                <div className="pj-abg-group-header-text">
                  <span className="pj-abg-group-label">{grupo.label}</span>
                  <span className="pj-abg-group-sub">{grupo.sub}</span>
                </div>
                <span className="pj-abg-group-count">{items.length}</span>
              </div>

              {items.length === 0 ? (
                <div className="pj-abg-section-empty">
                  Sin legajos en este estado
                </div>
              ) : (
                <div className="pj-abg-cards">
                  {items.map(l => (
                    <div key={l.id} className="pj-abg-card">
                      <div className="pj-abg-card-left">
                        <div className="pj-abg-card-partida">
                          <span className="pj-abg-card-partida-label">Partida</span>
                          <strong className="pj-abg-card-partida-num">
                            {l.partida?.nro_partida || '—'}
                          </strong>
                        </div>
                        <div className="pj-abg-card-titular">
                          {l.partida?.titular || l.titular || '—'}
                        </div>
                      </div>

                      <div className="pj-abg-card-mid">
                        <div className="pj-abg-card-field">
                          <span className="pj-abg-card-field-label">Capital</span>
                          <span className="pj-abg-card-capital">
                            {formatCapital(l.monto_capital)}
                          </span>
                        </div>
                        <div className="pj-abg-card-field">
                          <span className="pj-abg-card-field-label">Expediente</span>
                          <span className="pj-abg-card-val">{l.nro_expediente || '—'}</span>
                        </div>
                        <div className="pj-abg-card-field">
                          <span className="pj-abg-card-field-label">Inicio juicio</span>
                          <span className="pj-abg-card-val">{formatFecha(l.fecha_inicio_juicio)}</span>
                        </div>
                      </div>

                      <div className="pj-abg-card-right">
                        <EstadoBadge estado={l.estado} />
                        <Link
                          to={`/recaudacion/legajos/${l.id}`}
                          className="pj-abg-ver-link"
                        >
                          Ver →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}

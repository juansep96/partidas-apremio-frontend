import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { dsApi } from '../api/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Area,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './EstadisticasDesarrolloSocialPage.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MONTE_HERMOSO_CENTER = [-38.9844, -61.2947];

const CHART_COLORS = [
  '#015a6a', '#027381', '#0891b2', '#0e7490', '#0d9488',
  '#047857', '#059669', '#2dd4bf', '#14b8a6', '#0f766e',
  '#134e4a', '#0d9488', '#2e1065',
];

/* Config de gráficos por campo - basado en campos dinámicos reales en BD */
const CAMPOS_POR_ENTIDAD = {
  titular: [
    { slug: 'estado-civil', nombre: 'Estado civil' },
    { slug: 'barrio', nombre: 'Barrio' },
    { slug: 'ocupacion', nombre: 'Ocupación' },
    { slug: 'planes-sociales', nombre: 'Planes sociales' },
    { slug: 'discapacidad', nombre: 'Discapacidad' },
    { slug: 'cud', nombre: 'CUD' },
    { slug: 'nacionalidad', nombre: 'Nacionalidad' },
    { slug: 'nivel-estudios', nombre: 'Nivel de estudios' },
    { slug: 'ciudad-de-origen', nombre: 'Lugar de nacimiento' },
  ],
  grupo: [
    { slug: 'vinculo', nombre: 'Vínculo familiar' },
    { slug: 'ocupacion-1', nombre: 'Ocupación' },
    { slug: 'planes-sociales-1', nombre: 'Planes sociales' },
    { slug: 'discapacidad-1', nombre: 'Discapacidad' },
    { slug: 'cud-1', nombre: 'CUD' },
  ],
  encuesta_social: [
    { slug: 'tenencia', nombre: 'Tenencia' },
    { slug: 'tipo-de-vivienda', nombre: 'Tipo de vivienda' },
    { slug: 'material-del-piso', nombre: 'Material del piso' },
    { slug: 'material-de-paredes', nombre: 'Material de paredes' },
    { slug: 'material-de-cubierta-ext-techo', nombre: 'Cubierta techo' },
    { slug: 'electricidad', nombre: 'Electricidad' },
    { slug: 'agua', nombre: 'Agua' },
    { slug: 'desague', nombre: 'Desagüe' },
    { slug: 'gas', nombre: 'Gas' },
  ],
  asistencia: [
    { slug: 'tipo', nombre: 'Tipo de asistencia' },
    { slug: 'estado', nombre: 'Estado' },
  ],
};

const ENTITY_LABELS = {
  titular: 'Titulares',
  grupo: 'Grupo familiar',
  encuesta_social: 'Encuestas',
  asistencia: 'Asistencias',
};

const CRUCES_CONFIG = [
  { entity: 'encuesta_social', x: 'tenencia', y: 'tipo-de-vivienda', titulo: 'Tenencia × Tipo vivienda' },
  { entity: 'encuesta_social', x: 'tenencia', y: 'material-del-piso', titulo: 'Tenencia × Material piso' },
  { entity: 'encuesta_social', x: 'tipo-de-vivienda', y: 'electricidad', titulo: 'Tipo vivienda × Electricidad' },
  { entity: 'titular', x: 'barrio', y: 'ocupacion', titulo: 'Barrio × Ocupación' },
  { entity: 'titular', x: 'barrio', y: 'planes-sociales', titulo: 'Barrio × Planes sociales' },
  { entity: 'asistencia', x: 'tipo', y: 'estado', titulo: 'Tipo × Estado asistencia' },
];

function formatNumber(n) {
  return Number(n).toLocaleString('es-AR');
}

function ultimos3MesesRango() {
  const h = new Date();
  const d = new Date(h.getFullYear(), h.getMonth() - 2, 1);
  const ultimo = new Date(h.getFullYear(), h.getMonth() + 1, 0);
  return {
    fechaDesde: d.toISOString().slice(0, 10),
    fechaHasta: ultimo.toISOString().slice(0, 10),
  };
}

function mesActualRango() {
  const h = new Date();
  const d = new Date(h.getFullYear(), h.getMonth(), 1);
  const ultimo = new Date(h.getFullYear(), h.getMonth() + 1, 0);
  return {
    fechaDesde: d.toISOString().slice(0, 10),
    fechaHasta: ultimo.toISOString().slice(0, 10),
  };
}

function ultimoAnioRango() {
  const h = new Date();
  const d = new Date(h.getFullYear(), h.getMonth() - 11, 1);
  return {
    fechaDesde: d.toISOString().slice(0, 10),
    fechaHasta: h.toISOString().slice(0, 10),
  };
}

function buildParams(filtros) {
  const p = {};
  if (filtros.fechaDesde) p.fecha_desde = filtros.fechaDesde;
  if (filtros.fechaHasta) p.fecha_hasta = filtros.fechaHasta;
  if (Object.keys(filtros.campos || {}).length > 0) {
    p.filtros = JSON.stringify(filtros.campos);
  }
  return p;
}

function FiltrosPanel({ filtros, setFiltros, campos, opcionesTabla, onFiltrar }) {
  const [abierto, setAbierto] = useState(false);
  const { fechaDesde, fechaHasta, campos: camposFiltro } = filtros;

  const actualizarCampo = (slug, valor) => {
    const next = { ...(camposFiltro || {}) };
    if (valor === '' || valor == null) {
      delete next[slug];
    } else {
      next[slug] = valor;
    }
    setFiltros((f) => ({ ...f, campos: next }));
  };

  const camposTitular = campos.filter((c) => c.appliesTo === 'titular' && ['select', 'select_tabla', 'boolean'].includes(c.tipo));
  const camposEncuesta = campos.filter((c) => c.appliesTo === 'encuesta_social' && ['select', 'select_tabla', 'boolean'].includes(c.tipo));
  const camposAsistencia = campos.filter((c) => c.appliesTo === 'asistencia' && ['select', 'select_tabla', 'boolean'].includes(c.tipo));
  const camposGrupo = campos.filter((c) => c.appliesTo === 'grupo' && ['select', 'select_tabla', 'boolean'].includes(c.tipo));

  const opcionesPara = (c) => {
    if (c.tipo === 'boolean') return [{ valor: '1', label: 'Sí' }, { valor: '0', label: 'No' }];
    const tabla = c.tablaConfig?.tabla;
    if (c.tipo === 'select_tabla' && tabla) {
      const items = opcionesTabla[tabla];
      if (!items?.length) return [];
      const labelCol = tabla === 'ciudades' ? 'ciudad' : (c.tablaConfig?.labelColumna || 'nombre');
      const valorCol = c.tablaConfig?.valorColumna || 'id';
      return items.map((item) => ({
        valor: item[valorCol] ?? item.id,
        label: item[labelCol] ?? item.nombre ?? item.ciudad ?? String(item.id),
      }));
    }
    return (c.opciones || []).map((o) => (typeof o === 'string' ? { valor: o, label: o } : { valor: o.value || o.valor, label: o.label || o.nombre || o.value }));
  };

  const renderFiltros = (list, labelSufijo = '') => (
    list.map((c) => (
      <div key={c.id} className="estadisticas-filtro-group">
        <label>{c.nombre}{labelSufijo}</label>
        <select value={camposFiltro?.[c.slug] || ''} onChange={(e) => actualizarCampo(c.slug, e.target.value)}>
          <option value="">Todos</option>
          {opcionesPara(c).map((o) => (
            <option key={o.valor} value={o.valor}>{o.label}</option>
          ))}
        </select>
      </div>
    ))
  );

  return (
    <div className="estadisticas-filtros-panel">
      <button type="button" className="estadisticas-filtros-toggle" onClick={() => setAbierto(!abierto)}>
        <span className="estadisticas-filtros-toggle-icon">{abierto ? '▼' : '▶'}</span>
        Filtros
      </button>
      {abierto && (
        <div className="estadisticas-filtros-grid">
          <div className="estadisticas-filtro-group">
            <label>Fecha desde</label>
            <input type="date" value={fechaDesde || ''} onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value || null }))} />
          </div>
          <div className="estadisticas-filtro-group">
            <label>Fecha hasta</label>
            <input type="date" value={fechaHasta || ''} onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value || null }))} />
          </div>
          {renderFiltros(camposTitular, ' (titular)')}
          {renderFiltros(camposGrupo, ' (grupo)')}
          {renderFiltros(camposEncuesta, ' (encuesta)')}
          {renderFiltros(camposAsistencia)}
          <div className="estadisticas-filtro-acciones">
            <button type="button" className="estadisticas-btn primario" onClick={onFiltrar}>Filtrar</button>
            <button type="button" className="estadisticas-btn secundario" onClick={() => setFiltros({ fechaDesde: null, fechaHasta: null, campos: {} })}>Limpiar</button>
            <button type="button" className="estadisticas-btn secundario" onClick={() => setFiltros((f) => ({ ...f, ...ultimos3MesesRango() }))}>Últimos 3 meses</button>
            <button type="button" className="estadisticas-btn secundario" onClick={() => setFiltros((f) => ({ ...f, ...mesActualRango() }))}>Mes actual</button>
            <button type="button" className="estadisticas-btn secundario" onClick={() => setFiltros((f) => ({ ...f, ...ultimoAnioRango() }))}>Último año</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumenCards({ data, loading }) {
  if (loading) {
    return <div className="estadisticas-kpi-grid">{[1,2,3,4,5,6].map((i) => <div key={i} className="estadisticas-kpi-card estadisticas-skeleton" />)}</div>;
  }
  if (!data) return null;
  const cards = [
    { label: 'Titulares', value: data.titulares, icon: '👤' },
    { label: 'Integrantes', value: data.integrantes, icon: '👨‍👩‍👧‍👦' },
    { label: 'Encuestas', value: data.encuestas, icon: '📋' },
    { label: 'Asistencias', value: data.asistencias, icon: '🤝' },
    { label: 'Con ubicación', value: data.encuestasConCoords, icon: '📍' },
    { label: 'Total personas', value: data.personasTotales, icon: '🧑‍🤝‍🧑' },
  ];
  return (
    <div className="estadisticas-kpi-grid">
      {cards.map((card) => (
        <div key={card.label} className="estadisticas-kpi-card">
          <span className="estadisticas-kpi-icon">{card.icon}</span>
          <div className="estadisticas-kpi-content">
            <span className="estadisticas-kpi-value">{formatNumber(card.value)}</span>
            <span className="estadisticas-kpi-label">{card.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function GraficoTemporal({ data, loading, sinTitulo }) {
  if (loading) return <div className="estadisticas-chart-card estadisticas-skeleton" style={{ minHeight: 320 }} />;
  if (!data?.data?.length) return <div className="estadisticas-chart-card estadisticas-empty-chart">Sin datos en el rango.</div>;
  return (
    <div className="estadisticas-chart-card">
      {!sinTitulo && <h3>Evolución mensual</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="mesLabel" stroke="#64748b" tick={{ fontSize: 11 }} />
          <YAxis stroke="#64748b" />
          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }} />
          <Legend />
          <Area type="monotone" dataKey="encuestas" fill="#015a6a33" stroke="#015a6a" name="Encuestas" />
          <Line type="monotone" dataKey="asistencias" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} name="Asistencias" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoTemporalPorTipo({ data, loading }) {
  if (loading) return <div className="estadisticas-chart-card estadisticas-skeleton" style={{ minHeight: 320 }} />;
  if (!data?.data?.length) return <div className="estadisticas-chart-card estadisticas-empty-chart">Sin datos.</div>;
  const { tipos } = data;
  return (
    <div className="estadisticas-chart-card">
      <h3>Asistencias por tipo (evolución mensual)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="mesLabel" stroke="#64748b" tick={{ fontSize: 10 }} />
          <YAxis stroke="#64748b" />
          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }} />
          <Legend />
          {(tipos || []).slice(0, 8).map((tipo, i) => (
            <Line key={tipo} type="monotone" dataKey={tipo} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} name={tipo} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoAgregado({ titulo, data, loading, limit = 12, labelKey = 'label' }) {
  if (loading) return <div className="estadisticas-chart-card estadisticas-skeleton" style={{ minHeight: 280 }} />;
  if (!data?.data?.length) return <div className="estadisticas-chart-card estadisticas-empty-chart">Sin datos</div>;
  const chartData = data.data.map((r) => ({ ...r, label: r[labelKey] ?? r.label ?? '(sin dato)' }));
  return (
    <div className="estadisticas-chart-card">
      <h3>{titulo}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData.slice(0, limit)} layout="vertical" margin={{ left: 100, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" stroke="#64748b" />
          <YAxis dataKey="label" type="category" width={95} stroke="#64748b" tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => [v, '']} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#015a6a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoCircular({ titulo, data, loading }) {
  if (loading) return <div className="estadisticas-chart-card estadisticas-skeleton" style={{ minHeight: 280 }} />;
  if (!data?.data?.length) return <div className="estadisticas-chart-card estadisticas-empty-chart">Sin datos</div>;
  const chartData = data.data.slice(0, 10);
  const formatLabel = (label) => {
    if (label === '1' || label === 1) return 'Sí';
    if (label === '0' || label === 0) return 'No';
    return String(label ?? '(sin dato)');
  };
  return (
    <div className="estadisticas-chart-card estadisticas-chart-circular">
      <h3>{titulo}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} dataKey="total" nameKey="label" cx="50%" cy="50%" outerRadius={70} label={false}>
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value, name, item) => [`${formatLabel(item?.payload?.label)} (${item?.payload?.porcentaje ?? 0}%)`, '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="estadisticas-leyenda-grid">
        {chartData.map((d, i) => (
          <div key={i} className="estadisticas-leyenda-item">
            <span className="estadisticas-leyenda-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="estadisticas-leyenda-text">{formatLabel(d.label)}{d.porcentaje != null ? ` (${d.porcentaje}%)` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GraficoCruce({ titulo, data, loading, limit = 15, onRemove, height = 280 }) {
  if (loading) return <div className="estadisticas-chart-card estadisticas-skeleton" style={{ minHeight: height }} />;
  if (!data?.rows?.length && !data?.matrix) return <div className="estadisticas-chart-card estadisticas-empty-chart">Sin datos</div>;

  const isNway = data.rows?.[0]?.labels != null;
  const hasMatrix = data.matrix && Object.keys(data.matrix).length > 0;
  const labelsX = data.labelsX || (hasMatrix ? Object.keys(data.matrix) : []);
  const labelsY = data.labelsY || (hasMatrix && labelsX[0] ? Object.keys(data.matrix[labelsX[0]] || {}) : []);

  let chartData = [];
  if (hasMatrix) {
    chartData = labelsX.slice(0, limit).map((lx) => {
      const row = { name: lx };
      labelsY.forEach((ly) => { row[ly] = data.matrix[lx]?.[ly] ?? 0; });
      return row;
    });
  } else {
    const byX = {};
    (data.rows || []).forEach((r) => {
      const lx = isNway ? (r.labels?.[0] ?? '(sin dato)') : (r.labelX ?? '(sin dato)');
      const ly = isNway ? (r.labels?.[1] ?? '(sin dato)') : (r.labelY ?? '(sin dato)');
      if (!byX[lx]) byX[lx] = {};
      byX[lx][ly] = (byX[lx][ly] || 0) + (r.total || 0);
    });
    const allY = [...new Set(Object.values(byX).flatMap((o) => Object.keys(o)))];
    chartData = Object.entries(byX).slice(0, limit).map(([name, vals]) => {
      const row = { name };
      allY.forEach((ly) => { row[ly] = vals[ly] ?? 0; });
      return row;
    });
  }

  const seriesKeys = chartData[0] ? Object.keys(chartData[0]).filter((k) => k !== 'name') : [];
  const maxBars = 8;

  return (
    <div className="estadisticas-chart-card">
      <div className="estadisticas-chart-card-header">
        <h3>{titulo}</h3>
        {onRemove && (
          <button type="button" className="estadisticas-btn-icon" onClick={onRemove} title="Eliminar cruce">✕</button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 30, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" stroke="#64748b" />
          <YAxis dataKey="name" type="category" width={75} stroke="#64748b" tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ fill: 'rgba(1,90,106,0.08)' }} />
          <Legend />
          {seriesKeys.slice(0, maxBars).map((key, i) => (
            <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} name={key} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MapaEncuestados({ puntos, loading }) {
  if (loading) return <div className="estadisticas-chart-card estadisticas-skeleton" style={{ minHeight: 400 }} />;
  if (!puntos?.length) {
    return (
      <div className="estadisticas-chart-card estadisticas-mapa-empty">
        <span className="estadisticas-mapa-icon">🗺️</span>
        <p>No hay encuestas con coordenadas.</p>
      </div>
    );
  }
  return (
    <div className="estadisticas-chart-card estadisticas-mapa-card">
      <h3>Mapa de encuestados</h3>
      <div className="estadisticas-mapa-container">
        <MapContainer center={MONTE_HERMOSO_CENTER} zoom={14} style={{ height: '100%', width: '100%', borderRadius: 8 }}>
          <TileLayer attribution="&copy; OSM" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {puntos.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]}>
              <Popup><strong>{p.persona?.apellido}, {p.persona?.nombre}</strong><br />DNI: {p.persona?.dni}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function exportarCSV(rows, filename = 'exportacion.csv') {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(';'), ...rows.map((r) => headers.map((h) => String(r[h] ?? '').replace(/;/g, ',')).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function EstadisticasDesarrolloSocialPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabSeccion, setTabSeccion] = useState('general');
  const defaultFiltros = useMemo(() => ({ ...ultimos3MesesRango(), campos: {} }), []);
  const [filtros, setFiltros] = useState(defaultFiltros);
  const [filtrosAplicados, setFiltrosAplicados] = useState(defaultFiltros);
  const [resumen, setResumen] = useState(null);
  const [serieTemporal, setSerieTemporal] = useState(null);
  const [serieTipoAsistencia, setSerieTipoAsistencia] = useState(null);
  const [campos, setCampos] = useState([]);
  const [agregados, setAgregados] = useState({});
  const [cruces, setCruces] = useState({});
  const [crucesDinamicos, setCrucesDinamicos] = useState([]);
  const [camposSeleccionados, setCamposSeleccionados] = useState([]);
  const [generarCruceLoading, setGenerarCruceLoading] = useState(false);
  const [cruceDinamicoExpandido, setCruceDinamicoExpandido] = useState(true);
  const [mapaPuntos, setMapaPuntos] = useState(null);
  const [opcionesTabla, setOpcionesTabla] = useState({ barrios: [], calles: [], nacionalidades: [], ciudades: [], niveles_educativos: [], instituciones_educativas: [] });
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const params = useMemo(
    () => buildParams(filtrosAplicados),
    [filtrosAplicados.fechaDesde, filtrosAplicados.fechaHasta, JSON.stringify(filtrosAplicados.campos || {})]
  );

  const aplicarFiltros = useCallback(() => {
    setFiltrosAplicados({ fechaDesde: filtros.fechaDesde, fechaHasta: filtros.fechaHasta, campos: { ...(filtros.campos || {}) } });
  }, [filtros.fechaDesde, filtros.fechaHasta, JSON.stringify(filtros.campos || {})]);

  useEffect(() => {
    const listOpt = { per_page: 500 };
    Promise.all([
      dsApi.barrios?.list?.(listOpt).then((r) => Array.isArray(r) ? r : (r?.data || [])).catch(() => []),
      dsApi.calles?.list?.(listOpt).then((r) => Array.isArray(r) ? r : (r?.data || [])).catch(() => []),
      dsApi.nacionalidades?.list?.(listOpt).then((r) => Array.isArray(r) ? r : (r?.data || [])).catch(() => []),
      dsApi.ciudades?.list?.(listOpt).then((r) => Array.isArray(r) ? r : (r?.data || [])).catch(() => []),
      dsApi.nivelesEducativos?.list?.(listOpt).then((r) => Array.isArray(r) ? r : (r?.data || [])).catch(() => []),
      dsApi.institucionesEducativas?.list?.(listOpt).then((r) => Array.isArray(r) ? r : (r?.data || [])).catch(() => []),
    ]).then(([barrios, calles, nacionalidades, ciudades, niveles, instituciones]) => {
      setOpcionesTabla({ barrios, calles, nacionalidades, ciudades, niveles_educativos: niveles, instituciones_educativas: instituciones });
    });
  }, []);

  const cargarTodo = useCallback(() => {
    setLoading(true);
    Promise.all([
      dsApi.estadisticas.resumen(params),
      dsApi.estadisticas.serieTemporal(params),
      dsApi.estadisticas.serieTemporalPorTipoAsistencia(params),
      dsApi.estadisticas.campos(),
    ])
      .then(([rResumen, rSerie, rSerieTipo, rCampos]) => {
        setResumen(rResumen);
        setSerieTemporal(rSerie);
        setSerieTipoAsistencia(rSerieTipo);
        setCampos(rCampos.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params]);

  const cargarDetalle = useCallback(() => {
    setLoadingDetalle(true);

    const promesasAgregado = [];
    const keysAgregado = [];

    const allCampos = [
      ...CAMPOS_POR_ENTIDAD.titular.map((c) => ({ ...c, entity: 'titular' })),
      ...CAMPOS_POR_ENTIDAD.grupo.map((c) => ({ ...c, entity: 'grupo' })),
      ...CAMPOS_POR_ENTIDAD.encuesta_social.map((c) => ({ ...c, entity: 'encuesta_social' })),
      ...CAMPOS_POR_ENTIDAD.asistencia.map((c) => ({ ...c, entity: 'asistencia' })),
    ];

    allCampos.forEach(({ entity, slug, nombre }) => {
      keysAgregado.push(`${entity}-${slug}`);
      promesasAgregado.push(dsApi.estadisticas.agregado({ entity, campo_slug: slug, ...params }).catch(() => null));
    });

    const promesasCruce = CRUCES_CONFIG.map((c) => ({
      key: `${c.entity}-${c.x}-${c.y}`,
      p: dsApi.estadisticas.cruce({ entity: c.entity, campo_x: c.x, campo_y: c.y, ...params }).catch(() => null),
    }));

    Promise.all([
      dsApi.estadisticas.agregadoPorBarrio(params),
      ...promesasAgregado,
      ...promesasCruce.map((x) => x.p),
      dsApi.estadisticas.mapa(params),
    ])
      .then((results) => {
        const [barrio, ...rest] = results;
        const aggResults = rest.slice(0, keysAgregado.length);
        const cruceResults = rest.slice(keysAgregado.length, -1);
        const mapa = rest[rest.length - 1];

        const aggMap = { 'titular-barrio': barrio };
        keysAgregado.forEach((k, i) => { aggMap[k] = aggResults[i]; });
        setAgregados(aggMap);

        const cruceMap = {};
        promesasCruce.forEach(({ key }, i) => { cruceMap[key] = cruceResults[i]; });
        setCruces(cruceMap);

        setMapaPuntos(mapa?.puntos || []);
      })
      .finally(() => setLoadingDetalle(false));
  }, [params, campos.length]);

  useEffect(() => { cargarTodo(); }, [cargarTodo]);

  useEffect(() => {
    const state = location.state;
    if (state?.tab === 'cruces' && state?.generarCruce?.campos_multi?.length >= 2) {
      setTabSeccion('cruces');
      setCamposSeleccionados(state.generarCruce.campos_multi);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!loading && campos.length > 0) {
      cargarDetalle();
    }
  }, [loading, campos.length, cargarDetalle]);

  const getAgg = (entity, slug) => agregados[`${entity}-${slug}`];
  const getCruce = (entity, x, y) => cruces[`${entity}-${x}-${y}`];

  const camposCruzablesPorEntidad = useMemo(() => {
    const byEntity = {};
    campos.filter((c) => ['select', 'select_tabla', 'boolean'].includes(c.tipo)).forEach((c) => {
      const e = c.appliesTo || 'titular';
      if (!byEntity[e]) byEntity[e] = [];
      byEntity[e].push(c);
    });
    return byEntity;
  }, [campos]);

  const isCampoSelected = (entity, slug) => camposSeleccionados.some((c) => c.entity === entity && c.slug === slug);

  const toggleCampoCruce = (entity, slug) => {
    setCamposSeleccionados((prev) => {
      const exists = prev.some((c) => c.entity === entity && c.slug === slug);
      return exists ? prev.filter((c) => !(c.entity === entity && c.slug === slug)) : [...prev, { entity, slug }];
    });
  };

  const generarCruce = useCallback(async () => {
    const sel = [...camposSeleccionados];
    if (sel.length < 2) return;

    const nombres = sel.map((c) => campos.find((x) => x.appliesTo === c.entity && x.slug === c.slug)?.nombre ?? c.slug);
    const titulo = nombres.join(' × ');

    setGenerarCruceLoading(true);
    try {
      const data = await dsApi.estadisticas.cruce({ ...params, campos_multi: sel });
      const nuevo = {
        id: `dyn-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sel,
        nombres,
        titulo,
        data,
      };
      setCrucesDinamicos((prev) => [nuevo, ...prev]);
    } catch (err) {
      console.error('Error generando cruce:', err);
    } finally {
      setGenerarCruceLoading(false);
    }
  }, [camposSeleccionados, params, campos]);

  const eliminarCruceDinamico = (id) =>
    setCrucesDinamicos((prev) => prev.filter((c) => c.id !== id));

  const tabs = [
    { id: 'general', label: 'General', icon: '📊' },
    { id: 'titular', label: 'Titulares', icon: '👤' },
    { id: 'encuesta', label: 'Encuestas', icon: '📋' },
    { id: 'asistencia', label: 'Asistencias', icon: '🤝' },
    { id: 'grupo', label: 'Grupo familiar', icon: '👨‍👩‍👧‍👦' },
    { id: 'cruces', label: 'Cruces', icon: '🔀' },
    { id: 'mapa', label: 'Mapa', icon: '🗺️' },
  ];

  return (
    <AppLayout>
      {(loading || loadingDetalle) && (
        <div className="estadisticas-loading-overlay" aria-live="polite" aria-busy="true">
          <div className="estadisticas-loading-spinner" />
          <p className="estadisticas-loading-text">
            {loading ? 'Cargando estadísticas...' : 'Cargando gráficos...'}
          </p>
        </div>
      )}
      <div className="estadisticas-dashboard">
        <header className="estadisticas-header">
          <h1>Dashboard de Estadísticas</h1>
          <p>Gestión y análisis de datos del módulo Desarrollo Social</p>
        </header>

        <FiltrosPanel filtros={filtros} setFiltros={setFiltros} campos={campos} opcionesTabla={opcionesTabla} onFiltrar={aplicarFiltros} />

        <section className="estadisticas-kpi-section">
          <ResumenCards data={resumen} loading={loading} />
        </section>

        <div className="estadisticas-tabs-seccion">
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`estadisticas-tab-seccion ${tabSeccion === t.id ? 'activo' : ''}`} onClick={() => setTabSeccion(t.id)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <section className="estadisticas-graficos-section">
          {tabSeccion === 'general' && (
            <>
              <div className="estadisticas-grafico-full">
                <div className="estadisticas-chart-header">
                  <span>Evolución mensual</span>
                  <button type="button" className="estadisticas-btn-link" onClick={() => exportarCSV(serieTemporal?.data?.map((r) => ({ mes: r.mesLabel, encuestas: r.encuestas, asistencias: r.asistencias })) || [], 'evolucion-mensual.csv')}>Exportar CSV</button>
                </div>
                <GraficoTemporal data={serieTemporal} loading={loading} sinTitulo />
              </div>
              <div className="estadisticas-grafico-full">
                <GraficoTemporalPorTipo data={serieTipoAsistencia} loading={loading} />
              </div>
              <div className="estadisticas-grid-2">
                <GraficoAgregado titulo="Titulares por barrio" data={agregados['titular-barrio']} loading={loadingDetalle} labelKey="barrio" />
                <GraficoCircular titulo="Tenencia de vivienda" data={getAgg('encuesta_social', 'tenencia')} loading={loadingDetalle} />
              </div>
              <div className="estadisticas-grid-2">
                <GraficoCircular titulo="Tipo de vivienda" data={getAgg('encuesta_social', 'tipo-de-vivienda')} loading={loadingDetalle} />
                <GraficoAgregado titulo="Tipo de asistencia" data={getAgg('asistencia', 'tipo')} loading={loadingDetalle} limit={14} />
              </div>
            </>
          )}

          {tabSeccion === 'titular' && (
            <div className="estadisticas-grid-charts">
              {CAMPOS_POR_ENTIDAD.titular.map(({ slug, nombre }) => (
                <div key={slug} className="estadisticas-chart-item">
                  <GraficoCircular titulo={nombre} data={getAgg('titular', slug)} loading={loadingDetalle} />
                </div>
              ))}
            </div>
          )}

          {tabSeccion === 'encuesta' && (
            <div className="estadisticas-grid-charts">
              {CAMPOS_POR_ENTIDAD.encuesta_social.map(({ slug, nombre }) => (
                <div key={slug} className="estadisticas-chart-item">
                  <GraficoCircular titulo={nombre} data={getAgg('encuesta_social', slug)} loading={loadingDetalle} />
                </div>
              ))}
            </div>
          )}

          {tabSeccion === 'asistencia' && (
            <>
              <div className="estadisticas-grid-2">
                <GraficoAgregado titulo="Tipo de asistencia" data={getAgg('asistencia', 'tipo')} loading={loadingDetalle} limit={14} />
                <GraficoCircular titulo="Estado" data={getAgg('asistencia', 'estado')} loading={loadingDetalle} />
              </div>
              <div className="estadisticas-grafico-full">
                <GraficoTemporalPorTipo data={serieTipoAsistencia} loading={loading} />
              </div>
            </>
          )}

          {tabSeccion === 'grupo' && (
            <div className="estadisticas-grid-charts">
              {CAMPOS_POR_ENTIDAD.grupo.map(({ slug, nombre }) => (
                <div key={slug} className="estadisticas-chart-item">
                  <GraficoCircular titulo={nombre} data={getAgg('grupo', slug)} loading={loadingDetalle} />
                </div>
              ))}
            </div>
          )}

          {tabSeccion === 'cruces' && (
            <div className="estadisticas-seccion-cruces">
              <div className={`estadisticas-cruce-dinamico-panel ${cruceDinamicoExpandido ? 'estadisticas-cruce-dinamico-panel--abierto' : ''}`}>
                <button
                  type="button"
                  className="estadisticas-cruce-dinamico-header"
                  onClick={() => setCruceDinamicoExpandido((v) => !v)}
                  aria-expanded={cruceDinamicoExpandido}
                >
                  <h3>Generar cruce dinámico</h3>
                  <span className="estadisticas-cruce-dinamico-chevron" aria-hidden>
                    {cruceDinamicoExpandido ? '▼' : '▶'}
                  </span>
                </button>
                {cruceDinamicoExpandido && (
                <>
                <p className="estadisticas-cruce-hint">Elegí 2 o más campos de cualquier entidad. Podés cruzar Titulares × Encuestas, Asistencias × Encuestas, etc.</p>
                <div className="estadisticas-cruce-dinamico-grid">
                  <div className="estadisticas-filtro-group estadisticas-campos-checkboxes">
                    <label>Campos a cruzar ({camposSeleccionados.length} seleccionados)</label>
                    <div className="estadisticas-checkbox-por-entidad">
                      {Object.entries(camposCruzablesPorEntidad).map(([entity, list]) => (
                        <div key={entity} className="estadisticas-checkbox-grupo">
                          <span className="estadisticas-checkbox-grupo-titulo">{ENTITY_LABELS[entity] || entity}</span>
                          <div className="estadisticas-checkbox-grid">
                            {list.map((c) => (
                              <label key={c.id} className="estadisticas-checkbox-item">
                                <input
                                  type="checkbox"
                                  checked={isCampoSelected(entity, c.slug)}
                                  onChange={() => toggleCampoCruce(entity, c.slug)}
                                />
                                <span>{c.nombre}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="estadisticas-filtro-group estadisticas-cruce-dinamico-accion">
                    <label>&nbsp;</label>
                    <button
                      type="button"
                      className="estadisticas-btn primario"
                      disabled={camposSeleccionados.length < 2 || generarCruceLoading}
                      onClick={generarCruce}
                    >
                      {generarCruceLoading ? 'Generando...' : `Generar cruce (${camposSeleccionados.length} campos)`}
                    </button>
                  </div>
                </div>
                </>
                )}
              </div>
              {crucesDinamicos.length > 0 && (
                <div className="estadisticas-cruce-subtitulo">Cruces generados</div>
              )}
              <div className="estadisticas-grid-charts">
                {crucesDinamicos.map((c) => (
                  <div key={c.id} className="estadisticas-chart-item">
                    <GraficoCruce titulo={c.titulo} data={c.data} loading={false} onRemove={() => eliminarCruceDinamico(c.id)} height={420} />
                  </div>
                ))}
              </div>
              {crucesDinamicos.length > 0 && <div className="estadisticas-cruce-subtitulo">Cruces predefinidos</div>}
              <div className="estadisticas-grid-charts">
                {CRUCES_CONFIG.map(({ entity, x, y, titulo }) => (
                  <div key={`${entity}-${x}-${y}`} className="estadisticas-chart-item">
                    <GraficoCruce titulo={titulo} data={getCruce(entity, x, y)} loading={loadingDetalle} height={420} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tabSeccion === 'mapa' && (
            <div className="estadisticas-grafico-full">
              <MapaEncuestados puntos={mapaPuntos} loading={loadingDetalle} />
            </div>
          )}

          <div className="estadisticas-export-actions">
            <button type="button" className="estadisticas-btn secundario" onClick={() => cargarDetalle()}>Actualizar gráficos</button>
            <button type="button" className="estadisticas-btn primario" onClick={() => agregados['titular-barrio']?.data && exportarCSV(agregados['titular-barrio'].data.map((r) => ({ barrio: r.barrio, total: r.total, porcentaje: r.porcentaje })), 'barrios.csv')}>Exportar barrios</button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

import { useState, useRef, useMemo, Fragment } from 'react';
import { sileo } from 'sileo';
import * as XLSX from 'xlsx';
import AppLayout from '../../components/AppLayout';
import { partidaApi, loteApi, apremioApi } from '../../api/recaudacionApi';
import './IntimacionPage.css';

function formatMonto(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

const EMPTY_FILTERS = {
  q: '', zona: '', codigo_postal: '', localidad: '', circunscripcion: '', seccion: '',
  ejercicio: '', con_contacto: false, cuotas_min: '', monto_min: '', recurrencia_min: '',
};

const MOTIVOS_EXCLUSION = [
  { value: 'en_tramite',      label: 'En trámite' },
  { value: 'pago_parcial',    label: 'Pago parcial' },
  { value: 'acuerdo_de_pago', label: 'Acuerdo de pago' },
  { value: 'error_datos',     label: 'Error en datos' },
  { value: 'otro',            label: 'Otro' },
];

const PAGE_SIZE = 20;

function cuotasLabel(cuotas = []) {
  return cuotas.map(c => 'C' + String(c).padStart(2, '0')).join(' ');
}

function exportarExcel(resultados) {
  const rows = resultados.map(r => ({
    'Nro Partida':  r.nro_partida || r.id,
    'Titular':      r.titular || '',
    'DNI':          r.titular_dni || '',
    'Domicilio':    r.titular_domicilio || '',
    'Localidad':    r.localidad || '',
    'Zona':         r.zona || '',
    'CP':           r.codigo_postal || '',
    'Circ.':        r.circunscripcion || '',
    'Secc.':        r.seccion || '',
    'Mail':         r.mail || '',
    'Teléfono':     r.telefono || r.celular || '',
    'Capital':      r.monto_capital || 0,
    'Intereses':    r.monto_intereses || 0,
    'Cuotas':       r.cuotas_adeudadas || 0,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Intimaciones');
  XLSX.writeFile(wb, `preview-intimacion-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Tabla de detalle de períodos (años/cuotas) reutilizable
function PeriodosDetalle({ periodos }) {
  if (!periodos || periodos.length === 0) return <div className="pj-periodos-empty">Sin detalle de períodos.</div>;
  return (
    <table className="pj-periodos-table">
      <thead>
        <tr><th>Ejercicio</th><th>Cuotas</th><th>Capital</th><th>Intereses</th><th>Total</th></tr>
      </thead>
      <tbody>
        {periodos.map((p, i) => (
          <tr key={i}>
            <td>{p.ejercicio}</td>
            <td className="pj-periodos-cuotas">{cuotasLabel(p.cuotas)}</td>
            <td>{formatMonto(p.capital)}</td>
            <td>{formatMonto(p.interes)}</td>
            <td>{formatMonto(p.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Paginacion({ page, total, onPage }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const nums = new Set([1, pages, page, page - 1, page + 1].filter(p => p >= 1 && p <= pages));
  const arr = Array.from(nums).sort((a, b) => a - b);
  return (
    <div className="pj-paginacion">
      <button type="button" className="pj-pag-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>‹</button>
      {arr.map((n, i) => (
        <span key={n}>
          {i > 0 && n - arr[i - 1] > 1 && <span className="pj-pag-dots">…</span>}
          <button type="button" className={`pj-pag-btn${n === page ? ' pj-pag-btn--active' : ''}`} onClick={() => onPage(n)}>{n}</button>
        </span>
      ))}
      <button type="button" className="pj-pag-btn" disabled={page === pages} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}

const APREMIO_ESTADO = {
  nuevo:     { label: 'A iniciar', cls: 'pj-ap-badge--new' },
  conflicto: { label: 'Apremio activo', cls: 'pj-ap-badge--warn' },
  huerfano:  { label: 'Sin padrón', cls: 'pj-ap-badge--err' },
};

export default function IntimacionPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [resPage, setResPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(null); // 'exclusion' | 'generar' | 'apremio'
  const [modalForm, setModalForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loteGenerado, setLoteGenerado] = useState(null);
  const fileRef = useRef(null);

  // Apremio (TSU)
  const [apremioStep, setApremioStep] = useState('upload'); // 'upload' | 'preview'
  const [apremioFile, setApremioFile] = useState(null);
  const [apremioData, setApremioData] = useState(null); // { token, items, resumen, nombre_archivo }
  const [apremioSel, setApremioSel] = useState(new Set());
  const [apremioPage, setApremioPage] = useState(1);
  const [apremioExpanded, setApremioExpanded] = useState(null);
  const apremioFileRef = useRef(null);

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([k, v]) => v !== '' && v !== false).length,
    [filters]
  );

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v === '' || v === false) return;
        params[k] = v === true ? 1 : v;
      });
      const res = await partidaApi.preview(params);
      const data = res.data || [];
      setResultados(Array.isArray(data) ? data : []);
      setSelected(new Set());
      setResPage(1);
      setExpanded(null);
      setPreviewDone(true);
    } catch (err) {
      sileo.error({ title: 'Error en vista previa', description: err.message });
    } finally {
      setPreviewing(false);
    }
  };

  const pageResultados = resultados.slice((resPage - 1) * PAGE_SIZE, resPage * PAGE_SIZE);

  const toggleAll = () => {
    if (selected.size === resultados.length) setSelected(new Set());
    else setSelected(new Set(resultados.map(r => r.id)));
  };
  const toggleItem = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalCapitalSeleccionado = resultados
    .filter(r => selected.has(r.id))
    .reduce((acc, r) => acc + (parseFloat(r.monto_capital) || 0), 0);

  // ── Apremio: vista previa ──
  const handleApremioPreview = async (e) => {
    e.preventDefault();
    if (!apremioFile) return sileo.error({ title: 'Seleccioná el archivo TSU/.DAT' });
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('archivo', apremioFile);
      const res = await apremioApi.preview(fd);
      setApremioData(res);
      // por defecto seleccionar todo lo que NO es huérfano
      setApremioSel(new Set(res.items.filter(i => i.estado !== 'huerfano').map(i => i.nro_partida)));
      setApremioPage(1);
      setApremioExpanded(null);
      setApremioStep('preview');
    } catch (err) {
      sileo.error({ title: 'Error al analizar el archivo', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const seleccionables = useMemo(
    () => (apremioData?.items || []).filter(i => i.estado !== 'huerfano'),
    [apremioData]
  );

  const toggleApremioAll = () => {
    if (apremioSel.size === seleccionables.length) setApremioSel(new Set());
    else setApremioSel(new Set(seleccionables.map(i => i.nro_partida)));
  };
  const toggleApremio = (nro) => {
    setApremioSel(prev => {
      const next = new Set(prev);
      next.has(nro) ? next.delete(nro) : next.add(nro);
      return next;
    });
  };

  const handleApremioConfirmar = async () => {
    if (apremioSel.size === 0) return sileo.error({ title: 'Seleccioná al menos una partida' });
    setSaving(true);
    try {
      const res = await apremioApi.confirmar(apremioData.token, Array.from(apremioSel));
      sileo.success({
        title: `${res.iniciados} apremios iniciados`,
        description: res.huerfanos ? `${res.huerfanos} sin padrón omitidas` : undefined,
      });
      resetApremio();
      if (previewDone) handlePreview();
    } catch (err) {
      sileo.error({ title: 'Error al cargar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const resetApremio = () => {
    setModal(null);
    setApremioStep('upload');
    setApremioFile(null);
    setApremioData(null);
    setApremioSel(new Set());
    setApremioPage(1);
    setApremioExpanded(null);
    if (apremioFileRef.current) apremioFileRef.current.value = '';
  };

  const apremioPageItems = (apremioData?.items || []).slice((apremioPage - 1) * PAGE_SIZE, apremioPage * PAGE_SIZE);
  const totalApremioSel = (apremioData?.items || [])
    .filter(i => apremioSel.has(i.nro_partida))
    .reduce((a, i) => a + (parseFloat(i.monto_total) || 0), 0);

  // ── Exclusiones ──
  const handleExcluirTxt = async (e) => {
    e.preventDefault();
    if (!modalForm.archivo) return sileo.error({ title: 'Seleccioná un archivo TXT' });
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('archivo', modalForm.archivo);
      if (modalForm.motivo) fd.append('motivo', modalForm.motivo);
      await partidaApi.excluirTxt(fd);
      sileo.success({ title: 'Exclusiones aplicadas correctamente' });
      setModal(null);
      setModalForm({});
      if (fileRef.current) fileRef.current.value = '';
      if (previewDone) handlePreview();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Generar lote ──
  const handleGenerar = async (e) => {
    e.preventDefault();
    if (selected.size === 0) return sileo.error({ title: 'Seleccioná al menos una partida' });
    setSaving(true);
    try {
      const lote = await loteApi.create({
        partida_ids: Array.from(selected),
        descripcion: modalForm.descripcion || '',
      });
      sileo.success({ title: `Lote generado: ${lote.total_partidas ?? selected.size} cartas documento` });
      setLoteGenerado(lote);
      setModal(null);
      setSelected(new Set());
    } catch (err) {
      sileo.error({ title: 'Error al generar lote', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="pj-intimacion-page">
        <div className="pj-intimacion-hero">
          <h1>Generación de Intimaciones</h1>
          <p>Segmentá partidas y generá lotes de cartas documento</p>
        </div>

        {loteGenerado && (
          <div className="pj-success-banner">
            <span className="pj-success-banner-text">
              Lote generado — {loteGenerado.total_partidas} cartas documento (triplicado)
            </span>
            <button type="button" className="pj-btn pj-btn--primary pj-btn--sm" onClick={() => loteApi.download(loteGenerado.id)}>
              Descargar PDF
            </button>
          </div>
        )}

        <div className="pj-intimacion-layout">
          <div>
            {/* Filtros colapsables */}
            <div className="pj-filters-panel">
              <button type="button" className="pj-filters-toggle" onClick={() => setFiltersOpen(o => !o)}>
                <span className="pj-filters-title">
                  Filtros de Segmentación
                  {activeFilterCount > 0 && <span className="pj-filters-count">{activeFilterCount}</span>}
                </span>
                <span className={`pj-filters-chevron${filtersOpen ? ' open' : ''}`}>▾</span>
              </button>

              {filtersOpen && (
                <>
                  <div className="pj-filters-grid">
                    <div className="pj-filter-field">
                      <label>Búsqueda libre</label>
                      <input type="text" placeholder="Partida, titular, CUIT..." value={filters.q}
                        onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Zona</label>
                      <input type="text" placeholder="Zona" value={filters.zona}
                        onChange={e => setFilters(p => ({ ...p, zona: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Localidad</label>
                      <input type="text" placeholder="Localidad" value={filters.localidad}
                        onChange={e => setFilters(p => ({ ...p, localidad: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Código Postal</label>
                      <input type="text" placeholder="CP" value={filters.codigo_postal}
                        onChange={e => setFilters(p => ({ ...p, codigo_postal: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Circunscripción</label>
                      <input type="text" placeholder="Circ." value={filters.circunscripcion}
                        onChange={e => setFilters(p => ({ ...p, circunscripcion: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Sección</label>
                      <input type="text" placeholder="Secc." value={filters.seccion}
                        onChange={e => setFilters(p => ({ ...p, seccion: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Ejercicio (año adeudado)</label>
                      <input type="number" placeholder="ej: 2025" value={filters.ejercicio}
                        onChange={e => setFilters(p => ({ ...p, ejercicio: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Cuotas mínimas</label>
                      <input type="number" min="0" placeholder="0" value={filters.cuotas_min}
                        onChange={e => setFilters(p => ({ ...p, cuotas_min: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Monto mínimo $</label>
                      <input type="number" min="0" placeholder="0" value={filters.monto_min}
                        onChange={e => setFilters(p => ({ ...p, monto_min: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field">
                      <label>Recurrencia mínima</label>
                      <input type="number" min="0" placeholder="BR-02" value={filters.recurrencia_min}
                        onChange={e => setFilters(p => ({ ...p, recurrencia_min: e.target.value }))} />
                    </div>
                    <div className="pj-filter-field pj-filter-check">
                      <label>
                        <input type="checkbox" checked={filters.con_contacto}
                          onChange={e => setFilters(p => ({ ...p, con_contacto: e.target.checked }))} />
                        Solo con contacto (mail/tel)
                      </label>
                    </div>
                  </div>
                  <div className="pj-filters-footer">
                    <button type="button" className="pj-btn pj-btn--primary pj-btn--sm" onClick={handlePreview} disabled={previewing}>
                      {previewing ? 'Cargando...' : 'Vista Previa'}
                    </button>
                    <button type="button" className="pj-btn pj-btn--ghost pj-btn--sm"
                      onClick={() => { setFilters(EMPTY_FILTERS); setResultados([]); setPreviewDone(false); setSelected(new Set()); }}>
                      Limpiar
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Resultados */}
            {previewDone && (
              <div className="pj-results-panel">
                <div className="pj-results-header">
                  <span className="pj-results-title">{resultados.length} partidas encontradas{resultados.length >= 500 ? ' (máx. 500)' : ''}</span>
                  {resultados.length > 0 && (
                    <button type="button" className="pj-btn pj-btn--ghost pj-btn--sm" onClick={() => exportarExcel(resultados)}>
                      Exportar Excel
                    </button>
                  )}
                </div>
                {resultados.length === 0 ? (
                  <div className="pj-empty">Sin partidas para los filtros seleccionados.</div>
                ) : (
                  <>
                    <div className="pj-table-scroll">
                      <table className="pj-table pj-table--rich">
                        <thead>
                          <tr>
                            <th><input type="checkbox" checked={selected.size === resultados.length && resultados.length > 0} onChange={toggleAll} /></th>
                            <th></th>
                            <th>Nro Partida</th>
                            <th>Titular</th>
                            <th>Domicilio</th>
                            <th>Localidad</th>
                            <th>Zona</th>
                            <th className="pj-num">Capital</th>
                            <th className="pj-num">Intereses</th>
                            <th className="pj-num">Total</th>
                            <th className="pj-num">Cuotas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageResultados.map((r) => {
                            const total = (parseFloat(r.monto_capital) || 0) + (parseFloat(r.monto_intereses) || 0);
                            const isExp = expanded === r.id;
                            return (
                              <Fragment key={r.id}>
                                <tr className={selected.has(r.id) ? 'pj-row--sel' : ''}>
                                  <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleItem(r.id)} /></td>
                                  <td>
                                    {r.periodos?.length > 0 && (
                                      <button type="button" className="pj-expand-btn" onClick={() => setExpanded(isExp ? null : r.id)}>
                                        {isExp ? '▾' : '▸'}
                                      </button>
                                    )}
                                  </td>
                                  <td style={{ fontWeight: 600 }}>{r.nro_partida || r.id}</td>
                                  <td>{r.titular || '—'}{r.titular_dni ? <span className="pj-sub">DNI {r.titular_dni}</span> : null}</td>
                                  <td>{r.titular_domicilio || '—'}</td>
                                  <td>{r.localidad || '—'}</td>
                                  <td>{r.zona || '—'}</td>
                                  <td className="pj-num">{formatMonto(r.monto_capital)}</td>
                                  <td className="pj-num">{formatMonto(r.monto_intereses)}</td>
                                  <td className="pj-num" style={{ fontWeight: 600 }}>{formatMonto(total)}</td>
                                  <td className="pj-num">{r.cuotas_adeudadas ?? 0}</td>
                                </tr>
                                {isExp && (
                                  <tr className="pj-row-detail">
                                    <td colSpan={11}><PeriodosDetalle periodos={r.periodos} /></td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="pj-results-footer">
                      <span>Seleccionados: <strong>{selected.size}</strong></span>
                      <span>Capital total seleccionado: <strong>{formatMonto(totalCapitalSeleccionado)}</strong></span>
                    </div>
                    <Paginacion page={resPage} total={resultados.length} onPage={setResPage} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="pj-sidebar">
            <div className="pj-sidebar-card">
              <div className="pj-sidebar-title">Acciones</div>
              <button type="button" className="pj-btn pj-btn--primary pj-btn--sm"
                onClick={() => { resetApremio(); setModal('apremio'); }}>
                Iniciar Apremio (TSU/.DAT)
              </button>
              <button type="button" className="pj-btn pj-btn--ghost pj-btn--sm"
                onClick={() => { setModal('exclusion'); setModalForm({}); }}>
                Subir TXT de exclusiones
              </button>
              {previewDone && (
                <button type="button" className="pj-btn pj-btn--primary pj-btn--sm" disabled={selected.size === 0}
                  onClick={() => { setModal('generar'); setModalForm({}); }}>
                  Generar Cartas Documento ({selected.size})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Iniciar Apremio (TSU/.DAT) */}
      {modal === 'apremio' && (
        <div className="pj-modal-overlay" onClick={e => e.target === e.currentTarget && resetApremio()}>
          <div className="pj-modal pj-modal--xwide">
            <h2>Iniciar Apremio — Archivo de Deuda (TSU/.DAT)</h2>

            {apremioStep === 'upload' && (
              <form onSubmit={handleApremioPreview}>
                <p className="pj-modal-hint">
                  Subí el archivo TSU/.DAT. Vas a ver una <strong>vista previa completa</strong> de cada partida
                  con su deuda antes de generar nada. Después elegís cuáles cargar.
                </p>
                <div className="pj-modal-field">
                  <label>Archivo TSU / .DAT</label>
                  <input ref={apremioFileRef} type="file" accept=".txt,.dat,.DAT"
                    onChange={e => setApremioFile(e.target.files[0] || null)} />
                </div>
                <div className="pj-modal-actions">
                  <button type="button" className="pj-btn pj-btn--ghost" onClick={resetApremio}>Cancelar</button>
                  <button type="submit" className="pj-btn pj-btn--primary" disabled={saving}>
                    {saving ? 'Analizando...' : 'Analizar'}
                  </button>
                </div>
              </form>
            )}

            {apremioStep === 'preview' && apremioData && (
              <div>
                <div className="pj-apremio-resumen">
                  <span className="pj-padron-chip pj-padron-chip--new">{apremioData.resumen.nuevos} a iniciar</span>
                  {apremioData.resumen.conflictos > 0 && <span className="pj-padron-chip pj-padron-chip--warn">{apremioData.resumen.conflictos} con apremio activo</span>}
                  {apremioData.resumen.huerfanos > 0 && <span className="pj-padron-chip pj-padron-chip--err">{apremioData.resumen.huerfanos} sin padrón</span>}
                  <span className="pj-padron-chip">{apremioData.resumen.total} total en archivo</span>
                </div>
                <p className="pj-modal-hint">
                  Todas vienen tildadas salvo las que no tienen padrón. Destildá las que no quieras cargar.
                  Las marcadas como <em>apremio activo</em> generarán un nuevo apremio si las dejás tildadas.
                </p>

                <div className="pj-table-scroll pj-table-scroll--modal">
                  <table className="pj-table pj-table--rich">
                    <thead>
                      <tr>
                        <th><input type="checkbox" checked={apremioSel.size === seleccionables.length && seleccionables.length > 0} onChange={toggleApremioAll} /></th>
                        <th></th>
                        <th>Estado</th>
                        <th>Nro</th>
                        <th>Titular</th>
                        <th>Domicilio</th>
                        <th>Zona</th>
                        <th className="pj-num">Total</th>
                        <th className="pj-num">Cuotas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apremioPageItems.map((it) => {
                        const huer = it.estado === 'huerfano';
                        const exp = apremioExpanded === it.nro_partida;
                        const badge = APREMIO_ESTADO[it.estado];
                        return (
                          <Fragment key={it.nro_partida}>
                            <tr className={apremioSel.has(it.nro_partida) ? 'pj-row--sel' : (huer ? 'pj-row--dis' : '')}>
                              <td>
                                <input type="checkbox" disabled={huer}
                                  checked={apremioSel.has(it.nro_partida)} onChange={() => toggleApremio(it.nro_partida)} />
                              </td>
                              <td>
                                {it.periodos?.length > 0 && (
                                  <button type="button" className="pj-expand-btn" onClick={() => setApremioExpanded(exp ? null : it.nro_partida)}>{exp ? '▾' : '▸'}</button>
                                )}
                              </td>
                              <td><span className={`pj-ap-badge ${badge.cls}`}>{badge.label}</span></td>
                              <td style={{ fontWeight: 600 }}>{it.nro_partida}</td>
                              <td>{it.titular || '—'}</td>
                              <td>{it.titular_domicilio || '—'}</td>
                              <td>{it.zona || '—'}</td>
                              <td className="pj-num" style={{ fontWeight: 600 }}>{formatMonto(it.monto_total)}</td>
                              <td className="pj-num">{it.cuotas_adeudadas}</td>
                            </tr>
                            {exp && (
                              <tr className="pj-row-detail"><td colSpan={9}><PeriodosDetalle periodos={it.periodos} /></td></tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pj-results-footer">
                  <span>Seleccionadas: <strong>{apremioSel.size}</strong></span>
                  <span>Total deuda seleccionada: <strong>{formatMonto(totalApremioSel)}</strong></span>
                </div>
                <Paginacion page={apremioPage} total={apremioData.items.length} onPage={setApremioPage} />

                <div className="pj-modal-actions">
                  <button type="button" className="pj-btn pj-btn--ghost" onClick={() => setApremioStep('upload')}>Volver</button>
                  <button type="button" className="pj-btn pj-btn--primary" disabled={saving || apremioSel.size === 0} onClick={handleApremioConfirmar}>
                    {saving ? 'Cargando...' : `Cargar ${apremioSel.size} apremios`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Exclusión TXT */}
      {modal === 'exclusion' && (
        <div className="pj-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="pj-modal">
            <h2>Subir TXT de Exclusiones</h2>
            <form onSubmit={handleExcluirTxt}>
              <div className="pj-modal-field">
                <label>Archivo TXT</label>
                <input ref={fileRef} type="file" accept=".txt,.csv"
                  onChange={e => setModalForm(p => ({ ...p, archivo: e.target.files[0] || null }))} />
              </div>
              <div className="pj-modal-field">
                <label>Motivo (opcional)</label>
                <select value={modalForm.motivo || ''} onChange={e => setModalForm(p => ({ ...p, motivo: e.target.value }))}>
                  <option value="">— Sin especificar —</option>
                  {MOTIVOS_EXCLUSION.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="pj-modal-actions">
                <button type="button" className="pj-btn pj-btn--ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pj-btn pj-btn--primary" disabled={saving}>
                  {saving ? 'Aplicando...' : 'Aplicar Exclusiones'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generar lote */}
      {modal === 'generar' && (
        <div className="pj-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="pj-modal">
            <h2>Generar Cartas Documento</h2>
            <form onSubmit={handleGenerar}>
              <div className="pj-modal-field">
                <label>Descripción del lote</label>
                <textarea rows={3} placeholder="Descripción del lote de intimación..."
                  value={modalForm.descripcion || ''} onChange={e => setModalForm(p => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 0 }}>
                Se generarán <strong>{selected.size}</strong> cartas documento (triplicado = {selected.size * 3} hojas).
              </p>
              <div className="pj-modal-actions">
                <button type="button" className="pj-btn pj-btn--ghost" onClick={() => setModal(null)}>Cancelar</button>
                <button type="submit" className="pj-btn pj-btn--primary" disabled={saving}>
                  {saving ? 'Generando...' : 'Confirmar y Generar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

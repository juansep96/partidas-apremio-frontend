import { useState, useRef } from 'react';
import { sileo } from 'sileo';
import * as XLSX from 'xlsx';
import AppLayout from '../../components/AppLayout';
import { partidaApi, loteApi, apremioApi } from '../../api/recaudacionApi';
import './IntimacionPage.css';

function formatMonto(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

const MOTIVOS_EXCLUSION = [
  { value: 'en_tramite',      label: 'En trámite' },
  { value: 'pago_parcial',    label: 'Pago parcial' },
  { value: 'acuerdo_de_pago', label: 'Acuerdo de pago' },
  { value: 'error_datos',     label: 'Error en datos' },
  { value: 'otro',            label: 'Otro' },
];

function exportarExcel(resultados) {
  const rows = resultados.map(r => ({
    'Nro Partida':  r.nro_partida || r.id,
    'Titular':      r.titular || '',
    'DNI':          r.titular_dni || '',
    'Domicilio':    r.titular_domicilio || '',
    'Zona':         r.zona || '',
    'CP':           r.codigo_postal || '',
    'Capital':      r.monto_capital || 0,
    'Intereses':    r.monto_intereses || 0,
    'Cuotas':       r.cuotas_adeudadas || 0,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Intimaciones');
  XLSX.writeFile(wb, `preview-intimacion-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function IntimacionPage() {
  const [filters, setFilters] = useState({
    q: '', zona: '', codigo_postal: '', cuotas_min: '', monto_min: '', recurrencia_min: '',
  });
  const [resultados, setResultados] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null); // 'exclusion' | 'generar'
  const [modalForm, setModalForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loteGenerado, setLoteGenerado] = useState(null);
  const fileRef = useRef(null);
  // Apremio (proceso 2 — TSU/.DAT)
  const [apremioFile, setApremioFile] = useState(null);
  const [apremioReport, setApremioReport] = useState(null);
  const [forzar, setForzar] = useState(new Set());
  const apremioFileRef = useRef(null);

  const resetApremio = () => {
    setModal(null);
    setApremioFile(null);
    setApremioReport(null);
    setForzar(new Set());
    if (apremioFileRef.current) apremioFileRef.current.value = '';
  };

  const handleApremioIniciar = async (e) => {
    e.preventDefault();
    if (!apremioFile) return sileo.error({ title: 'Seleccioná el archivo TSU/.DAT' });
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('archivo', apremioFile);
      const res = await apremioApi.iniciar(fd);
      setApremioReport(res);
      setForzar(new Set());
      sileo.success({ title: `Apremio iniciado: ${res.iniciados} legajos creados` });
      if (previewDone) handlePreview();
    } catch (err) {
      sileo.error({ title: 'Error al iniciar apremio', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleForzar = (nro) => {
    setForzar(prev => {
      const next = new Set(prev);
      next.has(nro) ? next.delete(nro) : next.add(nro);
      return next;
    });
  };

  const handleApremioConfirmarConflictos = async () => {
    if (forzar.size === 0 || !apremioReport?.token) return;
    setSaving(true);
    try {
      const res = await apremioApi.confirmar(apremioReport.token, Array.from(forzar));
      sileo.success({ title: `${res.iniciados} nuevos apremios generados` });
      resetApremio();
      if (previewDone) handlePreview();
    } catch (err) {
      sileo.error({ title: 'Error al confirmar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.zona) params.zona = filters.zona;
      if (filters.codigo_postal) params.codigo_postal = filters.codigo_postal;
      if (filters.cuotas_min) params.cuotas_min = filters.cuotas_min;
      if (filters.monto_min) params.monto_min = filters.monto_min;
      if (filters.recurrencia_min) params.recurrencia_min = filters.recurrencia_min;
      const res = await partidaApi.preview(params);
      const data = res.data || [];
      setResultados(Array.isArray(data) ? data : []);
      setSelected(new Set());
      setPreviewDone(true);
    } catch (err) {
      sileo.error({ title: 'Error en vista previa', description: err.message });
    } finally {
      setPreviewing(false);
    }
  };

  const toggleAll = () => {
    if (selected.size === resultados.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(resultados.map(r => r.id)));
    }
  };

  const toggleItem = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCapitalSeleccionado = resultados
    .filter(r => selected.has(r.id))
    .reduce((acc, r) => acc + (parseFloat(r.monto_capital) || 0), 0);

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
            <button
              type="button"
              className="pj-btn pj-btn--primary pj-btn--sm"
              onClick={() => loteApi.download(loteGenerado.id)}
            >
              Descargar PDF
            </button>
          </div>
        )}

        <div className="pj-intimacion-layout">
          <div>
            {/* Filtros */}
            <div className="pj-filters-panel">
              <div className="pj-filters-header">
                <span className="pj-filters-title">Filtros de Segmentación</span>
              </div>
              <div className="pj-filters-grid">
                <div className="pj-filter-field">
                  <label>Búsqueda libre</label>
                  <input
                    type="text"
                    placeholder="Partida, titular..."
                    value={filters.q}
                    onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
                  />
                </div>
                <div className="pj-filter-field">
                  <label>Zona</label>
                  <input
                    type="text"
                    placeholder="Zona"
                    value={filters.zona}
                    onChange={e => setFilters(p => ({ ...p, zona: e.target.value }))}
                  />
                </div>
                <div className="pj-filter-field">
                  <label>Código Postal</label>
                  <input
                    type="text"
                    placeholder="CP"
                    value={filters.codigo_postal}
                    onChange={e => setFilters(p => ({ ...p, codigo_postal: e.target.value }))}
                  />
                </div>
                <div className="pj-filter-field">
                  <label>Cuotas mínimas</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.cuotas_min}
                    onChange={e => setFilters(p => ({ ...p, cuotas_min: e.target.value }))}
                  />
                </div>
                <div className="pj-filter-field">
                  <label>Monto mínimo $</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.monto_min}
                    onChange={e => setFilters(p => ({ ...p, monto_min: e.target.value }))}
                  />
                </div>
                <div className="pj-filter-field">
                  <label>Recurrencia mínima</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="BR-02"
                    value={filters.recurrencia_min}
                    onChange={e => setFilters(p => ({ ...p, recurrencia_min: e.target.value }))}
                  />
                </div>
              </div>
              <div className="pj-filters-footer">
                <button type="button" className="pj-btn pj-btn--primary pj-btn--sm" onClick={handlePreview} disabled={previewing}>
                  {previewing ? 'Cargando...' : 'Vista Previa'}
                </button>
                <button
                  type="button"
                  className="pj-btn pj-btn--ghost pj-btn--sm"
                  onClick={() => {
                    setFilters({ q: '', zona: '', codigo_postal: '', cuotas_min: '', monto_min: '', recurrencia_min: '' });
                    setResultados([]);
                    setPreviewDone(false);
                    setSelected(new Set());
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Resultados */}
            {previewDone && (
              <div className="pj-results-panel">
                <div className="pj-results-header">
                  <span className="pj-results-title">{resultados.length} partidas encontradas</span>
                  {resultados.length > 0 && (
                    <button
                      type="button"
                      className="pj-btn pj-btn--ghost pj-btn--sm"
                      onClick={() => exportarExcel(resultados)}
                    >
                      Exportar Excel
                    </button>
                  )}
                </div>
                {resultados.length === 0 ? (
                  <div className="pj-empty">Sin partidas para los filtros seleccionados.</div>
                ) : (
                  <>
                    <table className="pj-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              checked={selected.size === resultados.length && resultados.length > 0}
                              onChange={toggleAll}
                            />
                          </th>
                          <th>Nro Partida</th>
                          <th>Titular</th>
                          <th>Capital</th>
                          <th>Intereses</th>
                          <th>Zona</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultados.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selected.has(r.id)}
                                onChange={() => toggleItem(r.id)}
                              />
                            </td>
                            <td style={{ fontWeight: 600 }}>{r.nro_partida || r.id}</td>
                            <td>{r.titular || '—'}</td>
                            <td>{formatMonto(r.monto_capital)}</td>
                            <td>{formatMonto(r.monto_intereses)}</td>
                            <td>{r.zona || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="pj-results-footer">
                      <span>Seleccionados: <strong>{selected.size}</strong></span>
                      <span>Capital total seleccionado: <strong>{formatMonto(totalCapitalSeleccionado)}</strong></span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="pj-sidebar">
            <div className="pj-sidebar-card">
              <div className="pj-sidebar-title">Acciones</div>
              <button
                type="button"
                className="pj-btn pj-btn--primary pj-btn--sm"
                onClick={() => { setModal('apremio'); setApremioReport(null); setApremioFile(null); setForzar(new Set()); }}
              >
                Iniciar Apremio (TSU/.DAT)
              </button>
              <button
                type="button"
                className="pj-btn pj-btn--ghost pj-btn--sm"
                onClick={() => { setModal('exclusion'); setModalForm({}); }}
              >
                Subir TXT de exclusiones
              </button>
              {previewDone && (
                <button
                  type="button"
                  className="pj-btn pj-btn--primary pj-btn--sm"
                  disabled={selected.size === 0}
                  onClick={() => { setModal('generar'); setModalForm({}); }}
                >
                  Generar Cartas Documento ({selected.size} seleccionados)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Iniciar Apremio (TSU/.DAT) */}
      {modal === 'apremio' && (
        <div className="pj-modal-overlay" onClick={e => e.target === e.currentTarget && resetApremio()}>
          <div className="pj-modal pj-modal--wide">
            <h2>Iniciar Apremio — Archivo de Deuda (TSU/.DAT)</h2>

            {!apremioReport ? (
              <form onSubmit={handleApremioIniciar}>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Subí el archivo TSU/.DAT con la deuda. Se creará un legajo (inicio de gestión) por cada
                  partida sin apremio activo. Las partidas con un apremio en curso se listarán como conflicto
                  para que decidas si generás un nuevo apremio.
                </p>
                <div className="pj-modal-field">
                  <label>Archivo TSU / .DAT</label>
                  <input
                    ref={apremioFileRef}
                    type="file"
                    accept=".txt,.dat,.DAT"
                    onChange={e => setApremioFile(e.target.files[0] || null)}
                  />
                </div>
                <div className="pj-modal-actions">
                  <button type="button" className="pj-btn pj-btn--ghost" onClick={resetApremio}>Cancelar</button>
                  <button type="submit" className="pj-btn pj-btn--primary" disabled={saving}>
                    {saving ? 'Procesando...' : 'Iniciar Apremio'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="pj-apremio-resumen">
                  <span className="pj-padron-chip pj-padron-chip--new">{apremioReport.iniciados} apremios iniciados</span>
                  {apremioReport.conflictos?.length > 0 && (
                    <span className="pj-padron-chip pj-padron-chip--warn">{apremioReport.conflictos.length} con apremio activo</span>
                  )}
                  {apremioReport.huerfanos?.length > 0 && (
                    <span className="pj-padron-chip pj-padron-chip--err">{apremioReport.huerfanos.length} sin padrón</span>
                  )}
                  {apremioReport.errores?.length > 0 && (
                    <span className="pj-padron-chip pj-padron-chip--err">{apremioReport.errores.length} errores</span>
                  )}
                </div>

                {apremioReport.huerfanos?.length > 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#991b1b' }}>
                    Sin padrón (no se puede generar carta documento): {apremioReport.huerfanos.slice(0, 30).join(', ')}
                    {apremioReport.huerfanos.length > 30 ? '…' : ''}. Actualizá el padrón primero.
                  </p>
                )}

                {apremioReport.conflictos?.length > 0 && (
                  <>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>
                      Partidas con apremio activo — marcá las que querés re-intimar (genera un nuevo apremio):
                    </p>
                    <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <table className="pj-table">
                        <thead>
                          <tr>
                            <th>
                              <input
                                type="checkbox"
                                checked={forzar.size === apremioReport.conflictos.length}
                                onChange={() => setForzar(forzar.size === apremioReport.conflictos.length
                                  ? new Set()
                                  : new Set(apremioReport.conflictos.map(c => c.nro)))}
                              />
                            </th>
                            <th>Partida</th>
                            <th>Total deuda</th>
                            <th>Cuotas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apremioReport.conflictos.map(c => (
                            <tr key={c.nro}>
                              <td><input type="checkbox" checked={forzar.has(c.nro)} onChange={() => toggleForzar(c.nro)} /></td>
                              <td style={{ fontWeight: 600 }}>{c.nro}</td>
                              <td>{formatMonto(c.monto_total)}</td>
                              <td>{c.cuotas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div className="pj-modal-actions">
                  <button type="button" className="pj-btn pj-btn--ghost" onClick={resetApremio}>Cerrar</button>
                  {apremioReport.conflictos?.length > 0 && (
                    <button type="button" className="pj-btn pj-btn--primary" disabled={saving || forzar.size === 0} onClick={handleApremioConfirmarConflictos}>
                      {saving ? 'Generando...' : `Re-intimar ${forzar.size} seleccionadas`}
                    </button>
                  )}
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
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv"
                  onChange={e => setModalForm(p => ({ ...p, archivo: e.target.files[0] || null }))}
                />
              </div>
              <div className="pj-modal-field">
                <label>Motivo (opcional)</label>
                <select value={modalForm.motivo || ''} onChange={e => setModalForm(p => ({ ...p, motivo: e.target.value }))}>
                  <option value="">— Sin especificar —</option>
                  {MOTIVOS_EXCLUSION.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
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
                <textarea
                  rows={3}
                  placeholder="Descripción del lote de intimación..."
                  value={modalForm.descripcion || ''}
                  onChange={e => setModalForm(p => ({ ...p, descripcion: e.target.value }))}
                />
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

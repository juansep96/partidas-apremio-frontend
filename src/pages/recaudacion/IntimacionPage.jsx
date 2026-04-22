import { useState, useRef } from 'react';
import { sileo } from 'sileo';
import AppLayout from '../../components/AppLayout';
import { partidaApi, loteApi } from '../../api/recaudacionApi';
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

function exportarCSV(resultados) {
  const headers = ['Nro Partida', 'Titular', 'DNI', 'Domicilio', 'Zona', 'CP', 'Capital', 'Intereses', 'Cuotas'];
  const rows = resultados.map(r => [
    r.nro_partida || r.id,
    r.titular || '',
    r.titular_dni || '',
    r.titular_domicilio || '',
    r.zona || '',
    r.codigo_postal || '',
    r.monto_capital || 0,
    r.monto_intereses || 0,
    r.cuotas_adeudadas || 0,
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `preview-intimacion-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
                      onClick={() => exportarCSV(resultados)}
                    >
                      Exportar Excel (CSV)
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

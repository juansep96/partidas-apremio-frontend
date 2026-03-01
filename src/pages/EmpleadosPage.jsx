import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import { empleadosApi } from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';
import './CallesPage.css';
import './EmpleadosPage.css';

const STEPS = ['Archivo', 'Analizar', 'Descartar', 'Preview', 'Confirmar'];
const LOG_STATUS_LABELS = { completed: 'Completado', failed: 'Error', pending: 'Pendiente' };
const PER_PAGE_OPTS = [10, 25, 50, 100];

const initialFormData = {
  dni: '',
  legajo: '',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
};

export default function EmpleadosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [empleados, setEmpleados] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filtersInput, setFiltersInput] = useState({ search: '' });
  const [appliedFilters, setAppliedFilters] = useState({ search: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [importSectionOpen, setImportSectionOpen] = useState(false);
  const [importStep, setImportStep] = useState(0);
  const [importFile, setImportFile] = useState(null);
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState([]);

  const loadEmpleados = useCallback(async () => {
    if (!user || user.globalRole !== 'SUPERADMIN') return;
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (appliedFilters.search.trim()) params.search = appliedFilters.search.trim();
      const res = await empleadosApi.list(params);
      setEmpleados(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) {
      sileo.error({ title: 'Error al cargar empleados', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, page, perPage, appliedFilters.search]);

  useEffect(() => {
    if (!user) return;
    if (user.globalRole !== 'SUPERADMIN') {
      navigate('/sistemas', { replace: true });
      return;
    }
    loadEmpleados();
    empleadosApi.logs().then(setLogs).catch(() => setLogs([]));
  }, [user, navigate, loadEmpleados]);

  const applyFilters = () => {
    setAppliedFilters({ ...filtersInput });
    setPage(1);
  };

  const openCreate = () => {
    setFormData({ ...initialFormData });
    setModal('create');
  };

  const openEdit = (e) => {
    setFormData({
      dni: e.dni || '',
      legajo: e.legajo || '',
      nombre: e.nombre || '',
      apellido: e.apellido || '',
      email: e.email || '',
      telefono: e.telefono || '',
    });
    setModal({ type: 'edit', id: e.id });
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        dni: formData.dni.replace(/\D/g, '').trim(),
        legajo: formData.legajo.trim(),
        nombre: formData.nombre.trim() || null,
        apellido: formData.apellido.trim() || null,
        email: formData.email.trim() || null,
        telefono: formData.telefono.trim() || null,
      };
      if (modal === 'create') {
        await empleadosApi.create(payload);
        sileo.success({ title: 'Empleado creado' });
      } else {
        await empleadosApi.update(modal.id, payload);
        sileo.success({ title: 'Empleado actualizado' });
      }
      closeModal();
      loadEmpleados();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
    setDeleting(id);
    try {
      await empleadosApi.delete(id);
      sileo.success({ title: 'Empleado eliminado' });
      loadEmpleados();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setDeleting(null);
    }
  };

  const handleImportFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv' || f.type === 'text/plain')) {
      setImportFile(f);
      setImportAnalysis(null);
      setImportStep(0);
    } else if (f) {
      sileo.error({ title: 'Archivo no válido', description: 'Solo se permiten archivos CSV' });
    }
  };

  const handleImportAnalyze = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', importFile);
      const res = await empleadosApi.analyze(form);
      setImportAnalysis(res);
      setImportStep(1);
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!importAnalysis?.rows?.length) return;
    setImporting(true);
    try {
      await empleadosApi.import({
        file_name: importAnalysis.file_name,
        rows: importAnalysis.rows,
      });
      sileo.success({ title: 'Importación completada', description: `${importAnalysis.rows.length} empleados importados` });
      setImportSectionOpen(false);
      setImportStep(0);
      setImportFile(null);
      setImportAnalysis(null);
      loadEmpleados();
      empleadosApi.logs().then(setLogs).catch(() => {});
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setImportStep(0);
    setImportFile(null);
    setImportAnalysis(null);
  };

  if (!user || user.globalRole !== 'SUPERADMIN') return null;

  return (
    <AppLayout>
      <div className="admin-page empleados-page">
        <header className="admin-hero">
          <div>
            <h1>Empleados municipales</h1>
            <p>Gestión de empleados municipales</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="admin-hero-btn empleados-btn-import"
              onClick={() => setImportSectionOpen((v) => !v)}
            >
              Importar CSV
            </button>
            <button type="button" className="admin-hero-btn" onClick={openCreate}>
              + Nuevo empleado
            </button>
          </div>
        </header>

        <div className="calles-filters-inline">
          <div className="calles-filters-row">
            <input
              type="text"
              value={filtersInput.search}
              onChange={(e) => setFiltersInput((f) => ({ ...f, search: e.target.value }))}
              placeholder="Buscar por DNI, legajo, nombre, apellido, email..."
              className="calles-filter-input"
              style={{ flex: 1, minWidth: '280px' }}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyFilters())}
            />
            <button type="button" className="calles-filter-btn" onClick={applyFilters}>
              Buscar
            </button>
          </div>
        </div>

        <div className="admin-content">
          {loading ? (
            <div className="admin-loading-state">
              <div className="admin-spinner" />
              <p>Cargando empleados...</p>
            </div>
          ) : empleados.length === 0 && !appliedFilters.search.trim() ? (
            <div className="admin-empty-state">
              <p>No hay empleados. Agregá uno nuevo o importá desde CSV.</p>
            </div>
          ) : empleados.length === 0 ? (
            <div className="admin-empty-state">
              <p>No hay empleados que coincidan con la búsqueda</p>
            </div>
          ) : (
            <div className="calles-list-wrap empleados-list-wrap">
              <table className="calles-table empleados-table">
                <thead>
                  <tr>
                    <th>DNI</th>
                    <th>Legajo</th>
                    <th>Apellido</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th className="calles-table-th-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp) => (
                    <tr key={emp.id}>
                      <td>{emp.dni}</td>
                      <td>{emp.legajo}</td>
                      <td>{emp.apellido || '—'}</td>
                      <td>{emp.nombre || '—'}</td>
                      <td>{emp.email || '—'}</td>
                      <td>{emp.telefono || '—'}</td>
                      <td className="calles-table-td-actions">
                        <button type="button" className="calles-table-btn-edit" onClick={() => openEdit(emp)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="empleados-table-btn-delete"
                          onClick={() => setDeleteConfirm(emp)}
                          disabled={deleting === emp.id}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && !loading && (
            <div className="calles-pagination">
              <div className="calles-pagination-nav">
                <button
                  type="button"
                  className="calles-pagination-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </button>
                <span className="calles-pagination-info">
                  Pág. {meta.current_page} de {meta.last_page} ({meta.total} empleados)
                </span>
                <button
                  type="button"
                  className="calles-pagination-btn"
                  disabled={page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
              <div className="calles-pagination-right">
                <label className="calles-per-page">
                  Mostrar
                  <SelectSearchable
                    className="calles-per-page-select"
                    options={PER_PAGE_OPTS.map((n) => ({ value: n, label: String(n) }))}
                    value={perPage}
                    onChange={(v) => {
                      setPerPage(Number(v));
                      setPage(1);
                    }}
                    placeholder="Seleccionar"
                  />
                  por página
                </label>
              </div>
            </div>
          )}
        </div>

        {importSectionOpen && (
          <section className="empleados-import-section">
            <div className="empleados-import-header">
              <h3>Importar desde CSV</h3>
              <button type="button" className="empleados-import-close" onClick={() => setImportSectionOpen(false)}>
                ×
              </button>
            </div>
            <div className="empleados-wizard">
              <div className="empleados-wizard-steps">
                {STEPS.map((label, i) => (
                  <div
                    key={label}
                    className={`empleados-step ${i === importStep ? 'active' : ''} ${i < importStep ? 'done' : ''}`}
                  >
                    <span className="empleados-step-num">{i + 1}</span>
                    <span className="empleados-step-label">{label}</span>
                    {i < STEPS.length - 1 && <span className="empleados-step-line" />}
                  </div>
                ))}
              </div>
              <div className="empleados-wizard-content">
                {importStep === 0 && (
                  <div className="empleados-upload">
                    <label className="empleados-upload-zone">
                      <input type="file" accept=".csv,text/csv,text/plain" onChange={handleImportFileChange} className="empleados-upload-input" />
                      <span className="empleados-upload-text">
                        {importFile ? importFile.name : 'Arrastrá un CSV o hacé clic para seleccionar'}
                      </span>
                      <span className="empleados-upload-hint">Archivos .csv hasta 10 MB</span>
                    </label>
                    <button type="button" className="empleados-btn-primary" onClick={handleImportAnalyze} disabled={!importFile || importing}>
                      {importing ? 'Analizando...' : 'Analizar archivo'}
                    </button>
                  </div>
                )}
                {importStep === 1 && importAnalysis && (
                  <div className="empleados-analyze">
                    <div className="empleados-stats">
                      <div className="empleados-stat">
                        <span className="empleados-stat-value">{importAnalysis.rows_count}</span>
                        <span className="empleados-stat-label">Nuevos en CSV</span>
                      </div>
                      <div className="empleados-stat">
                        <span className="empleados-stat-value">{importAnalysis.existing_count}</span>
                        <span className="empleados-stat-label">Existentes en DB</span>
                      </div>
                    </div>
                    <p className="empleados-warn">La importación reemplazará todos los empleados actuales por los del CSV.</p>
                    <div className="empleados-actions">
                      <button type="button" className="empleados-btn-ghost" onClick={resetImport}>Cancelar</button>
                      <button type="button" className="empleados-btn-primary" onClick={() => setImportStep(2)}>Descartar existentes y continuar</button>
                    </div>
                  </div>
                )}
                {importStep === 2 && importAnalysis && (
                  <div className="empleados-discard">
                    <p className="empleados-discard-text">
                      Se reemplazarán <strong>{importAnalysis.existing_count}</strong> empleados actuales por <strong>{importAnalysis.rows_count}</strong> del CSV. ¿Continuar?
                    </p>
                    <div className="empleados-actions">
                      <button type="button" className="empleados-btn-ghost" onClick={() => setImportStep(1)}>Volver</button>
                      <button type="button" className="empleados-btn-primary" onClick={() => setImportStep(3)}>Sí, descartar y ver preview</button>
                    </div>
                  </div>
                )}
                {importStep === 3 && importAnalysis && (
                  <div className="empleados-preview">
                    <p className="empleados-preview-title">Preview: {importAnalysis.rows.length} empleados a insertar</p>
                    <div className="empleados-table-wrap">
                      <table className="empleados-table">
                        <thead>
                          <tr><th>DNI</th><th>Legajo</th><th>Email</th><th>Teléfono</th></tr>
                        </thead>
                        <tbody>
                          {importAnalysis.rows.slice(0, 20).map((r, i) => (
                            <tr key={i}>
                              <td>{r.dni}</td>
                              <td>{r.legajo}</td>
                              <td>{r.email || '—'}</td>
                              <td>{r.telefono || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importAnalysis.rows.length > 20 && (
                        <p className="empleados-preview-more">... y {importAnalysis.rows.length - 20} más</p>
                      )}
                    </div>
                    <div className="empleados-actions">
                      <button type="button" className="empleados-btn-ghost" onClick={() => setImportStep(2)}>Volver</button>
                      <button type="button" className="empleados-btn-primary" onClick={() => setImportStep(4)}>Continuar</button>
                    </div>
                  </div>
                )}
                {importStep === 4 && importAnalysis && (
                  <div className="empleados-confirm">
                    <p className="empleados-confirm-text">
                      ¿Confirmar importación? Se insertarán <strong>{importAnalysis.rows.length}</strong> empleados.
                    </p>
                    <div className="empleados-actions">
                      <button type="button" className="empleados-btn-ghost" onClick={() => setImportStep(3)}>Volver</button>
                      <button type="button" className="empleados-btn-primary" onClick={handleImport} disabled={importing}>
                        {importing ? 'Importando...' : 'Confirmar e importar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {logs.length > 0 && !importSectionOpen && (
          <section className="empleados-logs">
            <h3>Historial de importaciones</h3>
            <div className="empleados-logs-list">
              {logs.slice(0, 5).map((log) => (
                <div key={log.id} className={`empleados-log-item empleados-log-${log.status}`}>
                  <div className="empleados-log-main">
                    <span className="empleados-log-file">{log.file_name}</span>
                    <span className="empleados-log-status">{LOG_STATUS_LABELS[log.status] || log.status}</span>
                  </div>
                  <div className="empleados-log-meta">
                    {(log.rows_inserted ?? 0)} insertados · {log.user || '—'} · {new Date(log.created_at).toLocaleString('es-AR')}
                  </div>
                  {log.error_message && <p className="empleados-log-error">{log.error_message}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {modal && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <header className="admin-modal-header">
                <h2>{modal === 'create' ? 'Nuevo empleado' : 'Editar empleado'}</h2>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
              </header>
              <form onSubmit={handleSubmit} className="admin-modal-form">
                <section className="admin-form-section">
                  <div className="admin-field-row-2">
                    <div className="admin-field">
                      <label>DNI *</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={formData.dni}
                        onChange={(e) => setFormData((d) => ({ ...d, dni: e.target.value.replace(/\D/g, '').slice(0, 20) }))}
                        placeholder="7 u 8 dígitos"
                        required
                      />
                    </div>
                    <div className="admin-field">
                      <label>Legajo *</label>
                      <input value={formData.legajo} onChange={(e) => setFormData((d) => ({ ...d, legajo: e.target.value }))} placeholder="Ej: 12345" required />
                    </div>
                  </div>
                  <div className="admin-field-row-2">
                    <div className="admin-field">
                      <label>Apellido</label>
                      <input value={formData.apellido} onChange={(e) => setFormData((d) => ({ ...d, apellido: e.target.value }))} placeholder="Pérez" />
                    </div>
                    <div className="admin-field">
                      <label>Nombre</label>
                      <input value={formData.nombre} onChange={(e) => setFormData((d) => ({ ...d, nombre: e.target.value }))} placeholder="Juan" />
                    </div>
                  </div>
                  <div className="admin-field-row-2">
                    <div className="admin-field">
                      <label>Email</label>
                      <input type="email" value={formData.email} onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))} placeholder="email@ejemplo.com" />
                    </div>
                    <div className="admin-field">
                      <label>Teléfono</label>
                      <input value={formData.telefono} onChange={(e) => setFormData((d) => ({ ...d, telefono: e.target.value }))} placeholder="Ej: 291 1234567" />
                    </div>
                  </div>
                </section>
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : modal === 'create' ? 'Crear' : 'Guardar'}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}

        {deleteConfirm && (
          <div className="admin-modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="admin-modal admin-modal--narrow" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <header className="admin-modal-header">
                <h2>Eliminar empleado</h2>
                <button type="button" className="admin-modal-close" onClick={() => setDeleteConfirm(null)} aria-label="Cerrar">×</button>
              </header>
              <div className="admin-modal-form" style={{ padding: '1.25rem' }}>
                <p>
                  ¿Eliminar a <strong>
                    {deleteConfirm.apellido || deleteConfirm.nombre
                      ? [deleteConfirm.apellido, deleteConfirm.nombre].filter(Boolean).join(', ')
                      : `DNI ${deleteConfirm.dni}`}
                  </strong>?
                </p>
                <footer className="admin-modal-footer" style={{ marginTop: '1.5rem', marginBottom: 0 }}>
                  <button type="button" className="admin-btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
                  <button type="button" className="admin-btn-primary admin-btn-danger" onClick={handleDeleteConfirm} disabled={deleting}>
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </footer>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

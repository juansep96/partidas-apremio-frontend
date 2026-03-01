import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import { barriosApi, dsApi } from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';
import './CallesPage.css';

const LOCALIDADES = [
  { value: '', label: 'Todas' },
  { value: 'MONTE_HERMOSO', label: 'Monte Hermoso' },
  { value: 'SAUCE_GRANDE', label: 'Sauce Grande' },
];

const PER_PAGE_OPTS = [10, 25, 50, 100];

const initialFormData = {
  nombre: '',
  localidad: 'MONTE_HERMOSO',
};

export default function BarriosPage({ desarrolloSocial = false }) {
  const { user, systems } = useAuth();
  const navigate = useNavigate();
  const desarrolloSocialSystem = systems?.find((s) => s.modules?.some((m) => m.route === '/desarrollo-social/encuestas'));
  const isDsAdmin = user?.globalRole === 'SUPERADMIN' || desarrolloSocialSystem?.role === 'ADMIN';
  const api = desarrolloSocial ? dsApi.barrios : barriosApi;
  const canAccess = desarrolloSocial ? isDsAdmin : user?.globalRole === 'SUPERADMIN';
  const [barrios, setBarrios] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersInput, setFiltersInput] = useState({ localidad: '', search: '' });
  const [appliedFilters, setAppliedFilters] = useState({ localidad: '', search: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const loadBarrios = useCallback(async () => {
    if (!user || !canAccess) return;
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (appliedFilters.localidad) params.localidad = appliedFilters.localidad;
      if (appliedFilters.search.trim()) params.search = appliedFilters.search.trim();
      const res = await api.list(params);
      setBarrios(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) {
      sileo.error({ title: 'Error al cargar barrios', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, canAccess, api, page, perPage, appliedFilters.localidad, appliedFilters.search]);

  useEffect(() => {
    if (!user) return;
    if (!canAccess) {
      navigate(desarrolloSocial ? '/desarrollo-social' : '/sistemas', { replace: true });
      return;
    }
    loadBarrios();
  }, [user, canAccess, navigate, loadBarrios]);

  const applyFilters = () => {
    setAppliedFilters({ ...filtersInput });
    setPage(1);
  };

  const openCreate = () => {
    setFormData({ ...initialFormData });
    setModal('create');
  };

  const openEdit = (b) => {
    setFormData({ nombre: b.nombre, localidad: b.localidad });
    setModal({ type: 'edit', id: b.id });
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.create({
          nombre: formData.nombre.trim(),
          localidad: formData.localidad,
        });
        sileo.success({ title: 'Barrio creado' });
      } else {
        await api.update(modal.id, { nombre: formData.nombre.trim() });
        sileo.success({ title: 'Barrio actualizado' });
      }
      closeModal();
      loadBarrios();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (appliedFilters.localidad) params.localidad = appliedFilters.localidad;
      if (appliedFilters.search.trim()) params.search = appliedFilters.search.trim();
      await api.export(params);
      sileo.success({ title: 'Exportado', description: 'Se descargó barrios.csv' });
    } catch (err) {
      sileo.error({ title: 'Error al exportar', description: err.message });
    } finally {
      setExporting(false);
    }
  };

  if (!user || !canAccess) return null;

  return (
    <AppLayout>
      <div className="admin-page calles-page">
        <header className="admin-hero">
          <div>
            <h1>Barrios</h1>
            <p>Gestión de barrios por localidad (Monte Hermoso y Sauce Grande)</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="admin-hero-btn" onClick={openCreate}>
              + Nuevo barrio
            </button>
          </div>
        </header>

        <div className="calles-filters-inline">
          <div className="calles-filters-row">
            <SelectSearchable
              options={LOCALIDADES}
              value={filtersInput.localidad}
              onChange={(v) => setFiltersInput((f) => ({ ...f, localidad: v }))}
              className="calles-filter-select"
              placeholder="Buscar localidad..."
            />
            <input
              type="text"
              value={filtersInput.search}
              onChange={(e) => setFiltersInput((f) => ({ ...f, search: e.target.value }))}
              placeholder="Nombre del barrio"
              className="calles-filter-input"
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
              <p>Cargando barrios...</p>
            </div>
          ) : barrios.length === 0 ? (
            <div className="admin-empty-state">
              <p>No hay barrios. Creá uno nuevo.</p>
            </div>
          ) : (
            <div className="calles-list-wrap">
              <table className="calles-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Localidad</th>
                    <th className="calles-table-th-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {barrios.map((b) => (
                    <tr key={b.id}>
                      <td>{b.nombre}</td>
                      <td>{b.localidadLabel || b.localidad}</td>
                      <td className="calles-table-td-actions">
                        <button type="button" className="calles-table-btn-edit" onClick={() => openEdit(b)}>
                          Editar
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
                  Pág. {meta.current_page} de {meta.last_page} ({meta.total} barrios)
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
                <button
                  type="button"
                  className="calles-export-btn"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? 'Exportando...' : 'Exportar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {modal && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div
              className="admin-modal admin-modal--narrow"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <header className="admin-modal-header">
                <h2>{modal === 'create' ? 'Nuevo barrio' : 'Editar barrio'}</h2>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Cerrar">
                  ×
                </button>
              </header>
              <form onSubmit={handleSubmit} className="admin-modal-form">
                <section className="admin-form-section">
                  <div className="admin-field">
                    <label>Nombre del barrio *</label>
                    <input
                      value={formData.nombre}
                      onChange={(e) => setFormData((d) => ({ ...d, nombre: e.target.value }))}
                      placeholder="Ej: Centro, Costanera"
                      required
                    />
                  </div>
                  {modal === 'create' && (
                    <div className="admin-field">
                      <label>Localidad *</label>
                      <SelectSearchable
                        options={[
                          { value: 'MONTE_HERMOSO', label: 'Monte Hermoso' },
                          { value: 'SAUCE_GRANDE', label: 'Sauce Grande' },
                        ]}
                        value={formData.localidad}
                        onChange={(v) => setFormData((d) => ({ ...d, localidad: v }))}
                        required
                        placeholder="Buscar localidad..."
                      />
                    </div>
                  )}
                  {modal !== 'create' && (
                    <div className="admin-field">
                      <label>Localidad</label>
                      <p className="calles-edit-localidad">{formData.localidad === 'MONTE_HERMOSO' ? 'Monte Hermoso' : 'Sauce Grande'}</p>
                    </div>
                  )}
                </section>
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={closeModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : modal === 'create' ? 'Crear' : 'Guardar'}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

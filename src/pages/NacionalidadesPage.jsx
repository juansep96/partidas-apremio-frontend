import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import { nacionalidadesApi, dsApi } from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';
import './CallesPage.css';

const PER_PAGE_OPTS = [10, 25, 50, 100];

const initialFormData = { nombre: '' };

export default function NacionalidadesPage({ desarrolloSocial = false }) {
  const { user, systems } = useAuth();
  const navigate = useNavigate();
  const desarrolloSocialSystem = systems?.find((s) => s.modules?.some((m) => m.route === '/desarrollo-social/encuestas'));
  const isDsAdmin = user?.globalRole === 'SUPERADMIN' || desarrolloSocialSystem?.role === 'ADMIN';
  const api = desarrolloSocial ? dsApi.nacionalidades : nacionalidadesApi;
  const canAccess = desarrolloSocial ? isDsAdmin : user?.globalRole === 'SUPERADMIN';
  const [nacionalidades, setNacionalidades] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const loadNacionalidades = useCallback(async () => {
    if (!user || !canAccess) return;
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (appliedSearch.trim()) params.search = appliedSearch.trim();
      const res = await api.list(params);
      setNacionalidades(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) {
      sileo.error({ title: 'Error al cargar nacionalidades', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, page, perPage, appliedSearch]);

  useEffect(() => {
    if (!user) return;
    if (!canAccess) {
      navigate(desarrolloSocial ? '/desarrollo-social' : '/sistemas', { replace: true });
      return;
    }
    loadNacionalidades();
  }, [user, navigate, loadNacionalidades]);

  const applyFilters = () => {
    setAppliedSearch(searchInput);
    setPage(1);
  };

  const openCreate = () => {
    setFormData({ ...initialFormData });
    setModal('create');
  };

  const openEdit = (n) => {
    setFormData({ nombre: n.nombre });
    setModal({ type: 'edit', id: n.id });
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { nombre: formData.nombre.trim() };
      if (modal === 'create') {
        await api.create(payload);
        sileo.success({ title: 'Nacionalidad creada' });
      } else {
        await api.update(modal.id, payload);
        sileo.success({ title: 'Nacionalidad actualizada' });
      }
      closeModal();
      loadNacionalidades();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!user || !canAccess) return null;

  return (
    <AppLayout>
      <div className="admin-page calles-page">
        <header className="admin-hero">
          <div>
            <h1>Nacionalidades</h1>
            <p>Gestión de nacionalidades</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="admin-hero-btn" onClick={openCreate}>
              + Nueva nacionalidad
            </button>
          </div>
        </header>

        <div className="calles-filters-inline">
          <div className="calles-filters-row">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre"
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
              <p>Cargando nacionalidades...</p>
            </div>
          ) : nacionalidades.length === 0 ? (
            <div className="admin-empty-state">
              <p>No hay nacionalidades.</p>
            </div>
          ) : (
            <div className="calles-list-wrap">
              <table className="calles-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th className="calles-table-th-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {nacionalidades.map((n) => (
                    <tr key={n.id}>
                      <td>{n.nombre}</td>
                      <td className="calles-table-td-actions">
                        <button type="button" className="calles-table-btn-edit" onClick={() => openEdit(n)}>
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
                  Pág. {meta.current_page} de {meta.last_page} ({meta.total} nacionalidades)
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

        {modal && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div
              className="admin-modal admin-modal--narrow"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <header className="admin-modal-header">
                <h2>{modal === 'create' ? 'Nueva nacionalidad' : 'Editar nacionalidad'}</h2>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Cerrar">
                  ×
                </button>
              </header>
              <form onSubmit={handleSubmit} className="admin-modal-form">
                <section className="admin-form-section">
                  <div className="admin-field">
                    <label>Nombre *</label>
                    <input
                      value={formData.nombre}
                      onChange={(e) => setFormData((d) => ({ ...d, nombre: e.target.value }))}
                      placeholder="Ej: Argentina"
                      required
                    />
                  </div>
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

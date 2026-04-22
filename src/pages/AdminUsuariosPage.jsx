import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import { usersApi } from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';

const initialFormData = {
  userType: null, // 'EMPLOYEE' | 'EXTERNAL'
  dniSearch: '', // solo para paso búsqueda empleado
  empleadoFound: null, // { dni, legajo, email, telefono } cuando se encuentra
  dni: '',
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  avatar: '',
  botname: '',
  legajo: '',
  globalRole: null,
  systemRoles: [{ systemId: '', role: 'USER', moduleIds: [] }],
};

const initialFilters = {
  dni: '',
  firstName: '',
  lastName: '',
  email: '',
  systemId: '',
  moduleId: '',
  globalRole: '',
};

export default function AdminUsuariosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [systems, setSystems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState(null);

  const loadUsers = useCallback(async () => {
    if (!user || user.globalRole !== 'SUPERADMIN') return;
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: 12 };
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v.trim()) params[k] = v.trim();
      });
      const res = await usersApi.list(params);
      setUsers(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) {
      setError(err.message);
      sileo.error({ title: 'Error al cargar usuarios', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, page, filters]);

  useEffect(() => {
    if (!user) return;
    if (user.globalRole !== 'SUPERADMIN') {
      navigate('/sistemas', { replace: true });
      return;
    }
    loadUsers();
  }, [user, navigate, loadUsers]);

  useEffect(() => {
    if (user?.globalRole === 'SUPERADMIN') {
      usersApi.getSystems().then(setSystems).catch(() => setSystems([]));
    }
  }, [user?.globalRole]);

  const applyFilters = () => {
    setPage(1);
    loadUsers();
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const openCreate = () => {
    setFormData({ ...initialFormData });
    setModal('create');
  };

  const openEdit = async (u) => {
    try {
      const full = await usersApi.get(u.id);
      setFormData({
        userType: null,
        dniSearch: '',
        empleadoFound: null,
        dni: full.dni || '',
        firstName: full.firstName || '',
        lastName: full.lastName || '',
        phone: full.phone || '',
        email: full.email || '',
        avatar: full.avatar || '',
        botname: full.botname || '',
        legajo: full.legajo || '',
        globalRole: full.globalRole || null,
        systemRoles: (full.systemRoles || []).length
          ? full.systemRoles.map((r) => ({
              systemId: r.systemId,
              role: r.role,
              moduleIds: r.moduleIds || [],
            }))
          : [{ systemId: '', role: 'USER', moduleIds: [] }],
      });
      setModal({ id: u.id });
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  const closeModal = () => {
    setModal(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        avatar: formData.avatar?.trim() || null,
        botname: formData.botname?.trim() || null,
        legajo: formData.legajo?.trim() || null,
        globalRole: formData.globalRole || null,
        systemRoles: formData.globalRole
          ? []
          : formData.systemRoles
              .filter((r) => r.systemId)
              .map((r) => ({
                systemId: r.systemId,
                role: r.role,
                moduleIds: (r.moduleIds || []).filter(Boolean),
              })),
      };
      if (modal === 'create') {
        payload.dni = formData.dni.replace(/\D/g, '').slice(0, 8);
        await usersApi.create(payload);
        sileo.success({ title: 'Usuario creado' });
      } else {
        await usersApi.update(modal.id, payload);
        sileo.success({ title: 'Usuario actualizado' });
      }
      closeModal();
      loadUsers();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const [searchingEmpleado, setSearchingEmpleado] = useState(false);

  const handleSearchEmpleado = async () => {
    const dni = formData.dniSearch.replace(/\D/g, '').slice(0, 8);
    if (dni.length < 7) {
      sileo.error({ title: 'DNI inválido', description: 'El DNI debe tener 7 u 8 dígitos' });
      return;
    }
    setSearchingEmpleado(true);
    try {
      const res = { empleado: null };
      if (res?.empleado) {
        const emp = res.empleado;
        setFormData((d) => ({
          ...d,
          empleadoFound: emp,
          dni: emp.dni,
          legajo: emp.legajo || '',
          firstName: emp.nombre || '',
          lastName: emp.apellido || '',
          email: emp.email || '',
          phone: emp.telefono || '',
        }));
        sileo.success({ title: 'Empleado encontrado', description: 'Datos precargados correctamente' });
      }
    } catch (err) {
      sileo.error({ title: 'No encontrado', description: err.message });
    } finally {
      setSearchingEmpleado(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleDeleteClick = (u) => {
    setDeleteConfirm(u);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const u = deleteConfirm;
    setDeleteConfirm(null);
    setDeleting(u.id);
    try {
      await usersApi.delete(u.id);
      sileo.success({ title: 'Usuario eliminado' });
      loadUsers();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const addSystemRole = () => {
    setFormData((d) => ({
      ...d,
      systemRoles: [...d.systemRoles, { systemId: '', role: 'USER', moduleIds: [] }],
    }));
  };

  const updateSystemRole = (idx, field, value) => {
    setFormData((d) => {
      const next = d.systemRoles.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        if (field === 'systemId') updated.moduleIds = [];
        return updated;
      });
      return { ...d, systemRoles: next };
    });
  };

  const toggleModuleForRole = (idx, moduleId) => {
    setFormData((d) => {
      const r = d.systemRoles[idx];
      const mods = r.moduleIds || [];
      const next = mods.includes(moduleId)
        ? mods.filter((id) => id !== moduleId)
        : [...mods, moduleId];
      return {
        ...d,
        systemRoles: d.systemRoles.map((sr, i) => (i === idx ? { ...sr, moduleIds: next } : sr)),
      };
    });
  };

  const removeSystemRole = (idx) => {
    setFormData((d) => ({
      ...d,
      systemRoles: d.systemRoles.filter((_, i) => i !== idx),
    }));
  };

  const allModules = systems.flatMap((s) => (s.modules || []).map((m) => ({ ...m, systemName: s.name })));

  if (!user) return null;
  if (user.globalRole !== 'SUPERADMIN') return null;

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-hero">
          <div>
            <h1>Usuarios</h1>
            <p>Gestión de acceso y permisos</p>
          </div>
          <button type="button" className="admin-hero-btn" onClick={openCreate}>
            <span className="admin-hero-btn-icon">+</span>
            Nuevo usuario
          </button>
        </header>

        <div className="admin-filters-bar">
          <div className="admin-filters-panel">
            <div className="admin-filters-header">
              <span className="admin-filters-title">Filtros</span>
              <div className="admin-filters-btns">
                <button type="button" className="admin-filters-clear" onClick={clearFilters}>
                  Limpiar
                </button>
                <button type="button" className="admin-filters-apply" onClick={applyFilters}>
                  Filtrar
                </button>
              </div>
            </div>
            <div className="admin-filters-grid">
              <div className="admin-filter-field">
                <label>DNI</label>
                <input
                  placeholder="Buscar por DNI"
                  value={filters.dni}
                  onChange={(e) => setFilters((f) => ({ ...f, dni: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
              <div className="admin-filter-field">
                <label>Nombre</label>
                <input
                  placeholder="Nombre"
                  value={filters.firstName}
                  onChange={(e) => setFilters((f) => ({ ...f, firstName: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
              <div className="admin-filter-field">
                <label>Apellido</label>
                <input
                  placeholder="Apellido"
                  value={filters.lastName}
                  onChange={(e) => setFilters((f) => ({ ...f, lastName: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>
             
              <div className="admin-filter-field">
                <label>Sistema</label>
                <SelectSearchable
                  options={[
                    { value: '', label: 'Todos' },
                    ...systems.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value={filters.systemId}
                  onChange={(v) => setFilters((f) => ({ ...f, systemId: v }))}
                  placeholder="Buscar sistema..."
                />
              </div>
              <div className="admin-filter-field">
                <label>Módulo</label>
                <SelectSearchable
                  options={[
                    { value: '', label: 'Todos' },
                    ...allModules.map((m) => ({ value: m.id, label: `${m.systemName} › ${m.name}` })),
                  ]}
                  value={filters.moduleId}
                  onChange={(v) => setFilters((f) => ({ ...f, moduleId: v }))}
                  placeholder="Buscar módulo..."
                />
              </div>
              <div className="admin-filter-field">
                <label>Rol</label>
                <SelectSearchable
                  options={[
                    { value: '', label: 'Cualquiera' },
                    { value: 'SUPERADMIN', label: 'Superadmin' },
                    { value: 'USER', label: 'Usuario' },
                  ]}
                  value={filters.globalRole}
                  onChange={(v) => setFilters((f) => ({ ...f, globalRole: v }))}
                  placeholder="Buscar rol..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="admin-content">
          {loading ? (
            <div className="admin-loading-state">
              <div className="admin-spinner" />
              <p>Cargando usuarios...</p>
            </div>
          ) : error ? (
            <div className="admin-error-state">
              <p>{error}</p>
              <button type="button" className="admin-btn-primary" onClick={loadUsers}>
                Reintentar
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="admin-empty-state">
              <p>No hay usuarios que coincidan con los filtros</p>
              <button type="button" className="admin-btn-ghost" onClick={clearFilters}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="admin-cards">
              {users.map((u) => (
                <article key={u.id} className="admin-user-card">
                  <div className="admin-user-card-header">
                    <div className="admin-user-avatar">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" />
                      ) : (
                        <span>{(u.firstName?.[0] || u.lastName?.[0] || '?').toUpperCase()}</span>
                      )}
                    </div>
                    <div className="admin-user-card-meta">
                      <strong>{u.lastName}, {u.firstName}</strong>
                      <span className="admin-user-dni">{u.dni}</span>
                    </div>
                  </div>
                  <div className="admin-user-card-body">
                    {u.email && <p className="admin-user-email">{u.email}</p>}
                    <div className="admin-user-roles">
                      {u.globalRole === 'SUPERADMIN' ? (
                        <span className="admin-tag admin-tag-super">Superadmin</span>
                      ) : (
                        (u.systemRoles || []).map((r, i) => (
                          <span key={i} className="admin-tag">
                            {r.systemName} ({r.role})
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="admin-user-card-actions">
                    <button type="button" className="admin-card-btn" onClick={() => openEdit(u)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="admin-card-btn admin-card-btn-danger"
                      onClick={() => handleDeleteClick(u)}
                      disabled={deleting === u.id || u.id === user?.id}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {meta && meta.last_page > 1 && !loading && (
          <div className="admin-pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </button>
            <span>
              Pág. {meta.current_page} de {meta.last_page} ({meta.total} usuarios)
            </span>
            <button
              type="button"
              disabled={page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        )}

        {deleteConfirm &&
          createPortal(
            <div className="admin-delete-overlay" onClick={handleDeleteCancel}>
              <div
                className="admin-delete-modal"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-labelledby="delete-title"
                aria-describedby="delete-desc"
                aria-modal="true"
              >
                <h3 id="delete-title" className="admin-delete-title">
                  ¿Eliminar a {deleteConfirm.firstName} {deleteConfirm.lastName}?
                </h3>
                <p id="delete-desc" className="admin-delete-desc">
                  Esta acción no se puede deshacer.
                </p>
                <div className="admin-delete-actions">
                  <button type="button" className="admin-delete-cancel" onClick={handleDeleteCancel}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="admin-delete-confirm"
                    onClick={handleDeleteConfirm}
                    disabled={deleting === deleteConfirm.id}
                  >
                    {deleting === deleteConfirm.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {modal && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div
              className={`admin-modal ${modal === 'create' && (!formData.userType || (formData.userType === 'EMPLOYEE' && !formData.empleadoFound)) ? 'admin-modal--compact' : ''}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="modal-title"
              aria-modal="true"
            >
              <header className="admin-modal-header">
                <h2 id="modal-title">
                  {modal === 'create' && !formData.userType
                    ? 'Nuevo usuario'
                    : modal === 'create' && formData.userType === 'EMPLOYEE' && !formData.empleadoFound
                      ? 'Empleado Municipal - Buscar por DNI'
                      : modal === 'create'
                        ? `Nuevo usuario - ${formData.userType === 'EMPLOYEE' ? 'Empleado Municipal' : 'Usuario Externo'}`
                        : 'Editar usuario'}
                </h2>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Cerrar">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M2 2l10 10M12 2L2 12" />
                  </svg>
                </button>
              </header>

              {modal === 'create' && !formData.userType ? (
                <div className="admin-modal-type-select">
                  <div className="admin-type-options">
                    <button
                      type="button"
                      className="admin-type-option"
                      onClick={() => setFormData((d) => ({ ...d, userType: 'EMPLOYEE' }))}
                    >
                      <span className="admin-type-option-icon">👤</span>
                      <span className="admin-type-option-label">Empleado Municipal</span>
                    </button>
                    <button
                      type="button"
                      className="admin-type-option"
                      onClick={() => setFormData((d) => ({ ...d, userType: 'EXTERNAL' }))}
                    >
                      <span className="admin-type-option-icon">🏠</span>
                      <span className="admin-type-option-label">Usuario Externo</span>
                    </button>
                  </div>
                </div>
              ) : modal === 'create' && formData.userType === 'EMPLOYEE' && !formData.empleadoFound ? (
                <div className="admin-modal-empleado-search">
                  <p className="admin-section-hint">
                    Buscá en la base de empleados municipales ingresando el DNI (7 u 8 dígitos).
                  </p>
                  <div className="admin-field">
                    <label>DNI</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={formData.dniSearch}
                      onChange={(e) =>
                        setFormData((d) => ({ ...d, dniSearch: e.target.value.replace(/\D/g, '').slice(0, 8) }))
                      }
                      placeholder="7 u 8 dígitos"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchEmpleado()}
                    />
                  </div>
                  <div className="admin-modal-footer">
                    <button type="button" className="admin-btn-ghost" onClick={() => setFormData((d) => ({ ...d, userType: null }))}>
                      Volver
                    </button>
                    <button
                      type="button"
                      className="admin-btn-primary"
                      onClick={handleSearchEmpleado}
                      disabled={searchingEmpleado || formData.dniSearch.replace(/\D/g, '').length < 7}
                    >
                      {searchingEmpleado ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                </div>
              ) : modal === 'create' && formData.userType === 'EMPLOYEE' && formData.empleadoFound ? (
                <form onSubmit={handleSubmit} className="admin-modal-form admin-modal-form-two-col">
                  <div className="admin-empleado-found-banner">
                    <span className="admin-empleado-found-icon">✓</span>
                    <div>
                      <strong>Empleado encontrado</strong>
                      <p>DNI {formData.dni} · Legajo {formData.legajo} · {formData.email || 'Sin email'} · {formData.phone || 'Sin teléfono'}</p>
                    </div>
                  </div>
                  <div className="admin-modal-two-col">
                    <div className="admin-modal-col-datos">
                      <section className="admin-form-section">
                        <h3>Datos personales</h3>
                        <div className="admin-field-row-2">
                          <div className="admin-field">
                            <label>Apellido *</label>
                            <input value={formData.lastName} onChange={(e) => setFormData((d) => ({ ...d, lastName: e.target.value }))} placeholder="Pérez" required />
                          </div>
                          <div className="admin-field">
                            <label>Nombre *</label>
                            <input value={formData.firstName} onChange={(e) => setFormData((d) => ({ ...d, firstName: e.target.value }))} placeholder="Juan" required />
                          </div>
                        </div>
                      </section>
                      <section className="admin-form-section">
                        <h3>Contacto</h3>
                        <div className="admin-field-row-2">
                          <div className="admin-field">
                            <label>Email</label>
                            <input type="email" value={formData.email} onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))} placeholder="email@ejemplo.com" />
                          </div>
                          <div className="admin-field">
                            <label>Teléfono</label>
                            <input type="tel" value={formData.phone} onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))} placeholder="291 1234567 (sin 0 ni 15)" />
                          </div>
                        </div>
                      </section>
                    </div>
                    <div className="admin-modal-col-permisos">
                      <section className="admin-form-section">
                        <h3>Identidad y acceso</h3>
                        <div className="admin-superadmin-card">
                          <div className="admin-superadmin-info">
                            <span className="admin-superadmin-title">Superadmin</span>
                            <span className="admin-superadmin-desc">Acceso total a todos los sistemas</span>
                          </div>
                          <label className="admin-superadmin-toggle">
                            <input
                              type="checkbox"
                              checked={formData.globalRole === 'SUPERADMIN'}
                              onChange={(e) =>
                                setFormData((d) => ({
                                  ...d,
                                  globalRole: e.target.checked ? 'SUPERADMIN' : null,
                                  systemRoles: e.target.checked
                                    ? []
                                    : d.systemRoles.length
                                      ? d.systemRoles
                                      : [{ systemId: '', role: 'USER', moduleIds: [] }],
                                }))
                              }
                            />
                            <span className="admin-superadmin-slider" />
                          </label>
                        </div>
                      </section>
                      {!formData.globalRole && (
                        <section className="admin-form-section admin-form-section-access">
                          <h3>Sistemas y roles</h3>
                          <p className="admin-section-hint">Asigná al menos un sistema. Si tiene módulos, elegí cuáles tendrá acceso.</p>
                      {formData.systemRoles.map((sr, idx) => {
                        const sys = systems.find((s) => s.id === sr.systemId);
                        const hasModules = sys?.modules?.length > 0;
                        return (
                          <div key={idx} className="admin-system-row admin-system-row-extended">
                            <SelectSearchable
                              options={[
                                { value: '', label: 'Elegir sistema' },
                                ...systems.map((s) => ({ value: s.id, label: s.name })),
                              ]}
                              value={sr.systemId}
                              onChange={(v) => updateSystemRole(idx, 'systemId', v)}
                              required={!formData.globalRole}
                              placeholder="Buscar sistema..."
                            />
                            <SelectSearchable
                              options={[
                                { value: 'USER', label: 'Usuario' },
                                { value: 'ADMIN', label: 'Administrador' },
                              ]}
                              value={sr.role}
                              onChange={(v) => updateSystemRole(idx, 'role', v)}
                              placeholder="Rol"
                            />
                            {hasModules && (
                              <div className="admin-module-checkboxes">
                                {(sys.modules || []).map((m) => (
                                  <label key={m.id} className="admin-module-check">
                                    <input
                                      type="checkbox"
                                      checked={(sr.moduleIds || []).includes(m.id)}
                                      onChange={() => toggleModuleForRole(idx, m.id)}
                                    />
                                    {m.name}
                                  </label>
                                ))}
                              </div>
                            )}
                            <button type="button" className="admin-remove-row" onClick={() => removeSystemRole(idx)} title="Quitar">✕</button>
                          </div>
                        );
                      })}
                      <button type="button" className="admin-add-system" onClick={addSystemRole}>+ Agregar otro sistema</button>
                        </section>
                      )}
                    </div>
                  </div>
                  <footer className="admin-modal-footer">
                    <button type="button" className="admin-btn-ghost" onClick={() => setFormData((d) => ({ ...d, empleadoFound: null, dniSearch: '' }))}>
                      Buscar otro DNI
                    </button>
                    <button type="button" className="admin-btn-ghost" onClick={closeModal}>Cancelar</button>
                    <button type="submit" className="admin-btn-primary" disabled={saving}>
                      {saving ? 'Guardando...' : 'Crear usuario'}
                    </button>
                  </footer>
                </form>
              ) : (
              <form onSubmit={handleSubmit} className="admin-modal-form admin-modal-form-two-col">
                <div className="admin-modal-two-col">
                  <div className="admin-modal-col-datos">
                    <section className="admin-form-section">
                      <h3>Datos personales</h3>
                      {modal === 'create' && (
                        <div className="admin-field">
                          <label>DNI (7 u 8 dígitos) *</label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={formData.dni}
                            onChange={(e) =>
                              setFormData((d) => ({ ...d, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))
                            }
                            placeholder="Ej: 12345678"
                            required
                          />
                        </div>
                      )}
                      <div className="admin-field-row-2">
                        <div className="admin-field">
                          <label>Apellido *</label>
                          <input
                            value={formData.lastName}
                            onChange={(e) => setFormData((d) => ({ ...d, lastName: e.target.value }))}
                            placeholder="Pérez"
                            required
                          />
                        </div>
                        <div className="admin-field">
                          <label>Nombre *</label>
                          <input
                            value={formData.firstName}
                            onChange={(e) => setFormData((d) => ({ ...d, firstName: e.target.value }))}
                            placeholder="Juan"
                            required
                          />
                        </div>
                      </div>
                      {modal !== 'create' && (
                        <div className="admin-field">
                          <label>Legajo</label>
                          <input
                            value={formData.legajo}
                            onChange={(e) => setFormData((d) => ({ ...d, legajo: e.target.value }))}
                            placeholder="Opcional"
                          />
                        </div>
                      )}
                    </section>

                    <section className="admin-form-section">
                      <h3>Contacto</h3>
                      <div className="admin-field">
                        <label>Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                          placeholder="email@ejemplo.com"
                        />
                      </div>
                      <div className="admin-field">
                        <label>Teléfono</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                          placeholder="291 1234567 (sin 0 ni 15)"
                        />
                      </div>
                    </section>

                    <section className="admin-form-section">
                      <h3>Otros</h3>
                      <div className="admin-field">
                        <label>Apodo (para el asistente)</label>
                        <input
                          value={formData.botname}
                          onChange={(e) => setFormData((d) => ({ ...d, botname: e.target.value }))}
                          placeholder="Por defecto usa el nombre"
                        />
                      </div>
                      <div className="admin-field">
                        <label>URL de avatar</label>
                        <input
                          value={formData.avatar}
                          onChange={(e) => setFormData((d) => ({ ...d, avatar: e.target.value }))}
                          placeholder="https://..."
                        />
                      </div>
                    </section>
                  </div>

                  <div className="admin-modal-col-permisos">
                    <section className="admin-form-section">
                      <h3>Identidad y acceso</h3>
                      <div className="admin-superadmin-card">
                        <div className="admin-superadmin-info">
                          <span className="admin-superadmin-title">Superadmin</span>
                          <span className="admin-superadmin-desc">Acceso total a todos los sistemas</span>
                        </div>
                        <label className="admin-superadmin-toggle">
                          <input
                            type="checkbox"
                            checked={formData.globalRole === 'SUPERADMIN'}
                            onChange={(e) =>
                              setFormData((d) => ({
                                ...d,
                                globalRole: e.target.checked ? 'SUPERADMIN' : null,
                                systemRoles: e.target.checked
                                  ? []
                                  : d.systemRoles.length
                                    ? d.systemRoles
                                    : [{ systemId: '', role: 'USER', moduleIds: [] }],
                              }))
                            }
                          />
                          <span className="admin-superadmin-slider" />
                        </label>
                      </div>
                    </section>

                    {!formData.globalRole && (
                      <section className="admin-form-section admin-form-section-access">
                        <h3>Sistemas y roles</h3>
                        <p className="admin-section-hint">Asigná al menos un sistema. Si tiene módulos, elegí cuáles tendrá acceso.</p>
                    {formData.systemRoles.map((sr, idx) => {
                      const sys = systems.find((s) => s.id === sr.systemId);
                      const hasModules = sys?.modules?.length > 0;
                      return (
                        <div key={idx} className="admin-system-row admin-system-row-extended">
                          <SelectSearchable
                            options={[
                              { value: '', label: 'Elegir sistema' },
                              ...systems.map((s) => ({ value: s.id, label: s.name })),
                            ]}
                            value={sr.systemId}
                            onChange={(v) => updateSystemRole(idx, 'systemId', v)}
                            required={!formData.globalRole}
                            placeholder="Buscar sistema..."
                          />
                          <SelectSearchable
                            options={[
                              { value: 'USER', label: 'Usuario' },
                              { value: 'ADMIN', label: 'Administrador' },
                            ]}
                            value={sr.role}
                            onChange={(v) => updateSystemRole(idx, 'role', v)}
                            placeholder="Rol"
                          />
                          {hasModules && (
                            <div className="admin-module-checkboxes">
                              {(sys.modules || []).map((m) => (
                                <label key={m.id} className="admin-module-check">
                                  <input
                                    type="checkbox"
                                    checked={(sr.moduleIds || []).includes(m.id)}
                                    onChange={() => toggleModuleForRole(idx, m.id)}
                                  />
                                  {m.name}
                                </label>
                              ))}
                            </div>
                          )}
                          <button type="button" className="admin-remove-row" onClick={() => removeSystemRole(idx)} title="Quitar">✕</button>
                        </div>
                      );
                    })}
                    <button type="button" className="admin-add-system" onClick={addSystemRole}>+ Agregar otro sistema</button>
                      </section>
                    )}
                  </div>
                </div>

                <footer className="admin-modal-footer">
                  {modal === 'create' && (
                    <button
                      type="button"
                      className="admin-btn-ghost"
                      onClick={() => setFormData((d) => ({ ...d, userType: null }))}
                    >
                      Volver
                    </button>
                  )}
                  <button type="button" className="admin-btn-ghost" onClick={closeModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : modal === 'create' ? 'Crear usuario' : 'Guardar cambios'}
                  </button>
                </footer>
              </form>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

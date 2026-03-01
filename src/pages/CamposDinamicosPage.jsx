import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import { camposDinamicosApi, dsApi } from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';
import './CamposDinamicosPage.css';

const TIPOS = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'boolean', label: 'Booleano / Switch' },
  { value: 'select', label: 'Selección manual' },
  { value: 'select_tabla', label: 'Selección desde tabla' },
];

const TABLAS_ORIGEN = [
  { value: 'calles', label: 'Calles', filtroLocalidad: true },
  { value: 'barrios', label: 'Barrios', filtroLocalidad: true },
  { value: 'niveles_educativos', label: 'Niveles educativos', filtroLocalidad: false },
  { value: 'instituciones_educativas', label: 'Instituciones educativas', filtroLocalidad: true },
  { value: 'nacionalidades', label: 'Nacionalidades', filtroLocalidad: false },
  { value: 'ciudades', label: 'Ciudades', filtroLocalidad: false },
];

const ENTIDADES = [
  { id: 'titular', label: 'Titulares' },
  { id: 'grupo', label: 'Grupo familiar' },
  { id: 'encuesta_social', label: 'Encuestas Sociales' },
];

const initialFormData = {
  nombre: '',
  tipo: 'text',
  opciones: [],
  nuevaOpcion: '',
  tablaConfig: null,
  appliesTo: 'titular',
  required: false,
};

export default function CamposDinamicosPage({ desarrolloSocial = false }) {
  const { user, systems } = useAuth();
  const navigate = useNavigate();
  const [campos, setCampos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [dragged, setDragged] = useState(null);

  const desarrolloSocialSystem = systems?.find((s) => s.modules?.some((m) => m.route === '/desarrollo-social/encuestas'));
  const isDsAdmin = user?.globalRole === 'SUPERADMIN' || desarrolloSocialSystem?.role === 'ADMIN';
  const api = desarrolloSocial ? dsApi.camposDinamicos : camposDinamicosApi;
  const canAccess = desarrolloSocial ? isDsAdmin : user?.globalRole === 'SUPERADMIN';

  const loadCampos = useCallback(async () => {
    if (!user || !canAccess) return;
    setLoading(true);
    try {
      const res = await api.list();
      const sorted = (res.data || []).sort((a, b) => a.orden - b.orden);
      setCampos(sorted);
    } catch (err) {
      sileo.error({ title: 'Error al cargar campos', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, canAccess, api]);

  useEffect(() => {
    if (!user) return;
    if (!canAccess) {
      navigate(desarrolloSocial ? '/desarrollo-social' : '/sistemas', { replace: true });
      return;
    }
    loadCampos();
  }, [user, canAccess, api, navigate, loadCampos]);

  const openCreate = (appliesTo) => {
    setFormData({
      ...initialFormData,
      appliesTo,
      opciones: [],
      nuevaOpcion: '',
      tablaConfig: null,
    });
    setModal({ type: 'create', appliesTo });
  };

  const openEdit = (c) => {
    setFormData({
      nombre: c.nombre,
      tipo: c.tipo,
      opciones: c.opciones || [],
      nuevaOpcion: '',
      tablaConfig: c.tablaConfig || null,
      appliesTo: c.appliesTo,
      required: c.required,
    });
    setModal({ type: 'edit', id: c.id });
  };

  const closeModal = () => setModal(null);

  const addOpcion = () => {
    const v = formData.nuevaOpcion?.trim();
    if (!v) return;
    setFormData((d) => ({
      ...d,
      opciones: [...(d.opciones || []), v],
      nuevaOpcion: '',
    }));
  };

  const removeOpcion = (idx) => {
    setFormData((d) => ({
      ...d,
      opciones: (d.opciones || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        tipo: formData.tipo,
        opciones: formData.tipo === 'select' ? (formData.opciones || []) : undefined,
        tablaConfig: formData.tipo === 'select_tabla' ? {
          tabla: formData.tablaConfig?.tabla || 'calles',
          valorColumna: 'id',
          labelColumna: 'nombre',
          localidad: formData.tablaConfig?.localidad || null,
        } : undefined,
        appliesTo: modal.type === 'create' ? modal.appliesTo : formData.appliesTo,
        required: formData.required,
      };
      if (modal.type === 'create') {
        await api.create(payload);
        sileo.success({ title: 'Campo creado' });
      } else {
        await api.update(modal.id, payload);
        sileo.success({ title: 'Campo actualizado' });
      }
      closeModal();
      loadCampos();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c) => {
    setToggling(c.id);
    try {
      const res = await api.toggleEnabled(c.id);
      setCampos((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: res.campo?.enabled ?? !x.enabled } : x)));
      sileo.success({ title: res.campo?.enabled ? 'Campo activado' : 'Campo desactivado' });
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setToggling(null);
    }
  };

  const camposPorEntidad = (appliesTo) =>
    campos.filter((c) => c.appliesTo === appliesTo).sort((a, b) => a.orden - b.orden);

  const moveField = (appliesTo, index, direction) => {
    const list = camposPorEntidad(appliesTo);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;
    const newList = [...list];
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    const ids = newList.map((c) => c.id);
    api.reorder(appliesTo, ids).then(() => loadCampos()).catch((err) => sileo.error({ title: 'Error', description: err.message }));
  };

  const handleDragStart = (e, c) => {
    setDragged(c);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', c.id);
  };

  const handleDragOver = (e, appliesTo) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, appliesTo, targetIndex) => {
    e.preventDefault();
    if (!dragged || dragged.appliesTo !== appliesTo) return setDragged(null);
    const list = camposPorEntidad(appliesTo);
    const fromIndex = list.findIndex((x) => x.id === dragged.id);
    if (fromIndex < 0 || fromIndex === targetIndex) return setDragged(null);
    const newList = [...list];
    const [removed] = newList.splice(fromIndex, 1);
    newList.splice(targetIndex, 0, removed);
    const ids = newList.map((c) => c.id);
    api.reorder(appliesTo, ids).then(() => loadCampos()).catch((err) => sileo.error({ title: 'Error', description: err.message }));
    setDragged(null);
  };

  const handleDragEnd = () => setDragged(null);

  if (!user || !canAccess) return null;

  return (
    <AppLayout>
      <div className="campos-dinamicos-page">
        <header className="campos-dinamicos-hero">
          <div>
            <h1>Campos dinámicos</h1>
            <p>Configuración de campos adicionales por módulo</p>
          </div>
        </header>

        <div className="campos-dinamicos-grid">
          {ENTIDADES.map((ent) => {
            const list = camposPorEntidad(ent.id);
            return (
              <section key={ent.id} className="campos-dinamicos-col">
                <div className="campos-dinamicos-col-header">
                  <h2>{ent.label}</h2>
                  <button type="button" className="campos-dinamicos-btn-nuevo" onClick={() => openCreate(ent.id)}>
                    + Nuevo
                  </button>
                </div>
                <ul className="campos-dinamicos-lista">
                  {list.length === 0 ? (
                    <li className="campos-dinamicos-empty">Sin campos</li>
                  ) : (
                    list.map((c, idx) => (
                      <li
                        key={c.id}
                        className={`campos-dinamicos-item ${dragged?.id === c.id ? 'campos-dinamicos-item-dragging' : ''} ${c.enabled === false ? 'campos-dinamicos-item-inactive' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, c)}
                        onDragOver={(e) => handleDragOver(e, ent.id)}
                        onDrop={(e) => handleDrop(e, ent.id, idx)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          if (!e.target.closest('.campos-dinamicos-item-actions, .campos-dinamicos-item-drag')) openEdit(c);
                        }}
                      >
                        <span className="campos-dinamicos-item-drag" title="Arrastrar">⋮⋮</span>
                        <span className="campos-dinamicos-item-nombre" title={c.nombre}>{c.nombre || '(sin nombre)'}</span>
                        <span className="campos-dinamicos-item-tipo">{TIPOS.find((t) => t.value === c.tipo)?.label ?? c.tipo}</span>
                        <div className="campos-dinamicos-item-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="campos-dinamicos-btn-arrow" onClick={() => moveField(ent.id, idx, 'up')} disabled={idx === 0} title="Subir">↑</button>
                          <button type="button" className="campos-dinamicos-btn-arrow" onClick={() => moveField(ent.id, idx, 'down')} disabled={idx === list.length - 1} title="Bajar">↓</button>
                          <button
                            type="button"
                            className={`campos-dinamicos-btn-toggle campos-dinamicos-btn-toggle-icon ${c.enabled ? 'campos-dinamicos-btn-desactivar' : 'campos-dinamicos-btn-activar'}`}
                            onClick={() => handleToggle(c)}
                            disabled={toggling === c.id}
                            title={c.enabled ? 'Desactivar' : 'Activar'}
                          >
                            {toggling === c.id ? (
                              <span className="campos-dinamicos-toggle-loading">…</span>
                            ) : c.enabled ? (
                              <svg className="campos-dinamicos-icon-trash" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            ) : (
                              <svg className="campos-dinamicos-icon-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>

        {loading && (
          <div className="campos-dinamicos-loading">
            <div className="admin-spinner" />
            <p>Cargando...</p>
          </div>
        )}

        {modal && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div className="admin-modal admin-modal--narrow" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <header className="admin-modal-header">
                <h2>
                  {modal.type === 'create'
                    ? `Nuevo campo · ${ENTIDADES.find((e) => e.id === modal.appliesTo)?.label || modal.appliesTo}`
                    : 'Editar campo'}
                </h2>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
              </header>
              <form onSubmit={handleSubmit} className="admin-modal-form">
                <section className="admin-form-section">
                  <div className="admin-field">
                    <label>Nombre del campo *</label>
                    <input
                      value={formData.nombre}
                      onChange={(e) => setFormData((d) => ({ ...d, nombre: e.target.value }))}
                      placeholder="Ej: Teléfono, Dirección"
                      required
                    />
                  </div>
                  <div className="admin-field">
                    <label>Tipo *</label>
                    <SelectSearchable
                      options={TIPOS}
                      value={formData.tipo}
                      onChange={(tipo) => setFormData((d) => ({
                        ...d,
                        tipo,
                        tablaConfig: tipo === 'select_tabla' ? (d.tablaConfig || { tabla: 'calles', localidad: null }) : null,
                      }))}
                      required
                      placeholder="Buscar tipo..."
                    />
                  </div>
                  {formData.tipo === 'select' && (
                    <div className="admin-field">
                      <label>Opciones</label>
                      <div className="campos-opciones-add">
                        <input
                          value={formData.nuevaOpcion}
                          onChange={(e) => setFormData((d) => ({ ...d, nuevaOpcion: e.target.value }))}
                          placeholder="Escribir opción y agregar"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOpcion())}
                        />
                        <button type="button" className="campos-opciones-btn-add" onClick={addOpcion}>
                          Agregar
                        </button>
                      </div>
                      <ul className="campos-opciones-lista">
                        {(formData.opciones || []).map((opt, i) => (
                          <li key={i} className="campos-opciones-item">
                            <span>{opt}</span>
                            <button type="button" className="campos-opciones-btn-remove" onClick={() => removeOpcion(i)} title="Quitar">×</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {formData.tipo === 'select_tabla' && (
                    <div className="admin-field">
                      <label>Tabla origen *</label>
                      <SelectSearchable
                        options={TABLAS_ORIGEN}
                        value={formData.tablaConfig?.tabla || 'calles'}
                        onChange={(v) => setFormData((d) => ({
                          ...d,
                          tablaConfig: {
                            ...(d.tablaConfig || {}),
                            tabla: v,
                            localidad: d.tablaConfig?.localidad || null,
                          },
                        }))}
                        placeholder="Buscar tabla..."
                      />
                      {TABLAS_ORIGEN.find((t) => t.value === (formData.tablaConfig?.tabla || 'calles'))?.filtroLocalidad && (
                        <div className="admin-field" style={{ marginTop: '0.75rem' }}>
                          <label>Filtrar por localidad</label>
                          <SelectSearchable
                            options={[
                              { value: '', label: 'Todas' },
                              { value: 'MONTE_HERMOSO', label: 'Monte Hermoso' },
                              { value: 'SAUCE_GRANDE', label: 'Sauce Grande' },
                            ]}
                            value={formData.tablaConfig?.localidad || ''}
                            onChange={(v) => setFormData((d) => ({
                              ...d,
                              tablaConfig: {
                                ...(d.tablaConfig || {}),
                                tabla: d.tablaConfig?.tabla || 'calles',
                                localidad: v || null,
                              },
                            }))}
                            placeholder="Buscar localidad..."
                          />
                        </div>
                      )}
                      <p className="admin-section-hint" style={{ marginTop: '0.5rem' }}>
                        Las opciones se cargan desde la tabla seleccionada. Se guarda el ID para normalizar.
                      </p>
                    </div>
                  )}
                  <label className="admin-module-check" style={{ alignItems: 'center', marginTop: '0.5rem' }}>
                    <input type="checkbox" checked={formData.required} onChange={(e) => setFormData((d) => ({ ...d, required: e.target.checked }))} />
                    Obligatorio
                  </label>
                </section>
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : modal.type === 'create' ? 'Crear' : 'Guardar'}
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

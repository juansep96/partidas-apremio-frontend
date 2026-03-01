import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SelectSearchable from '../components/SelectSearchable';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { personasApi, padronApi, usersApi, camposDinamicosApi, opcionesTablaApi } from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';
import './PersonasPage.css';

const initialFormData = {
  dni: '',
  apellido: '',
  nombre: '',
  personaTipo: 'titular',
  idTitular: '',
  titularDisplay: null,
  moduleIds: [],
  camposDinamicos: {},
};

const TIPOS_PERSONA = [
  { value: '', label: 'Todas', desc: 'Todas las personas' },
  { value: 'titular', label: 'Titulares', desc: 'Solo titulares' },
  { value: 'titular_con_grupo', label: 'Titulares con grupo', desc: 'Titulares que tienen integrantes' },
  { value: 'titular_sin_grupo', label: 'Titulares sin grupo', desc: 'Titulares sin integrantes' },
  { value: 'grupo', label: 'Integrantes de grupo', desc: 'Personas que son parte de un grupo' },
];

function buildInitialFilters(camposDinamicos = []) {
  const f = { dni: '', apellido: '', nombre: '', moduleId: '', tipoPersona: '' };
  camposDinamicos.forEach((c) => { f[`campo_${c.slug}`] = ''; });
  return f;
}

export default function PersonasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [personas, setPersonas] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => buildInitialFilters());
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [systems, setSystems] = useState([]);
  const [titulares, setTitulares] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [buscarTitularOpen, setBuscarTitularOpen] = useState(false);
  const [createDniVerified, setCreateDniVerified] = useState(false);
  const [createDniSearching, setCreateDniSearching] = useState(false);
  const [createDniErrorPersona, setCreateDniErrorPersona] = useState(null);
  const [titularSearch, setTitularSearch] = useState('');
  const [titularesBusqueda, setTitularesBusqueda] = useState([]);
  const [titularSearching, setTitularSearching] = useState(false);
  const [opcionesTablaCache, setOpcionesTablaCache] = useState({});
  const [personaEditadaGrupo, setPersonaEditadaGrupo] = useState([]);
  const [buscarIntegranteOpen, setBuscarIntegranteOpen] = useState(false);
  const [integranteSearch, setIntegranteSearch] = useState('');
  const [integrantesBusqueda, setIntegrantesBusqueda] = useState([]);
  const [integranteSearching, setIntegranteSearching] = useState(false);
  const [desvinculando, setDesvinculando] = useState(null);

  const loadOpcionesTabla = useCallback(async (tabla, localidad = '') => {
    const key = `${tabla}_${localidad}`;
    try {
      const params = { tabla };
      if (localidad) params.localidad = localidad;
      const res = await opcionesTablaApi.list(params);
      setOpcionesTablaCache((prev) => ({ ...prev, [key]: res.data || [] }));
    } catch {
      setOpcionesTablaCache((prev) => ({ ...prev, [key]: [] }));
    }
  }, []);

  const loadPersonas = useCallback(async () => {
    if (!user || user.globalRole !== 'SUPERADMIN') return;
    setLoading(true);
    try {
      const params = { page, per_page: 12 };
      Object.entries(filters).forEach(([k, v]) => {
        const val = typeof v === 'string' ? v.trim() : v;
        if (val !== '' && val != null) params[k] = val;
      });
      const res = await personasApi.list(params);
      setPersonas(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) {
      sileo.error({ title: 'Error al cargar personas', description: err.message });
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
    loadPersonas();
  }, [user, navigate, loadPersonas]);

  useEffect(() => {
    if (user?.globalRole !== 'SUPERADMIN') return;
    usersApi.getSystems().then(setSystems).catch(() => setSystems([]));
    personasApi.list({ per_page: 500, esTitular: '1' }).then((r) => setTitulares(r.data || [])).catch(() => setTitulares([]));
    camposDinamicosApi.list().then((r) => {
      const data = r.data || [];
      setCamposDinamicos(data);
      setFilters((prev) => {
        const next = { ...prev };
        data.filter((c) => c.enabled !== false).forEach((c) => {
          if (!(`campo_${c.slug}` in next)) next[`campo_${c.slug}`] = '';
        });
        return next;
      });
    }).catch(() => setCamposDinamicos([]));
  }, [user?.globalRole]);

  const applyFilters = () => {
    setPage(1);
    loadPersonas();
  };

  const clearFilters = () => {
    setFilters(buildInitialFilters(camposDinamicos));
    setPage(1);
  };

  const openCreate = () => {
    setFormData({ ...initialFormData });
    setCreateDniVerified(false);
    setCreateDniErrorPersona(null);
    setModal('create');
  };

  const openEdit = async (p) => {
    try {
      const full = await personasApi.get(p.id);
      setFormData({
        dni: full.dni || '',
        apellido: full.apellido || '',
        nombre: full.nombre || '',
        personaTipo: full.idTitular ? 'grupo' : 'titular',
        idTitular: full.idTitular || '',
        titularDisplay: full.titular || null,
        moduleIds: (full.modules || []).map((m) => m.id),
        camposDinamicos: full.camposDinamicos || {},
      });
      setPersonaEditadaGrupo(full.grupoFamiliar || []);
      setModal({ id: p.id });
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  const buscarIntegrantes = useCallback(async () => {
    setIntegranteSearching(true);
    try {
      const params = { per_page: 50 };
      const q = integranteSearch.trim();
      if (q) {
        if (/^\d+$/.test(q)) params.dni = q;
        else params.apellido = q;
      }
      const res = await personasApi.list(params);
      setIntegrantesBusqueda(res.data || []);
    } catch {
      setIntegrantesBusqueda([]);
    } finally {
      setIntegranteSearching(false);
    }
  }, [integranteSearch]);

  const integrantesFiltrados = (integranteSearch.trim()
    ? integrantesBusqueda.filter(
        (x) =>
          x.dni?.includes(integranteSearch) ||
          (x.apellido || '').toLowerCase().includes(integranteSearch.toLowerCase()) ||
          (x.nombre || '').toLowerCase().includes(integranteSearch.toLowerCase())
      )
    : integrantesBusqueda
  ).filter((x) => x.id !== modal?.id && !personaEditadaGrupo.some((g) => g.id === x.id));

  const agregarIntegranteAlGrupo = async (persona) => {
    if (!modal?.id) return;
    try {
      const full = await personasApi.get(persona.id);
      await personasApi.update(persona.id, {
        dni: full.dni,
        apellido: full.apellido,
        nombre: full.nombre,
        idTitular: modal.id,
        moduleIds: (full.modules || []).map((m) => m.id),
        camposDinamicos: full.camposDinamicos || {},
      });
      sileo.success({ title: 'Integrante agregado' });
      setPersonaEditadaGrupo((prev) => [...prev, { id: persona.id, dni: persona.dni, apellido: persona.apellido, nombre: persona.nombre }]);
      setBuscarIntegranteOpen(false);
      setIntegranteSearch('');
      loadPersonas();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  const desvincularDelGrupo = async (member) => {
    setDesvinculando(member.id);
    try {
      const full = await personasApi.get(member.id);
      await personasApi.update(member.id, {
        dni: full.dni,
        apellido: full.apellido,
        nombre: full.nombre,
        idTitular: null,
        moduleIds: (full.modules || []).map((m) => m.id),
        camposDinamicos: full.camposDinamicos || {},
      });
      sileo.success({ title: 'Desvinculado', description: `${member.apellido} ${member.nombre} pasó a ser titular.` });
      setPersonaEditadaGrupo((prev) => prev.filter((x) => x.id !== member.id));
      loadPersonas();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setDesvinculando(null);
    }
  };

  const closeModal = () => {
    setModal(null);
    setCreateDniVerified(false);
    setCreateDniErrorPersona(null);
    setPersonaEditadaGrupo([]);
    setBuscarIntegranteOpen(false);
  };

  const handleBuscarDni = async () => {
    const dni = formData.dni.replace(/\D/g, '').slice(0, 8);
    if (dni.length < 7 || dni.length > 8) {
      sileo.error({ title: 'DNI inválido', description: 'El DNI debe tener 7 u 8 dígitos.' });
      return;
    }
    setCreateDniSearching(true);
    setCreateDniErrorPersona(null);
    try {
      const res = await personasApi.findByDni(dni);
      if (res.exists && res.persona) {
        setCreateDniErrorPersona(res.persona);
      } else {
        const padronRes = await padronApi.buscar(dni);
        if (padronRes.success && padronRes.data) {
          const data = padronRes.data;
          const esTitularPadron = formData.personaTipo === 'titular';
          const camposActivosPadron = esTitularPadron
            ? camposDinamicos.filter((c) => c.appliesTo === 'titular' && c.enabled !== false)
            : camposDinamicos.filter((c) => c.appliesTo === 'grupo' && c.enabled !== false);

          let calleId = null;
          let alturaVal = '';
          let fechaNacVal = '';
          const domicilio = (data.domicilio || '').trim();
          if (domicilio) {
            const lastSpace = domicilio.lastIndexOf(' ');
            const calleStr = lastSpace >= 0 ? domicilio.substring(0, lastSpace).trim() : domicilio;
            alturaVal = lastSpace >= 0 ? domicilio.substring(lastSpace + 1).trim() : '';
            if (calleStr) {
              try {
                const callesRes = await opcionesTablaApi.list({ tabla: 'calles' });
                const opciones = callesRes.data || [];
                const match = opciones.find((o) => (o.label || '').toLowerCase().trim() === calleStr.toLowerCase());
                if (match) calleId = match.value;
              } catch {
                /* ignorar si falla la carga de calles */
              }
            }
          }
          if (data.clase) {
            const year = String(data.clase).replace(/\D/g, '').slice(0, 4);
            if (year.length === 4) fechaNacVal = `${year}-01-01`;
          }

          const calleCampo = camposActivosPadron.find((c) => c.tipo === 'select_tabla' && (c.tablaConfig?.tabla || 'calles') === 'calles');
          const fechaCampo = camposActivosPadron.find((c) => c.tipo === 'date' && (c.slug?.includes('nacimiento') || c.slug === 'fecha_nacimiento'));
          const alturaCampo = camposActivosPadron.find((c) => (c.tipo === 'text' || c.tipo === 'number') && (c.slug?.includes('altura') || c.slug?.includes('numero')));

          const desdePadron = {};
          if (calleCampo && calleId != null) desdePadron[calleCampo.slug] = calleId;
          if (fechaCampo && fechaNacVal) desdePadron[fechaCampo.slug] = fechaNacVal;
          if (alturaCampo && alturaVal) desdePadron[alturaCampo.slug] = alturaVal;

          setFormData((d) => ({
            ...d,
            dni: data.dni || dni,
            apellido: data.apellido || '',
            nombre: data.nombre || '',
            camposDinamicos: { ...(d.camposDinamicos || {}), ...desdePadron },
          }));
          sileo.success({ title: 'Datos del padrón', description: 'Se cargaron los datos desde el padrón electoral.' });
        } else {
          setFormData((d) => ({ ...d, dni }));
          if (padronRes.message) {
            sileo.info({ title: 'DNI no encontrado en padrón', description: `${padronRes.message} Podés completar los datos manualmente.` });
          }
        }
        setCreateDniVerified(true);
      }
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setCreateDniSearching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!esTitular && !formData.idTitular) {
      sileo.error({ title: 'Dato requerido', description: 'Si es parte de un grupo, debés seleccionar el titular.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        dni: formData.dni.replace(/\D/g, '').slice(0, 8),
        apellido: formData.apellido.trim(),
        nombre: formData.nombre.trim(),
        idTitular: esTitular ? null : (formData.idTitular || null),
        moduleIds: (formData.moduleIds || []).filter(Boolean),
        camposDinamicos: formData.camposDinamicos || {},
      };
      if (modal === 'create') {
        await personasApi.create(payload);
        sileo.success({ title: 'Persona creada' });
      } else {
        await personasApi.update(modal.id, payload);
        sileo.success({ title: 'Persona actualizada' });
      }
      closeModal();
      loadPersonas();
      if (modal === 'create') {
        personasApi.list({ per_page: 500, esTitular: '1' }).then((r) => setTitulares(r.data || [])).catch(() => {});
      }
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (p) => setDeleteConfirm(p);
  const handleDeleteCancel = () => setDeleteConfirm(null);
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const p = deleteConfirm;
    setDeleteConfirm(null);
    setDeleting(p.id);
    try {
      await personasApi.delete(p.id);
      sileo.success({ title: 'Persona eliminada' });
      loadPersonas();
      personasApi.list({ per_page: 500, esTitular: '1' }).then((r) => setTitulares(r.data || [])).catch(() => {});
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setDeleting(null);
    }
  };

  const toggleModule = (moduleId) => {
    setFormData((d) => {
      const ids = d.moduleIds || [];
      const next = ids.includes(moduleId) ? ids.filter((id) => id !== moduleId) : [...ids, moduleId];
      return { ...d, moduleIds: next };
    });
  };

  const buscarTitulares = useCallback(async () => {
    setTitularSearching(true);
    try {
      const params = { per_page: 50, esTitular: '1' };
      if (titularSearch.trim()) {
        const q = titularSearch.trim();
        if (/^\d+$/.test(q)) params.dni = q;
        else {
          const parts = q.split(/\s+/);
          if (parts.length >= 2) {
            params.apellido = parts[0];
            params.nombre = parts.slice(1).join(' ');
          } else {
            params.apellido = q;
            params.nombre = q;
          }
        }
      }
      const res = await personasApi.list(params);
      setTitularesBusqueda(res.data || []);
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setTitularSearching(false);
    }
  }, [titularSearch]);

  const openBuscarTitular = () => {
    setTitularSearch('');
    setTitularesBusqueda([]);
    setBuscarTitularOpen(true);
  };

  useEffect(() => {
    if (buscarTitularOpen) {
      personasApi.list({ per_page: 50, esTitular: '1' }).then((r) => setTitularesBusqueda(r.data || [])).catch(() => {});
    }
  }, [buscarTitularOpen]);

  const selectTitular = (t) => {
    setFormData((d) => ({
      ...d,
      idTitular: t.id,
      titularDisplay: { id: t.id, dni: t.dni, apellido: t.apellido, nombre: t.nombre },
    }));
    setBuscarTitularOpen(false);
  };

  const titularesFiltrados = titularSearch.trim()
    ? titularesBusqueda.filter(
        (t) =>
          t.dni?.includes(titularSearch) ||
          (t.apellido || '').toLowerCase().includes(titularSearch.toLowerCase()) ||
          (t.nombre || '').toLowerCase().includes(titularSearch.toLowerCase())
      )
    : titularesBusqueda;

  const allModules = systems.flatMap((s) => (s.modules || []).filter((m) => m.enabled !== false).map((m) => ({ ...m, systemName: s.name })));
  const esTitular = formData.personaTipo === 'titular';
  const camposTitular = camposDinamicos.filter((c) => c.appliesTo === 'titular' && c.enabled !== false);
  const camposGrupo = camposDinamicos.filter((c) => c.appliesTo === 'grupo' && c.enabled !== false);
  const camposActivos = esTitular ? camposTitular : camposGrupo;
  const camposParaFiltros = camposDinamicos.filter((c) => c.enabled !== false);

  useEffect(() => {
    const isFormOpen = (modal === 'create' && createDniVerified) || modal?.id;
    if (!isFormOpen) return;
    const selectTabla = camposActivos.filter((c) => c.tipo === 'select_tabla');
    selectTabla.forEach((c) => {
      const tc = c.tablaConfig || {};
      loadOpcionesTabla(tc.tabla || 'calles', tc.localidad || '');
    });
  }, [modal, createDniVerified, camposActivos, loadOpcionesTabla]);

  useEffect(() => {
    if (buscarIntegranteOpen) {
      buscarIntegrantes();
    } else {
      setIntegrantesBusqueda([]);
      setIntegranteSearch('');
    }
  }, [buscarIntegranteOpen]);

  if (!user || user.globalRole !== 'SUPERADMIN') return null;

  return (
    <AppLayout>
      <div className="admin-page">
        <header className="admin-hero">
          <div>
            <h1>Personas</h1>
            <p>Gestión de personas titulares y grupos familiares</p>
          </div>
          <button type="button" className="admin-hero-btn" onClick={openCreate}>
            <span className="admin-hero-btn-icon">+</span>
            Nueva persona
          </button>
        </header>

        <div className="personas-view-bar">
          <div className="personas-tipo-tabs" role="tablist">
            {TIPOS_PERSONA.map((t) => (
              <button
                key={t.value || 'all'}
                type="button"
                role="tab"
                aria-selected={filters.tipoPersona === t.value}
                className={`personas-tipo-tab ${filters.tipoPersona === t.value ? 'personas-tipo-tab--active' : ''}`}
                onClick={() => {
                  setFilters((f) => ({ ...f, tipoPersona: t.value }));
                  setPage(1);
                }}
              >
                <span className="personas-tipo-tab-label">{t.label}</span>
                <span className="personas-tipo-tab-desc">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-filters-bar">
          <div className={`personas-filters-panel ${filtersExpanded ? 'personas-filters-expanded' : ''}`}>
            <div
              className="admin-filters-header personas-filters-header-toggle"
              onClick={() => setFiltersExpanded((v) => !v)}
              onKeyDown={(e) => e.key === 'Enter' && setFiltersExpanded((v) => !v)}
              role="button"
              tabIndex={0}
              aria-expanded={filtersExpanded}
            >
              <span className="admin-filters-title">
                Filtros
                <span className="personas-filters-chevron">{filtersExpanded ? '▼' : '▶'}</span>
              </span>
              <div className="admin-filters-btns" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="admin-filters-clear" onClick={clearFilters}>Limpiar</button>
                <button type="button" className="admin-filters-apply" onClick={applyFilters}>Filtrar</button>
              </div>
            </div>
            {filtersExpanded && (
              <div className="admin-filters-grid">
                <div className="admin-filter-field">
                  <label>DNI</label>
                  <input placeholder="DNI" value={filters.dni} onChange={(e) => setFilters((f) => ({ ...f, dni: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
                </div>
                <div className="admin-filter-field">
                  <label>Apellido</label>
                  <input placeholder="Apellido" value={filters.apellido} onChange={(e) => setFilters((f) => ({ ...f, apellido: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
                </div>
                <div className="admin-filter-field">
                  <label>Nombre</label>
                  <input placeholder="Nombre" value={filters.nombre} onChange={(e) => setFilters((f) => ({ ...f, nombre: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
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
                {camposParaFiltros.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((c) => (
                  <div key={c.id} className="admin-filter-field">
                    <label>{c.nombre}</label>
                    {c.tipo === 'select' ? (
                      <SelectSearchable
                        options={[
                          { value: '', label: 'Todos' },
                          ...(c.opciones || []).map((opt) => ({ value: opt, label: opt })),
                        ]}
                        value={filters[`campo_${c.slug}`] ?? ''}
                        onChange={(v) => setFilters((f) => ({ ...f, [`campo_${c.slug}`]: v }))}
                        placeholder="Buscar..."
                      />
                    ) : c.tipo === 'boolean' ? (
                      <SelectSearchable
                        options={[
                          { value: '', label: 'Todos' },
                          { value: '1', label: 'Sí' },
                          { value: '0', label: 'No' },
                        ]}
                        value={filters[`campo_${c.slug}`] ?? ''}
                        onChange={(v) => setFilters((f) => ({ ...f, [`campo_${c.slug}`]: v }))}
                        placeholder="Buscar..."
                      />
                    ) : (
                      <input
                        type={c.tipo === 'date' ? 'date' : c.tipo === 'number' ? 'number' : 'text'}
                        placeholder={c.nombre}
                        value={filters[`campo_${c.slug}`] ?? ''}
                        onChange={(e) => setFilters((f) => ({ ...f, [`campo_${c.slug}`]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="admin-content">
          {loading ? (
            <div className="admin-loading-state">
              <div className="admin-spinner" />
              <p>Cargando personas...</p>
            </div>
          ) : personas.length === 0 ? (
            <div className="admin-empty-state">
              <p>No hay personas que coincidan con los filtros</p>
              <button type="button" className="admin-btn-ghost" onClick={clearFilters}>Limpiar filtros</button>
            </div>
          ) : (
            <div className="admin-cards personas-cards">
              {personas.map((p) => (
                <article
                  key={p.id}
                  className={`admin-user-card persona-card persona-card--compact ${p.esTitular ? 'persona-card--titular' : 'persona-card--grupo'}`}
                  onClick={() => openEdit(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openEdit(p)}
                >
                  <div className="admin-user-card-header persona-card-header-compact">
                    <div className="admin-user-card-meta">
                      <strong>{p.apellido}, {p.nombre}</strong>
                      <span className="admin-user-dni">DNI {p.dni}</span>
                      {p.esTitular && (p.grupoFamiliarCount ?? 0) > 0 && (
                        <span className="persona-card-grupo-badge">
                          {(p.grupoFamiliarCount ?? 0)} {(p.grupoFamiliarCount ?? 0) === 1 ? 'integrante' : 'integrantes'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="admin-user-card-body persona-card-body-compact">
                    <div className="admin-user-roles">
                      {p.esTitular ? (
                        <span className="admin-tag admin-tag-super">Titular</span>
                      ) : (
                        <span className="admin-tag persona-tag-grupo">
                          <span className="persona-tag-grupo-icon">↳</span> {p.titularNombre || 'Sin titular'}
                        </span>
                      )}
                      {(p.modules || []).map((m) => (
                        <span key={m.id} className="admin-tag admin-tag-module">{m.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="admin-user-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="admin-card-btn" onClick={() => openEdit(p)}>Editar</button>
                    <button type="button" className="admin-card-btn admin-card-btn-danger" onClick={() => handleDeleteClick(p)} disabled={deleting === p.id}>
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
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
            <span>Pág. {meta.current_page} de {meta.last_page} ({meta.total} personas)</span>
            <button type="button" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
          </div>
        )}

        {deleteConfirm && (
          <div className="admin-delete-overlay" onClick={handleDeleteCancel}>
            <div className="admin-delete-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
              <h3 className="admin-delete-title">¿Eliminar a {deleteConfirm.apellido} {deleteConfirm.nombre}?</h3>
              <p className="admin-delete-desc">Esta acción no se puede deshacer.</p>
              <div className="admin-delete-actions">
                <button type="button" className="admin-delete-cancel" onClick={handleDeleteCancel}>Cancelar</button>
                <button type="button" className="admin-delete-confirm" onClick={handleDeleteConfirm} disabled={deleting === deleteConfirm.id}>
                  {deleting === deleteConfirm.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {buscarIntegranteOpen && (
          <div className="admin-modal-overlay persona-buscar-titular-overlay" onClick={() => setBuscarIntegranteOpen(false)}>
            <div className="admin-modal admin-modal--narrow persona-buscar-titular-modal" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>Agregar integrante al grupo</h2>
                <button type="button" className="admin-modal-close" onClick={() => setBuscarIntegranteOpen(false)} aria-label="Cerrar">×</button>
              </header>
              <div className="persona-buscar-titular-body">
                <div className="persona-buscar-titular-search">
                  <input
                    type="text"
                    placeholder="Buscar por DNI, apellido o nombre..."
                    value={integranteSearch}
                    onChange={(e) => setIntegranteSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarIntegrantes())}
                    autoFocus
                  />
                  <button type="button" className="admin-btn-primary" onClick={buscarIntegrantes} disabled={integranteSearching}>
                    {integranteSearching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                <ul className="persona-buscar-titular-list">
                  {integrantesFiltrados.length === 0 && !integranteSearching ? (
                    <li className="persona-buscar-titular-empty">
                      {integranteSearch.trim() ? 'Sin resultados o ya están en el grupo.' : 'Escribí y buscá para listar personas.'}
                    </li>
                  ) : (
                    integrantesFiltrados.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="persona-buscar-titular-item"
                          onClick={() => agregarIntegranteAlGrupo(p)}
                        >
                          <strong>{p.apellido}, {p.nombre}</strong>
                          <span>DNI {p.dni}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {buscarTitularOpen && (
          <div className="admin-modal-overlay persona-buscar-titular-overlay" onClick={() => setBuscarTitularOpen(false)}>
            <div className="admin-modal admin-modal--narrow persona-buscar-titular-modal" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>Buscar titular</h2>
                <button type="button" className="admin-modal-close" onClick={() => setBuscarTitularOpen(false)} aria-label="Cerrar">×</button>
              </header>
              <div className="persona-buscar-titular-body">
                <div className="persona-buscar-titular-search">
                  <input
                    type="text"
                    placeholder="Buscar por DNI, apellido o nombre..."
                    value={titularSearch}
                    onChange={(e) => setTitularSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarTitulares())}
                    autoFocus
                  />
                  <button type="button" className="admin-btn-primary" onClick={buscarTitulares} disabled={titularSearching}>
                    {titularSearching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                <ul className="persona-buscar-titular-list">
                  {titularesFiltrados.length === 0 && !titularSearching ? (
                    <li className="persona-buscar-titular-empty">
                      {titularSearch.trim() ? 'Sin resultados. Probá con otros términos.' : 'Escribí y buscá para listar titulares.'}
                    </li>
                  ) : (
                    titularesFiltrados.filter((t) => t.id !== modal?.id).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="persona-buscar-titular-item"
                          onClick={() => selectTitular(t)}
                        >
                          <strong>{t.apellido}, {t.nombre}</strong>
                          <span>DNI {t.dni}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {modal && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div
              className={`admin-modal ${modal === 'create' && !createDniVerified ? 'persona-dni-modal' : 'admin-modal--wide'}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <header className="admin-modal-header">
                <h2>{modal === 'create' ? (createDniVerified ? 'Nueva persona' : 'Buscar DNI') : 'Editar persona'}</h2>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
              </header>
              {modal === 'create' && !createDniVerified ? (
                <div className="persona-dni-search-step">
                  <p className="persona-dni-search-hint">
                    Es obligatorio buscar el DNI primero para verificar que no esté registrado y continuar con el formulario.
                  </p>
                  {createDniErrorPersona && (
                    <div className="persona-dni-error-card" role="alert">
                      <div className="persona-dni-error-title">Esta persona ya está registrada</div>
                      <div className="persona-dni-error-fields">
                        <div><strong>DNI:</strong> {createDniErrorPersona.dni}</div>
                        <div><strong>Apellido:</strong> {createDniErrorPersona.apellido}</div>
                        <div><strong>Nombre:</strong> {createDniErrorPersona.nombre}</div>
                        <div>
                          <strong>Rol:</strong>{' '}
                          {createDniErrorPersona.esTitular ? 'Es titular' : 'Parte de grupo'}
                        </div>
                        {!createDniErrorPersona.esTitular && createDniErrorPersona.titular && (
                          <div className="persona-dni-error-titular">
                            <strong>Titular:</strong> {createDniErrorPersona.titular.apellido}, {createDniErrorPersona.titular.nombre}
                            {createDniErrorPersona.titular.dni && (
                              <> — DNI: {createDniErrorPersona.titular.dni}</>
                            )}
                          </div>
                        )}
                        {(createDniErrorPersona.modules || []).length > 0 && (
                          <div><strong>Módulos:</strong> {createDniErrorPersona.modules.map(m => m.name).join(', ')}</div>
                        )}
                      </div>
                      <p className="persona-dni-error-hint">Probá con otro DNI para continuar.</p>
                    </div>
                  )}
                  <div className="persona-dni-search-row">
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={formData.dni}
                      onChange={(e) => {
                        setFormData((d) => ({ ...d, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }));
                        setCreateDniErrorPersona(null);
                      }}
                      placeholder="Ingresar DNI (7 u 8 dígitos)"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarDni())}
                    />
                    <button
                      type="button"
                      className="persona-dni-search-btn"
                      onClick={handleBuscarDni}
                      disabled={createDniSearching || formData.dni.replace(/\D/g, '').length < 7}
                      title="Buscar DNI"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      <span>{createDniSearching ? 'Buscando...' : 'Buscar'}</span>
                    </button>
                  </div>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="admin-modal-form admin-modal-form-two-col">
                <div className="admin-modal-two-col">
                  <div className="admin-modal-col-datos">
                    <section className="admin-form-section">
                      <h3>Datos fijos</h3>
                        <div className="admin-field-row-2">
                        <div className="admin-field">
                          <label>DNI *</label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={formData.dni}
                            onChange={(e) => setFormData((d) => ({ ...d, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                            placeholder="7 u 8 dígitos"
                            required
                            readOnly={modal === 'create'}
                          />
                        </div>
                        <div className="admin-field">
                          <label>Apellido *</label>
                          <input value={formData.apellido} onChange={(e) => setFormData((d) => ({ ...d, apellido: e.target.value }))} placeholder="Pérez" required />
                        </div>
                      </div>
                      <div className="admin-field">
                        <label>Nombre *</label>
                        <input value={formData.nombre} onChange={(e) => setFormData((d) => ({ ...d, nombre: e.target.value }))} placeholder="Juan" required />
                      </div>
                    </section>
                    <section className="admin-form-section">
                      <h3>Módulos</h3>
                      <p className="admin-section-hint">Módulos a los que pertenece esta persona</p>
                      <div className="admin-module-checkboxes">
                        {allModules.map((m) => (
                          <label key={m.id} className="admin-module-check">
                            <input
                              type="checkbox"
                              checked={(formData.moduleIds || []).includes(m.id)}
                              onChange={() => toggleModule(m.id)}
                            />
                            {m.systemName} › {m.name}
                          </label>
                        ))}
                        {allModules.length === 0 && <p className="admin-section-hint">No hay módulos configurados</p>}
                      </div>
                    </section>
                    <section className="admin-form-section persona-tipo-section">
                      <h3>Tipo de persona</h3>
                      <div className="persona-tipo-switch">
                        <label className={`persona-tipo-option ${esTitular ? 'persona-tipo-active' : ''}`}>
                          <input
                            type="radio"
                            name="personaTipo"
                            value="titular"
                            checked={esTitular}
                            onChange={() => setFormData((d) => ({ ...d, personaTipo: 'titular', idTitular: '', titularDisplay: null }))}
                          />
                          <span className="persona-tipo-label">Titular</span>
                          <span className="persona-tipo-desc">No pertenece a un grupo familiar</span>
                        </label>
                        <label className={`persona-tipo-option ${!esTitular ? 'persona-tipo-active' : ''}`}>
                          <input
                            type="radio"
                            name="personaTipo"
                            value="grupo"
                            checked={!esTitular}
                            onChange={() => setFormData((d) => ({ ...d, personaTipo: 'grupo' }))}
                          />
                          <span className="persona-tipo-label">Parte de grupo</span>
                          <span className="persona-tipo-desc">Integrante de un grupo familiar</span>
                        </label>
                      </div>
                      {!esTitular && (
                        <div className="persona-titular-selector">
                          {formData.idTitular ? (
                            <div className="persona-titular-selected">
                              <span>
                                {formData.titularDisplay
                                  ? `${formData.titularDisplay.apellido}, ${formData.titularDisplay.nombre} (DNI ${formData.titularDisplay.dni})`
                                  : (() => {
                                      const t = titulares.find((x) => x.id === formData.idTitular) || titularesBusqueda.find((x) => x.id === formData.idTitular);
                                      return t ? `${t.apellido}, ${t.nombre} (DNI ${t.dni})` : 'Titular seleccionado';
                                    })()}
                              </span>
                              <button type="button" className="persona-titular-btn-change" onClick={openBuscarTitular}>
                                Cambiar
                              </button>
                              <button type="button" className="persona-titular-btn-clear" onClick={() => setFormData((d) => ({ ...d, idTitular: '', titularDisplay: null }))}>
                                Quitar
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="persona-titular-btn-buscar" onClick={openBuscarTitular}>
                              Buscar titular del grupo
                            </button>
                          )}
                        </div>
                      )}
                    </section>
                    {modal?.id && esTitular && (
                      <section className="admin-form-section persona-grupo-section">
                        <h3>Grupo familiar</h3>
                        <p className="admin-section-hint">Integrantes vinculados a este titular. Al desvincular, la persona pasa a ser titular.</p>
                        {personaEditadaGrupo.length === 0 ? (
                          <p className="persona-grupo-empty">Sin integrantes</p>
                        ) : (
                          <ul className="persona-grupo-list">
                            {personaEditadaGrupo.map((m) => (
                              <li key={m.id} className="persona-grupo-item">
                                <span>{m.apellido}, {m.nombre} — DNI {m.dni}</span>
                                <button
                                  type="button"
                                  className="persona-grupo-btn-desvincular"
                                  onClick={() => desvincularDelGrupo(m)}
                                  disabled={desvinculando === m.id}
                                >
                                  {desvinculando === m.id ? 'Desvinculando...' : 'Desvincular'}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button type="button" className="persona-titular-btn-buscar" onClick={() => setBuscarIntegranteOpen(true)}>
                          + Agregar integrante
                        </button>
                      </section>
                    )}
                  </div>
                  <div className="admin-modal-col-permisos">
                    {camposActivos.length > 0 && (
                      <section className="admin-form-section">
                        <h3>Campos dinámicos</h3>
                        {camposActivos.map((c) => (
                          <div key={c.id} className="admin-field">
                            <label>{c.nombre} {c.required && '*'}</label>
                            {c.tipo === 'textarea' ? (
                              <textarea
                                value={formData.camposDinamicos?.[c.slug] ?? ''}
                                onChange={(e) => setFormData((d) => ({
                                  ...d,
                                  camposDinamicos: { ...d.camposDinamicos, [c.slug]: e.target.value },
                                }))}
                                placeholder={c.nombre}
                                required={c.required}
                                rows={2}
                              />
                            ) : c.tipo === 'select' ? (
                              <SelectSearchable
                                options={(c.opciones || []).map((opt) => ({ value: opt, label: opt }))}
                                value={formData.camposDinamicos?.[c.slug] ?? ''}
                                onChange={(v) => setFormData((d) => ({
                                  ...d,
                                  camposDinamicos: { ...d.camposDinamicos, [c.slug]: v },
                                }))}
                                required={c.required}
                                placeholder="Buscar o seleccionar..."
                              />
                            ) : c.tipo === 'boolean' ? (
                              <label className="campos-dinamicos-switch">
                                <input
                                  type="checkbox"
                                  checked={formData.camposDinamicos?.[c.slug] === '1' || formData.camposDinamicos?.[c.slug] === 'true'}
                                  onChange={(e) => setFormData((d) => ({
                                    ...d,
                                    camposDinamicos: { ...d.camposDinamicos, [c.slug]: e.target.checked ? '1' : '0' },
                                  }))}
                                />
                                <span className="campos-dinamicos-switch-slider" />
                              </label>
                            ) : c.tipo === 'select_tabla' ? (
                              <SelectSearchable
                                options={opcionesTablaCache[`${(c.tablaConfig?.tabla || 'calles')}_${(c.tablaConfig?.localidad || '')}`] || []}
                                value={formData.camposDinamicos?.[c.slug] ?? ''}
                                onChange={(v) => setFormData((d) => ({
                                  ...d,
                                  camposDinamicos: { ...d.camposDinamicos, [c.slug]: v ?? '' },
                                }))}
                                required={c.required}
                                placeholder="Buscar..."
                                className="persona-select-calle"
                              />
                            ) : (
                              <input
                                type={c.tipo === 'date' ? 'date' : c.tipo === 'number' ? 'number' : 'text'}
                                value={formData.camposDinamicos?.[c.slug] ?? ''}
                                onChange={(e) => setFormData((d) => ({
                                  ...d,
                                  camposDinamicos: { ...d.camposDinamicos, [c.slug]: e.target.value },
                                }))}
                                placeholder={c.nombre}
                                required={c.required}
                              />
                            )}
                          </div>
                        ))}
                      </section>
                    )}
                  </div>
                </div>
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="admin-btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : modal === 'create' ? 'Crear persona' : 'Guardar'}
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

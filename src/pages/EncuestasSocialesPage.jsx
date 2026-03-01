import React, { useState, useEffect, useCallback, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import EncuestaMapa from '../components/EncuestaMapa';
import { useAuth } from '../context/AuthContext';
import { encuestasSocialesApi, opcionesTablaApi, dsApi } from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';
import './PersonasPage.css';
import './EncuestasSocialesPage.css';

export default function EncuestasSocialesPage() {
  const { user, systems } = useAuth();
  const desarrolloSocialSystem = systems?.find((s) => s.modules?.some((m) => m.route === '/desarrollo-social/encuestas'));
  const isDsAdmin = user?.globalRole === 'SUPERADMIN' || desarrolloSocialSystem?.role === 'ADMIN';
  const [titulares, setTitulares] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ dni: '', apellido: '', nombre: '' });
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({
    personaId: '',
    titularDisplay: null,
    grupoFamiliar: [],
    domicilioTitular: null,
    ubicacionTipo: 'oficina',
    lat: null,
    lng: null,
    camposDinamicos: {},
  });
  const [campos, setCampos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [buscarTitularOpen, setBuscarTitularOpen] = useState(false);
  const [titularSearch, setTitularSearch] = useState('');
  const [titularesBusqueda, setTitularesBusqueda] = useState([]);
  const [titularSearching, setTitularSearching] = useState(false);
  const [opcionesCache, setOpcionesCache] = useState({});
  const [fichaPersona, setFichaPersona] = useState(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [camposTitular, setCamposTitular] = useState([]);
  const [camposGrupo, setCamposGrupo] = useState([]);
  const [fichaEditData, setFichaEditData] = useState(null);
  const [fichaSaving, setFichaSaving] = useState(false);
  const [fichaRightTab, setFichaRightTab] = useState('grupo');
  const [grupoEditando, setGrupoEditando] = useState(null);
  const [grupoEditForm, setGrupoEditForm] = useState({ dni: '', apellido: '', nombre: '', camposDinamicos: {} });
  const [grupoAgregarOpen, setGrupoAgregarOpen] = useState(false);
  const [integranteSearch, setIntegranteSearch] = useState('');
  const [integrantesBusqueda, setIntegrantesBusqueda] = useState([]);
  const [integranteDniResult, setIntegranteDniResult] = useState(null);
  const [integranteSearching, setIntegranteSearching] = useState(false);
  const [integranteSearchHasRun, setIntegranteSearchHasRun] = useState(false);
  const [agregarNuevoIntegranteOpen, setAgregarNuevoIntegranteOpen] = useState(false);
  const [agregarNuevoIntegranteForm, setAgregarNuevoIntegranteForm] = useState({ dni: '', apellido: '', nombre: '', camposDinamicos: {} });
  const [agregarNuevoIntegranteSaving, setAgregarNuevoIntegranteSaving] = useState(false);
  const [agregarNuevoIntegranteCargandoPadron, setAgregarNuevoIntegranteCargandoPadron] = useState(false);
  const integrantePadronCargadoRef = useRef(false);
  const [grupoQuitando, setGrupoQuitando] = useState(null);
  const [grupoGuardando, setGrupoGuardando] = useState(false);
  const [encuestaEditId, setEncuestaEditId] = useState(null);
  const [encuestaRenovando, setEncuestaRenovando] = useState(null);
  const [encuestaEliminando, setEncuestaEliminando] = useState(null);
  const [encuestaEliminarConfirmId, setEncuestaEliminarConfirmId] = useState(null);

  const loadTitulares = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      Object.entries(filters).forEach(([k, v]) => {
        const val = (v || '').trim();
        if (val) params[k] = val;
      });
      const res = await encuestasSocialesApi.titularesList(params);
      setTitulares(res.data || []);
      setMeta(res.meta || { current_page: 1, last_page: 1, total: 0, per_page: perPage });
    } catch (err) {
      sileo.error({ title: 'Error al cargar titulares', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, filters]);

  useEffect(() => {
    loadTitulares();
  }, [loadTitulares]);

  useEffect(() => {
    encuestasSocialesApi.campos().then((r) => setCampos(r.data || [])).catch(() => setCampos([]));
  }, []);

  const loadOpcionesTabla = useCallback(async (tabla, localidad = '') => {
    const key = `${tabla}_${localidad}`;
    try {
      const params = { tabla };
      if (localidad) params.localidad = localidad;
      const res = await opcionesTablaApi.list(params);
      setOpcionesCache((prev) => ({ ...prev, [key]: res.data || [] }));
    } catch {
      setOpcionesCache((prev) => ({ ...prev, [key]: [] }));
    }
  }, []);

  const buscarTitulares = useCallback(async () => {
    setTitularSearching(true);
    try {
      const params = { per_page: 50 };
      if (titularSearch.trim()) params.q = titularSearch.trim();
      const res = await encuestasSocialesApi.titularesList(params);
      setTitularesBusqueda(res.data || []);
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setTitularSearching(false);
    }
  }, [titularSearch]);

  useEffect(() => {
    if (buscarTitularOpen) {
      encuestasSocialesApi.titularesList({ per_page: 50 }).then((r) => setTitularesBusqueda(r.data || [])).catch(() => setTitularesBusqueda([]));
    } else {
      setTitularesBusqueda([]);
      setTitularSearch('');
    }
  }, [buscarTitularOpen]);

  const applyFilters = () => {
    setPage(1);
    loadTitulares();
  };

  const clearFilters = () => {
    setFilters({ dni: '', apellido: '', nombre: '' });
    setPage(1);
  };

  const handlePerPageChange = (val) => {
    setPerPage(parseInt(val, 10) || 15);
    setPage(1);
  };

  const openCreate = () => {
    setFormData({ personaId: '', titularDisplay: null, grupoFamiliar: [], domicilioTitular: null, ubicacionTipo: 'oficina', lat: null, lng: null, camposDinamicos: {} });
    setBuscarTitularOpen(true);
  };

  const selectTitular = async (t) => {
    setBuscarTitularOpen(false);
    setFormData((d) => ({
      ...d,
      personaId: t.id,
      titularDisplay: { id: t.id, dni: t.dni, apellido: t.apellido, nombre: t.nombre, nombreCompleto: t.nombreCompleto },
      grupoFamiliar: [],
      domicilioTitular: t.domicilio || null,
    }));
    setModal('create');
    try {
      const res = await encuestasSocialesApi.wizardPersonaBuscar(t.dni);
      if (res.exists && res.persona) {
        setFormData((d) => ({
          ...d,
          grupoFamiliar: res.persona.grupoFamiliar || [],
          domicilioTitular: res.persona.domicilio || d.domicilioTitular,
        }));
      }
    } catch {
      /* ignorar */
    }
  };

  const openFicha = async (row) => {
    const dni = row.esTitular !== false ? row.dni : (row.titularRef?.dni ?? row.dni);
    if (!dni) return;
    setFichaLoading(true);
    setFichaPersona(null);
    setFichaEditData(null);
    try {
      const [res, camposRes, camposGrupoRes] = await Promise.all([
        encuestasSocialesApi.wizardPersonaBuscar(dni),
        encuestasSocialesApi.wizardCamposTitular().catch(() => ({ data: [] })),
        encuestasSocialesApi.wizardCamposGrupo().catch(() => ({ data: [] })),
      ]);
      if (res.exists && res.persona) {
        fichaJustOpenedRef.current = true;
        setFichaPersona(res.persona);
        setFichaEditData({
          dni: res.persona.dni,
          apellido: res.persona.apellido,
          nombre: res.persona.nombre,
          camposDinamicos: { ...(res.persona.camposDinamicos || {}) },
        });
        setCamposTitular(camposRes?.data || []);
        setCamposGrupo(camposGrupoRes?.data || []);
        [...(camposRes?.data || []), ...(camposGrupoRes?.data || [])].filter((c) => c.tipo === 'select_tabla').forEach((c) => {
          const tc = c.tablaConfig || {};
          loadOpcionesTabla(tc.tabla || 'calles', tc.localidad || '');
        });
      } else {
        sileo.error({ title: 'Error', description: 'No se pudo cargar la ficha de la persona.' });
      }
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setFichaLoading(false);
    }
  };

  const closeFicha = () => {
    setFichaPersona(null);
    setFichaLoading(false);
    setFichaEditData(null);
    setGrupoEditando(null);
    setGrupoAgregarOpen(false);
  };

  const refreshFicha = useCallback(async () => {
    if (!fichaPersona?.dni) return;
    try {
      const res = await encuestasSocialesApi.wizardPersonaBuscar(fichaPersona.dni);
      if (res.exists && res.persona) {
        setFichaPersona(res.persona);
      }
    } catch {
      // silenciar
    }
  }, [fichaPersona?.dni]);

  const openEditGrupo = (m) => {
    setGrupoEditando(m);
    setGrupoEditForm({
      dni: m.dni || '',
      apellido: m.apellido || '',
      nombre: m.nombre || '',
      camposDinamicos: { ...(m.camposDinamicos || {}) },
    });
    (camposGrupo || [])
      .filter((c) => c.tipo === 'select_tabla')
      .forEach((c) => {
        const tc = c.tablaConfig || {};
        loadOpcionesTabla(tc.tabla || 'calles', tc.localidad || '');
      });
  };

  const closeEditGrupo = () => {
    setGrupoEditando(null);
    setGrupoEditForm({ dni: '', apellido: '', nombre: '', camposDinamicos: {} });
  };

  const saveGrupoEdit = async () => {
    if (!grupoEditando || !fichaPersona) return;
    setGrupoGuardando(true);
    try {
      await encuestasSocialesApi.wizardPersonaGuardar({
        id: grupoEditando.id,
        dni: grupoEditForm.dni.replace(/\D/g, ''),
        apellido: grupoEditForm.apellido.trim(),
        nombre: grupoEditForm.nombre.trim(),
        idTitular: fichaPersona.id,
        camposDinamicos: grupoEditForm.camposDinamicos || {},
      });
      sileo.success({ title: 'Datos actualizados' });
      closeEditGrupo();
      refreshFicha();
      loadTitulares();
    } catch (err) {
      sileo.error({ title: 'Error', description: err?.message || 'Error al guardar' });
    } finally {
      setGrupoGuardando(false);
    }
  };

  const quitarDelGrupo = async (m) => {
    if (!m || !fichaPersona) return;
    setGrupoQuitando(m.id);
    try {
      await encuestasSocialesApi.wizardGrupoQuitar(m.id);
      sileo.success({ title: 'Desvinculado', description: `${m.nombreCompleto} ya no forma parte del grupo.` });
      refreshFicha();
      loadTitulares();
    } catch (err) {
      sileo.error({ title: 'Error', description: err?.message || 'Error al desvincular' });
    } finally {
      setGrupoQuitando(null);
    }
  };

  const agregarIntegrante = async (p) => {
    if (!p || !fichaPersona) return;
    try {
      await encuestasSocialesApi.wizardGrupoAgregar(p.id, fichaPersona.id);
      sileo.success({ title: 'Agregado', description: `${p.nombreCompleto} agregado al grupo.` });
      closeAgregarIntegrante();
      refreshFicha();
      loadTitulares();
    } catch (err) {
      sileo.error({ title: 'Error', description: err?.message || 'Error al agregar' });
    }
  };

  const closeAgregarIntegrante = () => {
    setGrupoAgregarOpen(false);
    setIntegranteSearch('');
    setIntegrantesBusqueda([]);
    setIntegranteDniResult(null);
    setIntegranteSearchHasRun(false);
    setAgregarNuevoIntegranteOpen(false);
    setAgregarNuevoIntegranteForm({ dni: '', apellido: '', nombre: '', camposDinamicos: {} });
    integrantePadronCargadoRef.current = false;
  };

  const abrirEncuesta = (id) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    params.set('inline', '1');
    window.open(`${base}/encuestas-sociales/${id}/pdf?${params}`, '_blank');
  };

  const editarEncuesta = async (id) => {
    try {
      const enc = await encuestasSocialesApi.get(id);
      if (!fichaPersona) return;
      setFormData({
        personaId: fichaPersona.id,
        titularDisplay: { apellido: fichaPersona.apellido, nombre: fichaPersona.nombre, dni: fichaPersona.dni, nombreCompleto: fichaPersona.nombreCompleto },
        grupoFamiliar: fichaPersona.grupoFamiliar || [],
        domicilioTitular: fichaPersona.domicilio || null,
        ubicacionTipo: enc.ubicacionTipo || 'oficina',
        lat: enc.lat ?? null,
        lng: enc.lng ?? null,
        camposDinamicos: enc.camposDinamicos || {},
      });
      setEncuestaEditId(id);
      setModal('create');
    } catch {
      sileo.error({ title: 'Error', description: 'No se pudo cargar la encuesta' });
    }
  };

  const renovarEncuesta = async (id) => {
    if (!fichaPersona) return;
    setEncuestaRenovando(id);
    try {
      const enc = await encuestasSocialesApi.get(id);
      await encuestasSocialesApi.create({
        personaId: fichaPersona.id,
        camposDinamicos: enc.camposDinamicos || {},
        grupoSnapshot: enc.grupoSnapshot || undefined,
      });
      sileo.success({ title: 'Encuesta renovada', description: 'Se creó una nueva encuesta con los mismos datos.' });
      refreshFicha();
      loadTitulares();
    } catch (err) {
      sileo.error({ title: 'Error', description: err?.message || 'Error al renovar' });
    } finally {
      setEncuestaRenovando(null);
    }
  };

  const eliminarEncuesta = (id) => {
    setEncuestaEliminarConfirmId(id);
  };

  const confirmarEliminarEncuesta = async () => {
    const id = encuestaEliminarConfirmId;
    if (!id) return;
    setEncuestaEliminarConfirmId(null);
    setEncuestaEliminando(id);
    try {
      await encuestasSocialesApi.delete(id);
      sileo.success({ title: 'Encuesta eliminada' });
      refreshFicha();
      loadTitulares();
    } catch (err) {
      sileo.error({ title: 'Error', description: err?.message || 'Error al eliminar' });
    } finally {
      setEncuestaEliminando(null);
    }
  };

  const agregarIntegranteNuevo = async (e) => {
    e?.preventDefault();
    if (!fichaPersona) return;
    const { dni, apellido, nombre, camposDinamicos } = agregarNuevoIntegranteForm;
    const dniLimpio = (dni || '').replace(/\D/g, '');
    if (dniLimpio.length < 7 || dniLimpio.length > 8) {
      sileo.error({ title: 'Error', description: 'El DNI debe tener 7 u 8 dígitos' });
      return;
    }
    if (!apellido?.trim() || !nombre?.trim()) {
      sileo.error({ title: 'Error', description: 'Apellido y nombre son obligatorios' });
      return;
    }
    setAgregarNuevoIntegranteSaving(true);
    try {
      await encuestasSocialesApi.wizardPersonaGuardar({
        dni: dniLimpio,
        apellido: apellido.trim(),
        nombre: nombre.trim(),
        idTitular: fichaPersona.id,
        camposDinamicos: camposDinamicos || {},
      });
      sileo.success({ title: 'Agregado', description: 'Nuevo integrante creado y agregado al grupo.' });
      closeAgregarIntegrante();
      refreshFicha();
      loadTitulares();
    } catch (err) {
      sileo.error({ title: 'Error', description: err?.message || 'Error al crear integrante' });
    } finally {
      setAgregarNuevoIntegranteSaving(false);
    }
  };

  const buscarIntegrantes = useCallback(async () => {
    const q = (integranteSearch || '').trim();
    setIntegranteSearching(true);
    setIntegranteDniResult(null);
    setIntegrantesBusqueda([]);
    try {
      const dniSolo = q.replace(/\D/g, '');
      const esBusquedaDni = dniSolo.length >= 7 && dniSolo.length <= 8 && /^\d+$/.test(dniSolo);

      if (esBusquedaDni) {
        const res = await encuestasSocialesApi.wizardPersonaBuscar(dniSolo);
        if (res.exists && res.persona) {
          const p = res.persona;
          const esTitularSinGrupo = p.esTitular === true && (!p.grupoFamiliar || p.grupoFamiliar.length === 0);
          const puedeAgregar = esTitularSinGrupo && p.id !== fichaPersona?.id && !fichaPersona?.grupoFamiliar?.some((g) => g.id === p.id);
          setIntegranteDniResult({ persona: p, puedeAgregar, noEncontrado: false });
        } else {
          setIntegranteDniResult({ persona: null, puedeAgregar: false, noEncontrado: true });
          setAgregarNuevoIntegranteForm({ dni: dniSolo, apellido: '', nombre: '', camposDinamicos: {} });
          setAgregarNuevoIntegranteOpen(true);
          integrantePadronCargadoRef.current = false;
        }
      } else if (q.length >= 2) {
        const res = await encuestasSocialesApi.wizardPersonasBuscar(q);
        setIntegrantesBusqueda(res.data || []);
        if (!res.data?.length) {
          setAgregarNuevoIntegranteForm({ dni: q.replace(/\D/g, '').slice(0, 8), apellido: '', nombre: '', camposDinamicos: {} });
          setAgregarNuevoIntegranteOpen(true);
          integrantePadronCargadoRef.current = false;
        }
      }
    } catch {
      setIntegranteDniResult(null);
      setIntegrantesBusqueda([]);
    } finally {
      setIntegranteSearching(false);
      setIntegranteSearchHasRun(true);
    }
  }, [integranteSearch, fichaPersona]);

  const cargarPadronIntegrante = useCallback(async () => {
    const dni = (agregarNuevoIntegranteForm.dni || '').replace(/\D/g, '');
    if (dni.length < 7 || dni.length > 8 || integrantePadronCargadoRef.current) return;
    integrantePadronCargadoRef.current = true;
    setAgregarNuevoIntegranteCargandoPadron(true);
    try {
      const padronRes = await encuestasSocialesApi.wizardPadronBuscar(dni);
      if (padronRes.success && padronRes.data) {
        const data = padronRes.data;
        const domicilio = (data.domicilio || '').trim();
        let calleId = null;
        let alturaVal = '';
        let fechaNacVal = '';
        if (domicilio) {
          const lastSpace = domicilio.lastIndexOf(' ');
          const calleStr = lastSpace >= 0 ? domicilio.substring(0, lastSpace).trim() : domicilio;
          alturaVal = lastSpace >= 0 ? domicilio.substring(lastSpace + 1).trim() : '';
          if (calleStr) {
            try {
              const callesRes = await opcionesTablaApi.list({ tabla: 'calles' });
              const opciones = callesRes.data || callesRes?.opciones || [];
              const arr = Array.isArray(opciones) ? opciones : [];
              const match = arr.find((o) => (o.label || o.nombre || '').toLowerCase().trim() === calleStr.toLowerCase());
              if (match) calleId = match.value ?? match.id;
            } catch {
              /* ignorar */
            }
          }
        }
        if (data.clase) {
          const year = String(data.clase).replace(/\D/g, '').slice(0, 4);
          if (year.length === 4) fechaNacVal = `${year}-01-01`;
        }
        const desdePadron = {};
        for (const c of camposGrupo) {
          if (c.tipo === 'select_tabla' && (c.tablaConfig?.tabla || 'calles') === 'calles' && calleId != null) {
            desdePadron[c.slug] = calleId;
          } else if (c.tipo === 'date' && (c.slug?.includes('nacimiento') || c.slug === 'fecha_nacimiento') && fechaNacVal) {
            desdePadron[c.slug] = fechaNacVal;
          } else if ((c.tipo === 'text' || c.tipo === 'number') && (c.slug?.includes('altura') || c.slug?.includes('numero')) && alturaVal) {
            desdePadron[c.slug] = alturaVal;
          } else if ((c.tipo === 'text' || c.tipo === 'select') && (c.slug?.includes('escuela') || c.slug === 'escuela') && data.escuela) {
            desdePadron[c.slug] = data.escuela;
          }
        }
        setAgregarNuevoIntegranteForm((f) => ({
          dni: data.dni || dni,
          apellido: data.apellido || f.apellido,
          nombre: data.nombre || f.nombre,
          camposDinamicos: { ...(f.camposDinamicos || {}), ...desdePadron },
        }));
        sileo.success({ title: 'Datos del padrón', description: 'Se cargaron los datos desde el padrón electoral.' });
      } else {
        integrantePadronCargadoRef.current = false;
        if (padronRes.message) {
          sileo.info({ title: 'DNI no encontrado en padrón', description: `${padronRes.message} Completá los datos manualmente.` });
        }
      }
    } catch (err) {
      integrantePadronCargadoRef.current = false;
    } finally {
      setAgregarNuevoIntegranteCargandoPadron(false);
    }
  }, [agregarNuevoIntegranteForm.dni, camposGrupo]);

  useEffect(() => {
    if (agregarNuevoIntegranteOpen && agregarNuevoIntegranteForm.dni) {
      cargarPadronIntegrante();
    }
  }, [agregarNuevoIntegranteOpen, agregarNuevoIntegranteForm.dni, cargarPadronIntegrante]);

  const fichaJustOpenedRef = useRef(false);

  const saveFicha = useCallback(async () => {
    if (!fichaPersona || !fichaEditData || !isDsAdmin) return;
    setFichaSaving(true);
    try {
      const res = await dsApi.personas.update(fichaPersona.id, fichaEditData);
      if (res.persona) {
        fichaJustOpenedRef.current = true;
        setFichaPersona(res.persona);
        setFichaEditData({
          dni: res.persona.dni,
          apellido: res.persona.apellido,
          nombre: res.persona.nombre,
          camposDinamicos: { ...(res.persona.camposDinamicos || {}) },
        });
        sileo.success({ title: 'Guardado' });
        loadTitulares();
      }
    } catch (err) {
      sileo.error({ title: 'Error', description: err?.message || 'Error al guardar' });
    } finally {
      setFichaSaving(false);
    }
  }, [fichaPersona, fichaEditData, isDsAdmin, loadTitulares]);

  useEffect(() => {
    if (!fichaPersona || !fichaEditData || !isDsAdmin) return;
    if (fichaJustOpenedRef.current) {
      fichaJustOpenedRef.current = false;
      return;
    }
    const t = setTimeout(() => saveFicha(), 700);
    return () => clearTimeout(t);
  }, [fichaEditData, fichaPersona, isDsAdmin, saveFicha]);

  const closeModal = () => {
    setModal(null);
    setEncuestaEditId(null);
  };

  useEffect(() => {
    if ((modal === 'create' || modal === 'edit') && campos.length > 0) {
      campos.filter((c) => c.tipo === 'select_tabla').forEach((c) => {
        const tc = c.tablaConfig || {};
        loadOpcionesTabla(tc.tabla || 'calles', tc.localidad || '');
      });
    }
  }, [modal, campos, loadOpcionesTabla]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.personaId) {
      sileo.error({ title: 'Error', description: 'Debés seleccionar un titular.' });
      return;
    }
    const requeridos = (campos || []).filter((c) => c.required);
    for (const c of requeridos) {
      const val = formData.camposDinamicos?.[c.slug];
      const vacio = val === undefined || val === null || String(val).trim() === '';
      if (vacio) {
        sileo.error({ title: 'Campos incompletos', description: `Completá el campo obligatorio: ${c.nombre}` });
        return;
      }
    }
    if (formData.ubicacionTipo === 'territorio' && (formData.lat == null || formData.lng == null)) {
      sileo.error({ title: 'Ubicación requerida', description: 'Para encuesta en territorio, indicá la ubicación en el mapa (el pin se carga automáticamente con el domicilio del titular).' });
      return;
    }
    setSaving(true);
    try {
      if (encuestaEditId) {
        await encuestasSocialesApi.update(encuestaEditId, {
          camposDinamicos: formData.camposDinamicos || {},
          ubicacionTipo: formData.ubicacionTipo,
          lat: formData.lat ?? null,
          lng: formData.lng ?? null,
        });
        sileo.success({ title: 'Encuesta actualizada' });
      } else {
        await encuestasSocialesApi.create({
          personaId: formData.personaId,
          camposDinamicos: formData.camposDinamicos || {},
          ubicacionTipo: formData.ubicacionTipo,
          lat: formData.lat ?? null,
          lng: formData.lng ?? null,
        });
        sileo.success({ title: 'Encuesta creada' });
      }
      closeModal();
      loadTitulares();
      if (fichaPersona) refreshFicha();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const titularesFiltrados = (titularSearch.trim()
    ? titularesBusqueda.filter(
        (t) =>
          (t.dni || '').includes(titularSearch) ||
          (t.apellido || '').toLowerCase().includes(titularSearch.toLowerCase()) ||
          (t.nombre || '').toLowerCase().includes(titularSearch.toLowerCase())
      )
    : titularesBusqueda
  ).filter((t) => t.esTitular !== false);

  const renderCampoInput = (c, value, onChange) => {
    const val = value ?? '';
    const key = `${c.tablaConfig?.tabla || 'calles'}_${c.tablaConfig?.localidad || ''}`;
    const opciones = opcionesCache[key] || [];

    if (c.tipo === 'select') {
      return (
        <SelectSearchable
          options={(c.opciones || []).map((opt) => ({ value: opt, label: opt }))}
          value={val}
          onChange={onChange}
          required={c.required}
          placeholder="Buscar o seleccionar..."
        />
      );
    }
    if (c.tipo === 'select_tabla') {
      return (
        <SelectSearchable
          options={opciones}
          value={val}
          onChange={onChange}
          required={c.required}
          placeholder="Buscar o seleccionar..."
        />
      );
    }
    if (c.tipo === 'boolean') {
      const checked = val === '1' || val === 'true' || val === true;
      return (
        <label className="campos-dinamicos-switch">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked ? '1' : '0')}
          />
          <span className="campos-dinamicos-switch-slider" />
        </label>
      );
    }
    if (c.tipo === 'textarea') {
      return (
        <textarea
          value={val}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={c.required}
          placeholder={c.nombre}
        />
      );
    }
    return (
      <input
        type={c.tipo === 'date' ? 'date' : c.tipo === 'number' ? 'number' : 'text'}
        value={val}
        onChange={(e) => onChange(e.target.value)}
        required={c.required}
        placeholder={c.nombre}
      />
    );
  };

  const formatFecha = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  return (
    <AppLayout>
      <div className="admin-page encuestas-sociales-page">
        <header className="admin-hero">
          <div>
            <h1>Encuestas Sociales</h1>
            <p>Personas del módulo Desarrollo Social</p>
          </div>
        </header>

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
          ) : titulares.length === 0 ? (
            <div className="admin-empty-state">
              <p>No hay personas que coincidan con los filtros</p>
              <button type="button" className="admin-btn-ghost" onClick={clearFilters}>Limpiar filtros</button>
            </div>
          ) : (
            <div className="encuestas-table-wrap">
              <table className="encuestas-table">
                <thead>
                  <tr>
                    <th>Titular / Grupo</th>
                    <th>DNI</th>
                    <th>Apellido</th>
                    <th>Nombre</th>
                    <th>Domicilio</th>
                    <th>Fecha última encuesta</th>
                  </tr>
                </thead>
                <tbody>
                  {titulares.map((row) => {
                    const esTitular = row.esTitular !== false;
                    return (
                      <tr
                        key={row.id}
                        className={`encuestas-row encuestas-row-clickable ${esTitular ? 'encuestas-row-titular' : 'encuestas-row-grupo'}`}
                        onClick={() => openFicha(row)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && openFicha(row)}
                      >
                        <td>
                            {esTitular ? (
                              <span className="encuestas-tipo-badge encuestas-tipo-titular">Titular</span>
                            ) : (
                              <div className="encuestas-td-titular-grupo">
                                <span className="encuestas-tipo-badge encuestas-tipo-grupo">Grupo - DNI {row.titularRef?.dni ?? '-'} - {(row.titularRef?.nombreCompleto || '').toUpperCase()}</span>
                              </div>
                            )}
                          </td>
                          <td>{row.dni || '-'}</td>
                          <td>{(row.apellido || '-').toUpperCase()}</td>
                          <td><strong>{(row.nombre || '-').toUpperCase()}</strong></td>
                          <td>{(row.domicilio || '-').toUpperCase()}</td>
                          <td>{formatFecha(row.fechaUltimaEncuesta)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && titulares.length > 0 && (
          <div className="encuestas-pagination">
            <div className="encuestas-pagination-nav">
              <button type="button" className="encuestas-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
              <span className="encuestas-pagination-info">
                Pág. {meta?.current_page || 1} de {meta?.last_page || 1} ({meta?.total || 0} personas)
              </span>
              <button type="button" className="encuestas-pagination-btn" disabled={page >= (meta?.last_page || 1)} onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
            </div>
            <div className="encuestas-pagination-right">
              <label className="encuestas-per-page">
                Mostrar:
                <SelectSearchable
                  className="encuestas-per-page-select"
                  options={[
                    { value: 10, label: '10' },
                    { value: 15, label: '15' },
                    { value: 25, label: '25' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' },
                  ]}
                  value={perPage}
                  onChange={handlePerPageChange}
                  placeholder="Seleccionar"
                />
              </label>
            </div>
          </div>
        )}

        {buscarTitularOpen && (
          <div className="admin-modal-overlay persona-buscar-titular-overlay" onClick={() => setBuscarTitularOpen(false)}>
            <div className="admin-modal admin-modal--narrow persona-buscar-titular-modal" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>Seleccionar titular</h2>
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
                      {titularSearch.trim() ? 'Sin resultados.' : 'Escribí y buscá para listar titulares.'}
                    </li>
                  ) : (
                    titularesFiltrados.map((t) => (
                      <li key={t.id}>
                        <button type="button" className="persona-buscar-titular-item" onClick={() => selectTitular(t)}>
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

        {(fichaPersona || fichaLoading) && (
          <div className="admin-modal-overlay ficha-modal-overlay" onClick={closeFicha}>
            <div className="admin-modal ficha-modal ficha-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <header className="ficha-modal-header">
                <div className="ficha-modal-header-title">
                  <h2>
                    {fichaEditData
                      ? [fichaEditData.apellido, fichaEditData.nombre].map((s) => (s || '').trim()).filter(Boolean).join(', ') || 'Ficha'
                      : fichaLoading ? 'Cargando...' : 'Ficha de Persona'}
                  </h2>
                  {fichaSaving && <span className="ficha-saving-badge">Guardando...</span>}
                </div>
                <button type="button" className="admin-modal-close" onClick={closeFicha} aria-label="Cerrar">×</button>
              </header>
              <div className="ficha-modal-body ficha-modal-body--two-cols">
                {fichaLoading ? (
                  <div className="admin-loading-state ficha-loading-full">
                    <div className="admin-spinner" />
                    <p>Cargando ficha...</p>
                  </div>
                ) : fichaPersona && fichaEditData ? (
                  <>
                    <div className="ficha-col ficha-col-left">
                      <div className="ficha-hero">
                        <div className="ficha-hero-info">
                          {isDsAdmin ? (
                            <div className="ficha-hero-fields ficha-hero-fields--row">
                              <input
                                type="text"
                                className="ficha-hero-input ficha-hero-nombre"
                                value={fichaEditData.nombre}
                                onChange={(e) => setFichaEditData((d) => ({ ...d, nombre: e.target.value }))}
                                placeholder="Nombre"
                              />
                              <input
                                type="text"
                                className="ficha-hero-input ficha-hero-apellido"
                                value={fichaEditData.apellido}
                                onChange={(e) => setFichaEditData((d) => ({ ...d, apellido: e.target.value }))}
                                placeholder="Apellido"
                              />
                              <span className="ficha-hero-dni-readonly">DNI {fichaEditData.dni || '-'}</span>
                            </div>
                          ) : (
                            <div className="ficha-hero-fields ficha-hero-fields--row">
                              <h3 className="ficha-hero-nombre-display">{fichaPersona.nombreCompleto}</h3>
                              <span className="ficha-hero-dni-display">DNI {fichaPersona.dni || '-'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {camposTitular.length > 0 && (
                        <section className="ficha-section">
                          <h4>Datos adicionales</h4>
                          <div className="ficha-campos-grid">
                            {camposTitular.map((c) => (
                              <div key={c.id} className="ficha-campo">
                                <label>{c.nombre}</label>
                                {isDsAdmin ? (
                                  renderCampoInput(c, fichaEditData.camposDinamicos?.[c.slug], (v) => setFichaEditData((d) => ({
                                    ...d,
                                    camposDinamicos: { ...(d.camposDinamicos || {}), [c.slug]: v },
                                  })))
                                ) : (
                                  <span className="ficha-campo-valor">
                                    {c.tipo === 'boolean'
                                      ? (fichaEditData.camposDinamicos?.[c.slug] === '1' || fichaEditData.camposDinamicos?.[c.slug] === 'true' ? 'Sí' : 'No')
                                      : c.tipo === 'select_tabla'
                                        ? ((() => {
                                            const key = `${c.tablaConfig?.tabla || 'calles'}_${c.tablaConfig?.localidad || ''}`;
                                            const opts = opcionesCache[key] || [];
                                            const opt = opts.find((o) => o.value === (fichaEditData.camposDinamicos?.[c.slug] ?? ''));
                                            return opt?.label ?? fichaEditData.camposDinamicos?.[c.slug] ?? '-';
                                          })())
                                        : (fichaEditData.camposDinamicos?.[c.slug] || '-')}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                    <div className="ficha-col ficha-col-right">
                      <div className="ficha-tabs">
                        <button
                          type="button"
                          className={`ficha-tab ${fichaRightTab === 'grupo' ? 'ficha-tab--active' : ''}`}
                          onClick={() => setFichaRightTab('grupo')}
                        >
                          <span className="ficha-tab-icon">👥</span>
                          Grupo Familiar
                          {fichaPersona.grupoFamiliar?.length > 0 && (
                            <span className="ficha-tab-badge">{fichaPersona.grupoFamiliar.length}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`ficha-tab ${fichaRightTab === 'encuestas' ? 'ficha-tab--active' : ''}`}
                          onClick={() => setFichaRightTab('encuestas')}
                        >
                          <span className="ficha-tab-icon">📋</span>
                          Encuestas
                          {(fichaPersona.encuestas?.length || 0) > 0 && (
                            <span className="ficha-tab-badge">{fichaPersona.encuestas.length}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`ficha-tab ${fichaRightTab === 'asistencias' ? 'ficha-tab--active' : ''}`}
                          onClick={() => setFichaRightTab('asistencias')}
                        >
                          <span className="ficha-tab-icon">✓</span>
                          Asistencias
                        </button>
                        <button
                          type="button"
                          className={`ficha-tab ${fichaRightTab === 'documentos' ? 'ficha-tab--active' : ''}`}
                          onClick={() => setFichaRightTab('documentos')}
                        >
                          <span className="ficha-tab-icon">📄</span>
                          Documentos
                        </button>
                        <button
                          type="button"
                          className={`ficha-tab ${fichaRightTab === 'observaciones' ? 'ficha-tab--active' : ''}`}
                          onClick={() => setFichaRightTab('observaciones')}
                        >
                          <span className="ficha-tab-icon">💬</span>
                          Observaciones
                        </button>
                      </div>
                      <div className="ficha-tab-panel">
                        {fichaRightTab === 'grupo' && (
                          <section className="ficha-section ficha-grupo-section">
                            <div className="ficha-grupo-header">
                              <h4>Integrantes del grupo</h4>
                              {fichaPersona.esTitular !== false && (
                                <button type="button" className="ficha-btn-add" onClick={() => setGrupoAgregarOpen(true)}>
                                  + Agregar integrante
                                </button>
                              )}
                            </div>
                            {!fichaPersona.grupoFamiliar?.length ? (
                              <p className="ficha-grupo-empty">No hay integrantes en el grupo familiar.</p>
                            ) : (
                              <ul className="ficha-grupo-list ficha-grupo-list--cards">
                                {fichaPersona.grupoFamiliar.map((m) => (
                                  <li key={m.id} className="ficha-grupo-card">
                                    <div
                                      className="ficha-grupo-card-clickable"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => openEditGrupo(m)}
                                      onKeyDown={(e) => e.key === 'Enter' && openEditGrupo(m)}
                                    >
                                      <div className="ficha-grupo-card-info">
                                        <strong>{m.nombreCompleto}</strong>
                                        <span>DNI {m.dni}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="ficha-grupo-btn ficha-grupo-btn-desvincular"
                                      onClick={(e) => { e.stopPropagation(); quitarDelGrupo(m); }}
                                      disabled={grupoQuitando === m.id}
                                      title="Desvincular del grupo"
                                    >
                                      {grupoQuitando === m.id ? (
                                        <span className="ficha-grupo-btn-loading">...</span>
                                      ) : (
                                        <>
                                          <svg className="ficha-grupo-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                            <line x1="2" y1="2" x2="22" y2="22" />
                                          </svg>
                                          Desvincular
                                        </>
                                      )}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </section>
                        )}
                        {fichaRightTab === 'encuestas' && (
                          <section className="ficha-section ficha-encuestas-section">
                            <div className="ficha-grupo-header">
                              <h4>Encuestas realizadas</h4>
                              {fichaPersona.esTitular !== false && (
                                <button
                                  type="button"
                                  className="ficha-btn-add"
                                  onClick={() => {
                                    setFormData({
                                      personaId: fichaPersona.id,
                                      titularDisplay: { apellido: fichaPersona.apellido, nombre: fichaPersona.nombre, dni: fichaPersona.dni, nombreCompleto: fichaPersona.nombreCompleto },
                                      grupoFamiliar: fichaPersona.grupoFamiliar || [],
                                      domicilioTitular: fichaPersona.domicilio || null,
                                      ubicacionTipo: 'oficina',
                                      lat: null,
                                      lng: null,
                                      camposDinamicos: {},
                                    });
                                    setModal('create');
                                  }}
                                >
                                  + Nueva Encuesta
                                </button>
                              )}
                            </div>
                            {!fichaPersona.encuestas?.length ? (
                              <p className="ficha-grupo-empty">No hay encuestas realizadas.</p>
                            ) : (
                              <div className="ficha-encuestas-table-wrap">
                                <table className="ficha-encuestas-table">
                                  <thead>
                                    <tr>
                                      <th>Fecha y hora creación</th>
                                      <th>Quien la hizo</th>
                                      <th className="ficha-encuestas-th-acciones">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {fichaPersona.encuestas.map((e) => (
                                      <tr key={e.id}>
                                        <td>{formatFecha(e.fechaHora)}</td>
                                        <td>{e.creadoPor ?? '-'}</td>
                                        <td className="ficha-encuestas-td-acciones">
                                          <div className="ficha-encuestas-acciones">
                                            <button type="button" className="ficha-encuestas-accion" onClick={() => abrirEncuesta(e.id)} title="Abrir">
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                            </button>
                                            <button type="button" className="ficha-encuestas-accion" onClick={() => editarEncuesta(e.id)} title="Editar">
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                            </button>
                                            <button type="button" className="ficha-encuestas-accion" onClick={() => renovarEncuesta(e.id)} disabled={encuestaRenovando === e.id} title="Renovar">
                                              {encuestaRenovando === e.id ? <span style={{ fontSize: '0.75rem' }}>...</span> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>}
                                            </button>
                                            <button type="button" className="ficha-encuestas-accion ficha-encuestas-accion--delete" onClick={() => eliminarEncuesta(e.id)} disabled={encuestaEliminando === e.id} title="Eliminar">
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </section>
                        )}
                        {fichaRightTab === 'asistencias' && (
                          <section className="ficha-section ficha-grupo-section">
                            <h4>Asistencias</h4>
                            <p className="ficha-grupo-empty">Próximamente. Módulo en desarrollo.</p>
                          </section>
                        )}
                        {fichaRightTab === 'documentos' && (
                          <section className="ficha-section ficha-grupo-section">
                            <h4>Documentos</h4>
                            <p className="ficha-grupo-empty">Próximamente. Módulo en desarrollo.</p>
                          </section>
                        )}
                        {fichaRightTab === 'observaciones' && (
                          <section className="ficha-section ficha-grupo-section">
                            <h4>Observaciones</h4>
                            <p className="ficha-grupo-empty">Próximamente. Módulo en desarrollo.</p>
                          </section>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {grupoEditando && (
          <div className="admin-modal-overlay" onClick={closeEditGrupo}>
            <div className="admin-modal admin-modal--narrow ficha-grupo-edit-modal" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>{grupoEditando.nombreCompleto || 'Editar integrante'}</h2>
                <button type="button" className="admin-modal-close" onClick={closeEditGrupo} aria-label="Cerrar">×</button>
              </header>
              <div className="admin-modal-form">
                <div className="admin-field">
                  <label>DNI *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={grupoEditForm.dni}
                    onChange={(e) => setGrupoEditForm((d) => ({ ...d, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    placeholder="7 u 8 dígitos"
                  />
                </div>
                <div className="admin-field">
                  <label>Apellido *</label>
                  <input type="text" value={grupoEditForm.apellido} onChange={(e) => setGrupoEditForm((d) => ({ ...d, apellido: e.target.value }))} placeholder="Apellido" />
                </div>
                <div className="admin-field">
                  <label>Nombre *</label>
                  <input type="text" value={grupoEditForm.nombre} onChange={(e) => setGrupoEditForm((d) => ({ ...d, nombre: e.target.value }))} placeholder="Nombre" />
                </div>
                {camposGrupo.length > 0 && (
                  <section className="admin-form-section" style={{ marginTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600 }}>Datos adicionales</h4>
                    <div className="ficha-campos-grid">
                      {camposGrupo.map((c) => (
                        <div key={c.id} className="ficha-campo">
                          <label>{c.nombre}</label>
                          {renderCampoInput(c, grupoEditForm.camposDinamicos?.[c.slug], (v) => setGrupoEditForm((d) => ({
                            ...d,
                            camposDinamicos: { ...(d.camposDinamicos || {}), [c.slug]: v },
                          })))}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={closeEditGrupo}>Cancelar</button>
                  <button type="button" className="admin-btn-primary" onClick={saveGrupoEdit} disabled={grupoGuardando || !grupoEditForm.dni || !grupoEditForm.apellido?.trim() || !grupoEditForm.nombre?.trim()}>
                    {grupoGuardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </footer>
              </div>
            </div>
          </div>
        )}

        {grupoAgregarOpen && fichaPersona && (
          <div className="admin-modal-overlay persona-buscar-titular-overlay" onClick={closeAgregarIntegrante}>
            <div className="admin-modal admin-modal--narrow persona-buscar-titular-modal" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>{agregarNuevoIntegranteOpen ? 'Nueva persona' : 'Agregar integrante al grupo'}</h2>
                <button type="button" className="admin-modal-close" onClick={closeAgregarIntegrante} aria-label="Cerrar">×</button>
              </header>
              <div className="persona-buscar-titular-body">
                {agregarNuevoIntegranteOpen ? (
                  <form onSubmit={agregarIntegranteNuevo} className="admin-modal-form">
                    {agregarNuevoIntegranteCargandoPadron && (
                      <p className="persona-buscar-titular-hint" style={{ marginBottom: '0.75rem', color: 'var(--admin-primary)' }}>
                        Cargando datos del padrón electoral...
                      </p>
                    )}
                    <div className="admin-field">
                      <label>DNI *</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={agregarNuevoIntegranteForm.dni}
                        onChange={(e) => setAgregarNuevoIntegranteForm((d) => ({ ...d, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                        placeholder="7 u 8 dígitos"
                        required
                      />
                    </div>
                    <div className="admin-field">
                      <label>Apellido *</label>
                      <input
                        type="text"
                        value={agregarNuevoIntegranteForm.apellido}
                        onChange={(e) => setAgregarNuevoIntegranteForm((d) => ({ ...d, apellido: e.target.value }))}
                        placeholder="Apellido"
                        required
                      />
                    </div>
                    <div className="admin-field">
                      <label>Nombre *</label>
                      <input
                        type="text"
                        value={agregarNuevoIntegranteForm.nombre}
                        onChange={(e) => setAgregarNuevoIntegranteForm((d) => ({ ...d, nombre: e.target.value }))}
                        placeholder="Nombre"
                        required
                      />
                    </div>
                    {camposGrupo.length > 0 && (
                      <section className="admin-form-section" style={{ marginTop: '1rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600 }}>Datos adicionales</h4>
                        <div className="ficha-campos-grid">
                          {camposGrupo.map((c) => (
                            <div key={c.id} className="ficha-campo">
                              <label>{c.nombre}</label>
                              {renderCampoInput(c, agregarNuevoIntegranteForm.camposDinamicos?.[c.slug], (v) => setAgregarNuevoIntegranteForm((d) => ({
                                ...d,
                                camposDinamicos: { ...(d.camposDinamicos || {}), [c.slug]: v },
                              })))}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    <footer className="admin-modal-footer" style={{ marginTop: '1rem' }}>
                      <button type="button" className="admin-btn-ghost" onClick={() => setAgregarNuevoIntegranteOpen(false)}>Volver</button>
                      <button type="submit" className="admin-btn-primary" disabled={agregarNuevoIntegranteSaving}>
                        {agregarNuevoIntegranteSaving ? 'Guardando...' : 'Crear y agregar'}
                      </button>
                    </footer>
                  </form>
                ) : (
                  <>
                    <div className="persona-buscar-titular-search">
                      <input
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
                      {integranteSearching ? (
                        <li className="persona-buscar-titular-empty">Buscando...</li>
                      ) : integranteDniResult ? (
                        integranteDniResult.puedeAgregar ? (
                          <li>
                            <div className="persona-buscar-titular-item persona-buscar-titular-item--highlight">
                              <strong>{integranteDniResult.persona.apellido}, {integranteDniResult.persona.nombre}</strong>
                              <span>DNI {integranteDniResult.persona.dni}</span>
                              <p className="persona-buscar-titular-hint">Titular sin grupo. Se puede agregar como integrante.</p>
                              <button type="button" className="admin-btn-primary" onClick={() => agregarIntegrante(integranteDniResult.persona)} style={{ marginTop: '0.5rem' }}>
                                Agregar como integrante
                              </button>
                            </div>
                          </li>
                        ) : integranteDniResult.noEncontrado ? (
                          <li className="persona-buscar-titular-empty">
                            <p>No se encontró persona con ese DNI.</p>
                            <button type="button" className="admin-btn-primary" onClick={() => { setAgregarNuevoIntegranteForm((f) => ({ ...f, dni: integranteSearch.replace(/\D/g, '') })); setAgregarNuevoIntegranteOpen(true); }}>
                              Crear nueva persona
                            </button>
                          </li>
                        ) : (
                          <li className="persona-buscar-titular-empty">
                            <p><strong>{integranteDniResult.persona.apellido}, {integranteDniResult.persona.nombre}</strong> — DNI {integranteDniResult.persona.dni}</p>
                            {integranteDniResult.persona.esTitular ? (
                              <>
                                <p><strong>Es TITULAR</strong> con grupo familiar ({(integranteDniResult.persona.grupoFamiliar || []).length} integrante{(integranteDniResult.persona.grupoFamiliar || []).length !== 1 ? 's' : ''}).</p>
                                <p>Para agregarla como integrante aquí, primero debe desvincular a sus integrantes desde su ficha.</p>
                              </>
                            ) : (
                              <>
                                <p><strong>Es INTEGRANTE</strong> del grupo de <strong>{integranteDniResult.persona.titular?.apellido}, {integranteDniResult.persona.titular?.nombre}</strong> — DNI {integranteDniResult.persona.titular?.dni || '-'}.</p>
                                <p>Debe desvincularla primero desde la ficha de ese titular.</p>
                              </>
                            )}
                          </li>
                        )
                      ) : integrantesBusqueda.length === 0 ? (
                        <li className="persona-buscar-titular-empty">
                          {integranteSearchHasRun
                            ? (integranteSearch.trim() ? 'Sin resultados. Buscá por DNI (7-8 dígitos) o nombre (mín. 2 caracteres).' : 'Escribí y buscá para listar personas.')
                            : 'Escribí y buscá para listar personas.'}
                          {integranteSearchHasRun && integranteSearch.trim().length >= 2 && (
                            <button type="button" className="admin-btn-ghost" onClick={() => { setAgregarNuevoIntegranteForm({ dni: integranteSearch.replace(/\D/g, ''), apellido: '', nombre: '', camposDinamicos: {} }); setAgregarNuevoIntegranteOpen(true); }} style={{ marginTop: '0.5rem' }}>
                              ¿No está? Crear nueva persona
                            </button>
                          )}
                        </li>
                      ) : (
                        (() => {
                          const disponibles = integrantesBusqueda.filter(
                            (p) => p.id !== fichaPersona.id && !fichaPersona.grupoFamiliar?.some((g) => g.id === p.id)
                          );
                          return disponibles.length === 0 ? (
                            <li className="persona-buscar-titular-empty">
                              Todas las personas encontradas ya están en el grupo.
                              <button type="button" className="admin-btn-ghost" onClick={() => { setAgregarNuevoIntegranteForm({ dni: integranteSearch.replace(/\D/g, '').slice(0, 8), apellido: '', nombre: '', camposDinamicos: {} }); setAgregarNuevoIntegranteOpen(true); integrantePadronCargadoRef.current = false; }} style={{ marginTop: '0.5rem' }}>
                                Crear nueva persona
                              </button>
                            </li>
                          ) : (
                            <>
                              {disponibles.map((p) => (
                                <li key={p.id}>
                                  <button type="button" className="persona-buscar-titular-item" onClick={() => agregarIntegrante(p)}>
                                    <strong>{p.apellido}, {p.nombre}</strong>
                                    <span>DNI {p.dni}</span>
                                  </button>
                                </li>
                              ))}
                              <li>
                                <button type="button" className="persona-buscar-titular-item persona-buscar-titular-item--ghost" onClick={() => setAgregarNuevoIntegranteOpen(true)}>
                                  ¿No está? Crear nueva persona
                                </button>
                              </li>
                            </>
                          );
                        })()
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {encuestaEliminarConfirmId && (
          <div className="admin-delete-overlay" onClick={() => setEncuestaEliminarConfirmId(null)}>
            <div className="admin-delete-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="encuesta-delete-title" aria-describedby="encuesta-delete-desc" aria-modal="true">
              <h3 id="encuesta-delete-title" className="admin-delete-title">¿Eliminar esta encuesta?</h3>
              <p id="encuesta-delete-desc" className="admin-delete-desc">Esta acción no se puede deshacer.</p>
              <div className="admin-delete-actions">
                <button type="button" className="admin-delete-cancel" onClick={() => setEncuestaEliminarConfirmId(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="admin-delete-confirm encuesta-delete-confirm"
                  onClick={confirmarEliminarEncuesta}
                  disabled={encuestaEliminando === encuestaEliminarConfirmId}
                >
                  {encuestaEliminando === encuestaEliminarConfirmId ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {modal === 'create' && (
          <div className="admin-modal-overlay ficha-modal-overlay" onClick={closeModal}>
            <div className="admin-modal ficha-modal ficha-modal--wide encuesta-create-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <header className="ficha-modal-header">
                <div className="ficha-modal-header-title">
                  <h2>{encuestaEditId ? 'Editar encuesta' : 'Nueva encuesta'}</h2>
                  {saving && <span className="ficha-saving-badge">Guardando...</span>}
                </div>
                <button type="button" className="admin-modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
              </header>
              <form onSubmit={handleSubmit} className="admin-modal-form encuesta-create-form">
                <div className="ficha-modal-body encuesta-create-body">
                <div className="encuesta-create-grid">
                  <div className="encuesta-create-col encuesta-create-col-left">
                    <section className="admin-form-section">
                      <h3>Datos del titular</h3>
                      {formData.titularDisplay ? (
                        <div className="encuesta-titular-selected">
                          <strong>{formData.titularDisplay.nombreCompleto || `${formData.titularDisplay.apellido}, ${formData.titularDisplay.nombre}`}</strong>
                          <span>DNI {formData.titularDisplay.dni}</span>
                          {!encuestaEditId && (
                            <button type="button" className="admin-btn-ghost admin-btn-sm" onClick={() => setBuscarTitularOpen(true)}>
                              Cambiar
                            </button>
                          )}
                        </div>
                      ) : (
                        <button type="button" className="admin-btn-ghost" onClick={() => setBuscarTitularOpen(true)}>
                          Buscar titular
                        </button>
                      )}
                    </section>
                    <section className="admin-form-section">
                      <h3>Grupo familiar</h3>
                      {!formData.titularDisplay ? (
                        <p className="encuesta-grupo-hint">Seleccioná un titular para ver el grupo.</p>
                      ) : !formData.grupoFamiliar?.length ? (
                        <p className="encuesta-grupo-empty">Sin integrantes.</p>
                      ) : (
                        <ul className="encuesta-grupo-list">
                          {formData.grupoFamiliar.map((m) => (
                            <li key={m.id}>{m.nombreCompleto || `${m.apellido}, ${m.nombre}`} — DNI {m.dni}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                  <div className="encuesta-create-col encuesta-create-col-center">
                    {campos.length > 0 && (
                      <section className="admin-form-section">
                        <h3>Campos de la encuesta</h3>
                        <div className="admin-fields-grid">
                          {campos.map((c) => (
                            <div key={c.id} className="admin-field">
                              <label>{c.nombre} {c.required && '*'}</label>
                              {renderCampoInput(
                                c,
                                formData.camposDinamicos?.[c.slug],
                                (v) => setFormData((d) => ({
                                  ...d,
                                  camposDinamicos: { ...(d.camposDinamicos || {}), [c.slug]: v },
                                }))
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                  <div className="encuesta-create-col encuesta-create-col-right">
                    <section className="admin-form-section">
                      <h3>Ubicación</h3>
                      <div className="encuesta-ubicacion-options">
                        <button
                          type="button"
                          className={`encuesta-ubicacion-btn ${formData.ubicacionTipo === 'oficina' ? 'encuesta-ubicacion-btn--active' : ''}`}
                          onClick={() => setFormData((d) => ({ ...d, ubicacionTipo: 'oficina', lat: null, lng: null }))}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9v.01" /><path d="M9 12v.01" /><path d="M9 15v.01" /><path d="M9 18v.01" /></svg>
                          <span>Oficina</span>
                        </button>
                        <button
                          type="button"
                          className={`encuesta-ubicacion-btn ${formData.ubicacionTipo === 'territorio' ? 'encuesta-ubicacion-btn--active' : ''}`}
                          onClick={() => setFormData((d) => ({ ...d, ubicacionTipo: 'territorio' }))}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                          <span>En territorio</span>
                        </button>
                      </div>
                      {formData.ubicacionTipo === 'territorio' && (
                        <>
                          {formData.domicilioTitular && (
                            <p className="encuesta-mapa-domicilio">
                              <strong>Domicilio:</strong> {formData.domicilioTitular}
                            </p>
                          )}
                          {formData.titularDisplay ? (
                            <EncuestaMapa
                              domicilio={formData.domicilioTitular}
                              lat={formData.lat}
                              lng={formData.lng}
                              onLocationChange={({ lat, lng }) => setFormData((d) => ({ ...d, lat, lng }))}
                              height={220}
                            />
                          ) : (
                            <p className="encuesta-grupo-hint">Seleccioná un titular para cargar el domicilio en el mapa.</p>
                          )}
                        </>
                      )}
                    </section>
                  </div>
                </div>
                </div>
                <footer className="admin-modal-footer ficha-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={closeModal}>Cancelar</button>
                  <button type="submit" className="admin-btn-primary" disabled={saving || !formData.personaId}>
                    {saving ? 'Guardando...' : (encuestaEditId ? 'Guardar cambios' : 'Crear encuesta')}
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

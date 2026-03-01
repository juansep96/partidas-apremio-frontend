import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import SelectSearchable from '../components/SelectSearchable';
import {
  encuestasSocialesApi,
  opcionesTablaApi,
} from '../api/client';
import { sileo } from 'sileo';
import './AdminUsuariosPage.css';
import './PersonasPage.css';
import './EncuestasSocialesPage.css';
import './NuevaEncuestaWizardPage.css';

const STEPS = [
  { id: 1, title: 'Buscar persona' },
  { id: 2, title: 'Grupo familiar' },
  { id: 3, title: 'Campos de encuesta' },
];

function formatFecha(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function NuevaEncuestaWizardPage() {
  const [searchParams] = useSearchParams();
  const prefillTitularId = searchParams.get('titularId');
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [personaDni, setPersonaDni] = useState('');
  const [personaSearching, setPersonaSearching] = useState(false);
  const [personaResult, setPersonaResult] = useState(null);
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const [fichaPersona, setFichaPersona] = useState(null);
  const [irAlTitularMessage, setIrAlTitularMessage] = useState(null);

  const [formPersona, setFormPersona] = useState({
    id: null,
    dni: '',
    apellido: '',
    nombre: '',
    camposDinamicos: {},
  });
  const [camposTitular, setCamposTitular] = useState([]);
  const [opcionesCache, setOpcionesCache] = useState({});
  const [savingPersona, setSavingPersona] = useState(false);

  const [grupoSnapshot, setGrupoSnapshot] = useState({ integrantes: [] });
  const [camposGrupo, setCamposGrupo] = useState([]);
  const [integrantesBusqueda, setIntegrantesBusqueda] = useState([]);
  const [integranteSearch, setIntegranteSearch] = useState('');
  const [integranteSearching, setIntegranteSearching] = useState(false);
  const [buscarIntegranteOpen, setBuscarIntegranteOpen] = useState(false);

  const [camposEncuesta, setCamposEncuesta] = useState([]);
  const [camposDinamicos, setCamposDinamicos] = useState({});
  const [saving, setSaving] = useState(false);
  const [encuestaCreada, setEncuestaCreada] = useState(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappTelefono, setWhatsappTelefono] = useState('');
  const [whatsappEnviando, setWhatsappEnviando] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [emailEnviando, setEmailEnviando] = useState(false);

  const titularId = personaResult?.titularId || personaResult?.persona?.id || formPersona.id;

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

  useEffect(() => {
    encuestasSocialesApi.wizardCamposTitular().then((r) => setCamposTitular(r.data || [])).catch(() => []);
    encuestasSocialesApi.campos().then((r) => setCamposEncuesta(r.data || [])).catch(() => []);
  }, []);

  useEffect(() => {
    if (prefillTitularId) {
      encuestasSocialesApi.titularesList({ per_page: 200 }).then((res) => {
        const t = (res.data || []).find((x) => x.id === prefillTitularId);
        if (t) {
          encuestasSocialesApi.wizardPersonaBuscar(t.dni).then((r) => {
            if (r.exists && r.persona) {
              setFichaPersona(r.persona);
              setFichaModalOpen(true);
              setPersonaResult(r);
            }
          });
        }
      }).catch(() => {});
    }
  }, [prefillTitularId]);


  useEffect(() => {
    if (step >= 1 && (camposTitular.length > 0 || camposEncuesta.length > 0)) {
      camposTitular.filter((c) => c.tipo === 'select_tabla').forEach((c) => {
        const tc = c.tablaConfig || {};
        loadOpcionesTabla(tc.tabla || 'calles', tc.localidad || '');
      });
    }
  }, [step, camposTitular, loadOpcionesTabla]);

  const buscarPersona = useCallback(async () => {
    const dni = personaDni.replace(/\D/g, '').slice(0, 8);
    if (dni.length < 7 || dni.length > 8) {
      sileo.error({ title: 'DNI inválido', description: 'El DNI debe tener 7 u 8 dígitos.' });
      return;
    }
    setPersonaSearching(true);
    setPersonaResult(null);
    setIrAlTitularMessage(null);
    try {
      const res = await encuestasSocialesApi.wizardPersonaBuscar(dni);
      if (!res.exists) {
        const padronRes = await encuestasSocialesApi.wizardPadronBuscar(dni);
        if (padronRes.success && padronRes.data) {
          const d = padronRes.data;
          const desdePadron = {
            id: null,
            dni: d.dni || dni,
            apellido: d.apellido || '',
            nombre: d.nombre || '',
            camposDinamicos: {},
          };
          setFormPersona(desdePadron);
          setPersonaResult({ exists: false, fromPadron: true, formData: desdePadron });
        } else {
          setFormPersona({
            id: null,
            dni,
            apellido: '',
            nombre: '',
            camposDinamicos: {},
          });
          setPersonaResult({ exists: false, fromPadron: false });
        }
      } else {
        if (res.esTitular && res.inModule) {
          setFichaPersona(res.persona);
          setFichaModalOpen(true);
          setPersonaResult(res);
        } else if (!res.esTitular && res.inModule) {
          setIrAlTitularMessage({ persona: res.persona, titularId: res.titularId });
          setPersonaResult(res);
        } else {
          setFormPersona({
            id: res.persona.id,
            dni: res.persona.dni,
            apellido: res.persona.apellido,
            nombre: res.persona.nombre,
            camposDinamicos: res.persona.camposDinamicos || {},
          });
          setPersonaResult({ ...res, editMode: true });
        }
      }
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setPersonaSearching(false);
    }
  }, [personaDni]);

  const handleSiguientePaso1 = async () => {
    if (personaResult?.exists && personaResult?.inModule && personaResult?.esTitular) {
      setFichaModalOpen(false);
      const p = personaResult.persona;
      const integrantes = [
        { id: p.id, dni: p.dni, apellido: p.apellido, nombre: p.nombre, esTitular: true },
        ...(p.grupoFamiliar || []).map((m) => ({ ...m, esTitular: false })),
      ];
      setGrupoSnapshot({ integrantes });
      setStep(2);
      return;
    }
    if (personaResult?.editMode || personaResult?.fromPadron || (personaResult?.exists && !personaResult?.inModule)) {
      setSavingPersona(true);
      try {
        const res = await encuestasSocialesApi.wizardPersonaGuardar({
          id: formPersona.id,
          dni: formPersona.dni.replace(/\D/g, '').slice(0, 8),
          apellido: formPersona.apellido.trim(),
          nombre: formPersona.nombre.trim(),
          camposDinamicos: formPersona.camposDinamicos || {},
        });
        const p = res.persona;
        const integrantes = [
          { id: p.id, dni: p.dni, apellido: p.apellido, nombre: p.nombre, esTitular: true },
          ...(p.grupoFamiliar || []).map((m) => ({ ...m, esTitular: false })),
        ];
        setGrupoSnapshot({ integrantes });
        setPersonaResult({ ...personaResult, persona: p });
        setFormPersona({
          id: p.id,
          dni: p.dni,
          apellido: p.apellido,
          nombre: p.nombre,
          camposDinamicos: p.camposDinamicos || {},
        });
        setStep(2);
      } catch (err) {
        sileo.error({ title: 'Error', description: err.message });
      } finally {
        setSavingPersona(false);
      }
    }
  };

  const abrirFichaTitular = async () => {
    if (!irAlTitularMessage?.titularId) return;
    try {
      const listRes = await encuestasSocialesApi.titularesList({ per_page: 200 });
      const t = (listRes.data || []).find((x) => x.id === irAlTitularMessage.titularId);
      if (!t) {
        sileo.error({ title: 'Error', description: 'No se pudo cargar la ficha del titular.' });
        return;
      }
      const res = await encuestasSocialesApi.wizardPersonaBuscar(t.dni);
      if (res.exists && res.persona) {
        setFichaPersona(res.persona);
        setFichaModalOpen(true);
        setIrAlTitularMessage(null);
      }
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  const cerrarFichaYContinuar = () => {
    setFichaModalOpen(false);
    const p = fichaPersona;
    const integrantes = [
      { id: p.id, dni: p.dni, apellido: p.apellido, nombre: p.nombre, esTitular: true },
      ...(p.grupoFamiliar || []).map((m) => ({ ...m, esTitular: false })),
    ];
    setGrupoSnapshot({ integrantes });
    setPersonaResult({ exists: true, inModule: true, esTitular: true, persona: p, titularId: p.id });
    setStep(2);
  };

  const handleSiguientePaso2 = () => {
    setStep(3);
  };

  const agregarIntegrante = async (persona) => {
    const yaEsta = grupoSnapshot.integrantes.some((i) => i.id === persona.id);
    if (yaEsta) return;
    const titularIdActual = grupoSnapshot.integrantes.find((i) => i.esTitular)?.id;
    if (!titularIdActual) return;
    try {
      await encuestasSocialesApi.wizardGrupoAgregar(persona.id, titularIdActual);
      setGrupoSnapshot((prev) => ({
        ...prev,
        integrantes: [
          ...prev.integrantes,
          {
            id: persona.id,
            dni: persona.dni,
            apellido: persona.apellido,
            nombre: persona.nombre,
            esTitular: false,
          },
        ],
      }));
      setBuscarIntegranteOpen(false);
      setIntegranteSearch('');
      sileo.success({ title: 'Integrante agregado' });
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  const quitarIntegrante = async (idx) => {
    if (idx === 0) return;
    const integrante = grupoSnapshot.integrantes[idx];
    if (integrante?.id) {
      try {
        await encuestasSocialesApi.wizardGrupoQuitar(integrante.id);
      } catch (err) {
        sileo.error({ title: 'Error', description: err.message });
        return;
      }
    }
    setGrupoSnapshot((prev) => ({
      ...prev,
      integrantes: prev.integrantes.filter((_, i) => i !== idx),
    }));
    sileo.success({ title: 'Integrante quitado' });
  };

  const handleGuardarEncuesta = async () => {
    if (!titularId) {
      sileo.error({ title: 'Error', description: 'No hay titular seleccionado.' });
      return;
    }
    setSaving(true);
    try {
      const encuesta = await encuestasSocialesApi.create({
        personaId: titularId,
        camposDinamicos,
        grupoSnapshot,
      });
      setEncuestaCreada(encuesta.encuesta);
      sileo.success({ title: 'Encuesta creada' });
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const renderCampoInput = (c, value, onChange, opts = {}) => {
    const val = value ?? '';
    const key = `${c.tablaConfig?.tabla || 'calles'}_${c.tablaConfig?.localidad || ''}`;
    const opciones = opcionesCache[key] || [];

    if (c.tipo === 'select') {
      return (
        <SelectSearchable
          options={(c.opciones || []).map((opt) => ({ value: opt, label: opt }))}
          value={val}
          onChange={onChange}
          required={opts.required ?? c.required}
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
          required={opts.required ?? c.required}
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
        <textarea value={val} onChange={(e) => onChange(e.target.value)} rows={3} required={opts.required ?? c.required} placeholder={c.nombre} />
      );
    }
    return (
      <input
        type={c.tipo === 'date' ? 'date' : c.tipo === 'number' ? 'number' : 'text'}
        value={val}
        onChange={(e) => onChange(e.target.value)}
        required={opts.required ?? c.required}
        placeholder={c.nombre}
      />
    );
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/desarrollo-social/encuestas');
  };

  return (
    <AppLayout>
      <div className="admin-page encuestas-sociales-page nueva-encuesta-wizard">
        <div className="wizard-hero">
          <button type="button" className="wizard-hero-back" onClick={goBack} aria-label="Volver">←</button>
          <div className="wizard-hero-text">
            <h1>Nueva encuesta</h1>
            <p>Completá los pasos para crear una encuesta social</p>
          </div>
        </div>

        <div className="wizard-steps">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`wizard-step-indicator ${
                step === s.id ? 'wizard-step-active' : step > s.id ? 'wizard-step-done' : ''
              }`}
            >
              <span className="wizard-step-num">{step > s.id ? '✓' : s.id}</span>
              <span className="wizard-step-title">{s.title}</span>
            </div>
          ))}
        </div>

        <div className="wizard-content">
          {step === 1 && (
            <section className="wizard-panel">
              <h2>Paso 1: Buscar persona</h2>
              <p className="wizard-hint">Buscá por DNI para ver si la persona está asociada al módulo o cargala desde el padrón.</p>
              <div className="wizard-search-box">
                <div className="wizard-search-row">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={personaDni}
                    onChange={(e) => setPersonaDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="DNI (7 u 8 dígitos)"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarPersona())}
                  />
                  <button type="button" className="wizard-search-btn" onClick={buscarPersona} disabled={personaSearching}>
                    {personaSearching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              {irAlTitularMessage && (
                <div className="wizard-alert wizard-alert-info" role="alert">
                  <p>Esta persona es parte del grupo familiar. Para realizar la encuesta, debés ingresar como titular.</p>
                  <button type="button" className="wizard-alert-btn" onClick={abrirFichaTitular}>
                    Ir al titular
                  </button>
                </div>
              )}

              {(personaResult?.editMode || personaResult?.fromPadron || (personaResult?.exists && !personaResult?.inModule)) && (
                <div className="wizard-form-persona">
                  <h3>Datos de la persona</h3>
                  <div className="wizard-fields-grid">
                    <div className="wizard-field">
                      <label>DNI *</label>
                      <input
                        type="tel"
                        value={formPersona.dni}
                        onChange={(e) => setFormPersona((d) => ({ ...d, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                        readOnly={!!formPersona.id}
                      />
                    </div>
                    <div className="wizard-field">
                      <label>Apellido *</label>
                      <input
                        value={formPersona.apellido}
                        onChange={(e) => setFormPersona((d) => ({ ...d, apellido: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="wizard-field">
                      <label>Nombre *</label>
                      <input
                        value={formPersona.nombre}
                        onChange={(e) => setFormPersona((d) => ({ ...d, nombre: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  {camposTitular.length > 0 && (
                    <>
                      <h4>Campos adicionales</h4>
                      <div className="wizard-fields-grid">
                        {camposTitular.map((c) => (
                          <div key={c.id} className="wizard-field">
                            <label>{c.nombre} {c.required && '*'}</label>
                            {renderCampoInput(
                              c,
                              formPersona.camposDinamicos?.[c.slug],
                              (v) => setFormPersona((d) => ({
                                ...d,
                                camposDinamicos: { ...(d.camposDinamicos || {}), [c.slug]: v },
                              }))
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="wizard-panel">
              <h2>Paso 2: Grupo familiar</h2>
              <p className="wizard-hint">Revisá y editá el grupo familiar. Podés agregar o quitar integrantes.</p>
              <ul className="wizard-grupo-list">
                {grupoSnapshot.integrantes.map((m, idx) => (
                  <li key={m.id || idx} className={`wizard-grupo-item ${m.esTitular ? 'wizard-grupo-item-titular' : ''}`}>
                    <span>
                      {m.esTitular && <strong>Titular · </strong>}
                      {m.apellido}, {m.nombre}
                      <span style={{ opacity: 0.7 }}> — DNI {m.dni}</span>
                    </span>
                    {!m.esTitular && (
                      <button type="button" className="wizard-grupo-quitar" onClick={() => quitarIntegrante(idx)}>
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" className="wizard-agregar-btn" onClick={() => setBuscarIntegranteOpen(true)}>
                <span>+</span> Agregar integrante
              </button>
            </section>
          )}

          {step === 3 && (
            <section className="wizard-panel">
              <h2>Paso 3: Campos de la encuesta</h2>
              <p className="wizard-hint">Completá los campos adicionales de la encuesta social.</p>
              {camposEncuesta.length > 0 ? (
                <div className="wizard-fields-grid">
                  {camposEncuesta.map((c) => (
                    <div key={c.id} className="wizard-field">
                      <label>{c.nombre} {c.required && '*'}</label>
                      {renderCampoInput(
                        c,
                        camposDinamicos?.[c.slug],
                        (v) => setCamposDinamicos((d) => ({ ...d, [c.slug]: v }))
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="wizard-empty-hint">No hay campos dinámicos configurados para encuestas.</p>
              )}
            </section>
          )}

          {encuestaCreada && (
            <section className="wizard-panel wizard-post-guardado">
              <div className="wizard-success-icon" aria-hidden>✓</div>
              <h2>¡Encuesta creada!</h2>
              <p>Nº de Registro: <strong>{encuestaCreada.nroRegistro ?? '-'}</strong></p>
              <p>Podés descargar el PDF, enviar por WhatsApp o por correo electrónico.</p>
              <div className="wizard-actions-post">
                <button type="button" className="wizard-action-btn wizard-action-btn-primary" onClick={() => encuestasSocialesApi.descargarPdf(encuestaCreada.id)}>
                  📄 Descargar PDF
                </button>
                <button type="button" className="wizard-action-btn wizard-action-btn-primary" onClick={() => setWhatsappOpen(true)}>
                  📱 WhatsApp
                </button>
                <button type="button" className="wizard-action-btn wizard-action-btn-primary" onClick={() => setEmailOpen(true)}>
                  ✉️ Correo
                </button>
                <button type="button" className="wizard-action-btn wizard-action-btn-ghost" onClick={() => navigate('/desarrollo-social/encuestas')}>
                  Volver a encuestas
                </button>
              </div>
            </section>
          )}

        {whatsappOpen && encuestaCreada && (
          <div className="admin-modal-overlay" onClick={() => setWhatsappOpen(false)}>
            <div className="admin-modal admin-modal--narrow" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>Enviar por WhatsApp</h2>
                <button type="button" className="admin-modal-close" onClick={() => setWhatsappOpen(false)} aria-label="Cerrar">×</button>
              </header>
              <div className="admin-modal-form">
                <p className="admin-section-hint">Sin 0 ni 15. El prefijo 549 se agrega automáticamente.</p>
                <div className="admin-field">
                  <label>Teléfono *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={whatsappTelefono}
                    onChange={(e) => setWhatsappTelefono(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="11 12345678"
                  />
                </div>
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={() => setWhatsappOpen(false)}>Cancelar</button>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    disabled={whatsappTelefono.length < 10 || whatsappEnviando}
                    onClick={async () => {
                      setWhatsappEnviando(true);
                      try {
                        await encuestasSocialesApi.enviarWhatsapp(encuestaCreada.id, whatsappTelefono);
                        sileo.success({ title: 'Enviado', description: 'El mensaje fue enviado correctamente.' });
                        setWhatsappOpen(false);
                        setWhatsappTelefono('');
                      } catch (err) {
                        const msg = err.name === 'AbortError' ? 'La operación tardó demasiado. Revisá la conexión e intentá de nuevo.' : err.message;
                        sileo.error({ title: 'Error', description: msg });
                      } finally {
                        setWhatsappEnviando(false);
                      }
                    }}
                  >
                    {whatsappEnviando ? 'Enviando...' : 'Enviar'}
                  </button>
                </footer>
              </div>
            </div>
          </div>
        )}

        {emailOpen && encuestaCreada && (
          <div className="admin-modal-overlay" onClick={() => setEmailOpen(false)}>
            <div className="admin-modal admin-modal--narrow" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>Enviar por correo</h2>
                <button type="button" className="admin-modal-close" onClick={() => setEmailOpen(false)} aria-label="Cerrar">×</button>
              </header>
              <div className="admin-modal-form">
                <div className="admin-field">
                  <label>Correo electrónico *</label>
                  <input
                    type="email"
                    value={emailDestino}
                    onChange={(e) => setEmailDestino(e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={() => setEmailOpen(false)}>Cancelar</button>
                  <button
                    type="button"
                    className="admin-btn-primary"
                    disabled={!emailDestino.trim() || emailEnviando}
                    onClick={async () => {
                      setEmailEnviando(true);
                      try {
                        await encuestasSocialesApi.enviarEmail(encuestaCreada.id, emailDestino.trim());
                        sileo.success({ title: 'Enviado', description: 'El correo fue enviado correctamente.' });
                        setEmailOpen(false);
                        setEmailDestino('');
                      } catch (err) {
                        const msg = err.name === 'AbortError' ? 'La operación tardó demasiado. Revisá la conexión e intentá de nuevo.' : err.message;
                        sileo.error({ title: 'Error', description: msg });
                      } finally {
                        setEmailEnviando(false);
                      }
                    }}
                  >
                    {emailEnviando ? 'Enviando...' : 'Enviar'}
                  </button>
                </footer>
              </div>
            </div>
          </div>
        )}

          {!encuestaCreada && (
            <footer className="wizard-footer">
              <button type="button" className="wizard-btn-ghost" onClick={goBack}>
                {step === 1 ? 'Cancelar' : '← Anterior'}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  className="wizard-btn-primary"
                  onClick={step === 1 ? handleSiguientePaso1 : handleSiguientePaso2}
                  disabled={
                    (step === 1 && !personaResult && !fichaModalOpen) ||
                    (step === 1 && (personaResult?.editMode || personaResult?.fromPadron || (personaResult?.exists && !personaResult?.inModule)) && (!formPersona.apellido?.trim() || !formPersona.nombre?.trim())) ||
                    (step === 1 && personaResult?.exists && personaResult?.inModule && personaResult?.esTitular && !fichaModalOpen) ||
                    savingPersona
                  }
                >
                  {savingPersona ? 'Guardando...' : 'Siguiente'}
                </button>
              ) : (
                <button type="button" className="wizard-btn-primary" onClick={handleGuardarEncuesta} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar encuesta'}
                </button>
              )}
            </footer>
          )}
        </div>

        {fichaModalOpen && fichaPersona && (
          <div className="admin-modal-overlay" onClick={() => setFichaModalOpen(false)}>
            <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>Ficha de persona</h2>
                <button type="button" className="admin-modal-close" onClick={() => setFichaModalOpen(false)} aria-label="Cerrar">×</button>
              </header>
              <div className="admin-modal-form">
                <section className="admin-form-section">
                  <h3>Datos</h3>
                  <p><strong>{fichaPersona.nombreCompleto}</strong> — DNI {fichaPersona.dni}</p>
                </section>
                {fichaPersona.grupoFamiliar?.length > 0 && (
                  <section className="admin-form-section">
                    <h3>Grupo familiar</h3>
                    <ul>
                      {fichaPersona.grupoFamiliar.map((m) => (
                        <li key={m.id}>{m.nombreCompleto} — DNI {m.dni}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {fichaPersona.encuestas?.length > 0 && (
                  <section className="admin-form-section">
                    <h3>Encuestas realizadas</h3>
                    <ul>
                      {fichaPersona.encuestas?.map((e) => (
                        <li key={e.id}><strong>Nº {e.nroRegistro ?? '-'}</strong> — {formatFecha(e.fechaHora)}</li>
                      ))}
                    </ul>
                  </section>
                )}
                <footer className="admin-modal-footer">
                  <button type="button" className="admin-btn-ghost" onClick={() => setFichaModalOpen(false)}>Cerrar</button>
                  <button type="button" className="admin-btn-primary" onClick={cerrarFichaYContinuar}>Siguiente</button>
                </footer>
              </div>
            </div>
          </div>
        )}

        {buscarIntegranteOpen && (
          <div className="admin-modal-overlay persona-buscar-titular-overlay" onClick={() => setBuscarIntegranteOpen(false)}>
            <div className="admin-modal admin-modal--narrow persona-buscar-titular-modal" onClick={(e) => e.stopPropagation()} role="dialog">
              <header className="admin-modal-header">
                <h2>Agregar integrante</h2>
                <button type="button" className="admin-modal-close" onClick={() => setBuscarIntegranteOpen(false)} aria-label="Cerrar">×</button>
              </header>
              <div className="persona-buscar-titular-body">
                <div className="persona-buscar-titular-search">
                  <input
                    placeholder="Buscar por DNI, apellido o nombre..."
                    value={integranteSearch}
                    onChange={(e) => setIntegranteSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && encuestasSocialesApi.wizardPersonasBuscar(integranteSearch).then((r) => setIntegrantesBusqueda(r.data || []))}
                  />
                  <button
                    type="button"
                    className="admin-btn-primary"
                    onClick={() => encuestasSocialesApi.wizardPersonasBuscar(integranteSearch).then((r) => setIntegrantesBusqueda(r.data || []))}
                  >
                    Buscar
                  </button>
                </div>
                <ul className="persona-buscar-titular-list">
                  {(integrantesBusqueda.length === 0 && !integranteSearch.trim() && (
                    <li className="persona-buscar-titular-empty">Escribí y buscá para listar personas.</li>
                  ))}
                  {integrantesBusqueda.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="persona-buscar-titular-item" onClick={() => agregarIntegrante(p)}>
                        <strong>{p.apellido}, {p.nombre}</strong>
                        <span>DNI {p.dni}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import { useState, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import { legajoApi, escritosApi, cdcApi } from '../../api/recaudacionApi';
import './DocumentosPanel.css';

const TABS = [
  { id: 'acuses', label: 'Acuses' },
  { id: 'cdc', label: 'Certificados de Deuda' },
  { id: 'escritos', label: 'Escritos' },
];

function formatFecha(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function AcusesTab({ legajo, userRole, onRefresh }) {
  const acuses = legajo.acuses || [];
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ fecha_retorno: '', resultado: '', archivo: null });
  const fileRef = useRef(null);
  const canUpload = ['Recaudacion', 'Sistemas'].includes(userRole) && legajo.estado === 'en_intimacion';

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.archivo) return sileo.error({ title: 'Seleccioná un archivo PDF' });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('archivo', form.archivo);
      if (form.fecha_retorno) fd.append('fecha_retorno', form.fecha_retorno);
      if (form.resultado) fd.append('resultado', form.resultado);
      await pjLegajoApi.subirAcuse(legajo.id, fd);
      sileo.success({ title: 'Acuse subido correctamente' });
      setForm({ fecha_retorno: '', resultado: '', archivo: null });
      if (fileRef.current) fileRef.current.value = '';
      onRefresh();
    } catch (err) {
      sileo.error({ title: 'Error al subir acuse', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {canUpload && (
        <form className="pj-docs-form-row" onSubmit={handleUpload}>
          <div className="pj-docs-form-field">
            <label>Fecha retorno</label>
            <input type="date" value={form.fecha_retorno} onChange={e => setForm(p => ({ ...p, fecha_retorno: e.target.value }))} />
          </div>
          <div className="pj-docs-form-field">
            <label>Resultado</label>
            <select value={form.resultado} onChange={e => setForm(p => ({ ...p, resultado: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              <option value="entregado">Entregado</option>
              <option value="rechazado">Rechazado</option>
              <option value="ausente">Ausente</option>
            </select>
          </div>
          <div className="pj-docs-form-field">
            <label>Archivo PDF</label>
            <input ref={fileRef} type="file" accept=".pdf" onChange={e => setForm(p => ({ ...p, archivo: e.target.files[0] || null }))} />
          </div>
          <button type="submit" className="pj-docs-btn pj-docs-btn--primary" disabled={uploading}>
            {uploading ? 'Subiendo...' : 'Subir Acuse'}
          </button>
        </form>
      )}
      <div className="pj-docs-list">
        {acuses.length === 0
          ? <div className="pj-docs-empty">Sin acuses registrados.</div>
          : acuses.map((a, i) => (
            <div key={a.id ?? i} className="pj-docs-item">
              <div className="pj-docs-item-info">
                <div className="pj-docs-item-name">{a.resultado || 'Acuse'}</div>
                <div className="pj-docs-item-meta">{formatFecha(a.fecha_retorno)} · {formatFecha(a.created_at)}</div>
              </div>
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer" className="pj-docs-btn">Ver PDF</a>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function CdcTab({ legajo, userRole, onRefresh }) {
  const certificados = legajo.certificados_deuda || [];
  const [uploading, setUploading] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const fileRef = useRef(null);
  const canUpload = ['Sistemas'].includes(userRole) && legajo.estado === 'en_juicio';

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!archivo) return sileo.error({ title: 'Seleccioná un archivo' });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('legajo_id', legajo.id);
      await pjCdcApi.create(fd);
      sileo.success({ title: 'Certificado de deuda subido' });
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      onRefresh();
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {canUpload && (
        <form className="pj-docs-form-row" onSubmit={handleUpload}>
          <div className="pj-docs-form-field">
            <label>Archivo CDC</label>
            <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={e => setArchivo(e.target.files[0] || null)} />
          </div>
          <button type="submit" className="pj-docs-btn pj-docs-btn--primary" disabled={uploading}>
            {uploading ? 'Subiendo...' : 'Subir CDC'}
          </button>
        </form>
      )}
      <div className="pj-docs-list">
        {certificados.length === 0
          ? <div className="pj-docs-empty">Sin certificados de deuda.</div>
          : certificados.map((c, i) => (
            <div key={c.id ?? i} className="pj-docs-item">
              <div className="pj-docs-item-info">
                <div className="pj-docs-item-name">Certificado de Deuda #{c.id}</div>
                <div className="pj-docs-item-meta">{formatFecha(c.created_at)}</div>
              </div>
              <div className="pj-docs-item-actions">
                <button type="button" className="pj-docs-btn" onClick={() => pjCdcApi.download(c.id)}>Descargar</button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function EscritosTab({ legajo, userRole, onRefresh }) {
  const [escritos, setEscritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const fileRef = useRef(null);
  const canUpload = ['Abogado', 'SecretarioLegal', 'Sistemas'].includes(userRole);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await pjEscritosApi.list(legajo.id);
        setEscritos(res.data || res || []);
      } catch {
        setEscritos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [legajo.id]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!archivo) return sileo.error({ title: 'Seleccioná un archivo' });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      if (descripcion) fd.append('descripcion', descripcion);
      await pjEscritosApi.upload(legajo.id, fd);
      sileo.success({ title: 'Escrito subido correctamente' });
      setArchivo(null);
      setDescripcion('');
      if (fileRef.current) fileRef.current.value = '';
      onRefresh();
      const res = await pjEscritosApi.list(legajo.id);
      setEscritos(res.data || res || []);
    } catch (err) {
      sileo.error({ title: 'Error al subir escrito', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="pj-docs-loading">Cargando...</div>;

  return (
    <div>
      {canUpload && (
        <form className="pj-docs-form-row" onSubmit={handleUpload}>
          <div className="pj-docs-form-field">
            <label>Descripción</label>
            <input type="text" placeholder="Ej: Escrito de demanda" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>
          <div className="pj-docs-form-field">
            <label>Archivo</label>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" onChange={e => setArchivo(e.target.files[0] || null)} />
          </div>
          <button type="submit" className="pj-docs-btn pj-docs-btn--primary" disabled={uploading}>
            {uploading ? 'Subiendo...' : 'Subir Escrito'}
          </button>
        </form>
      )}
      <div className="pj-docs-list">
        {escritos.length === 0
          ? <div className="pj-docs-empty">Sin escritos cargados.</div>
          : escritos.map((e, i) => (
            <div key={e.id ?? i} className="pj-docs-item">
              <div className="pj-docs-item-info">
                <div className="pj-docs-item-name">{e.descripcion || e.nombre_archivo || `Escrito #${e.id}`}</div>
                <div className="pj-docs-item-meta">{formatFecha(e.created_at)}</div>
              </div>
              {e.url && (
                <a href={e.url} target="_blank" rel="noreferrer" className="pj-docs-btn">Ver</a>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}

export default function DocumentosPanel({ legajo, userRole, onRefresh }) {
  const [activeTab, setActiveTab] = useState('acuses');

  return (
    <div className="pj-docs-panel">
      <div className="pj-docs-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`pj-docs-tab ${activeTab === tab.id ? 'pj-docs-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pj-docs-body">
        {activeTab === 'acuses' && <AcusesTab legajo={legajo} userRole={userRole} onRefresh={onRefresh} />}
        {activeTab === 'cdc' && <CdcTab legajo={legajo} userRole={userRole} onRefresh={onRefresh} />}
        {activeTab === 'escritos' && <EscritosTab legajo={legajo} userRole={userRole} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { empleadosApi } from '../api/client';
import { sileo } from 'sileo';
import './EmpleadosPage.css';

const STEPS = ['Archivo', 'Analizar', 'Descartar', 'Preview', 'Confirmar'];

const LOG_STATUS_LABELS = { completed: 'Completado', failed: 'Error', pending: 'Pendiente' };

export default function EmpleadosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!user || user.globalRole !== 'SUPERADMIN') {
      navigate('/sistemas', { replace: true });
      return;
    }
    empleadosApi.logs().then(setLogs).catch(() => setLogs([]));
  }, [user, navigate]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv' || f.type === 'text/plain')) {
      setFile(f);
      setAnalysis(null);
      setStep(0);
    } else if (f) {
      sileo.error({ title: 'Archivo no válido', description: 'Solo se permiten archivos CSV' });
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await empleadosApi.analyze(form);
      setAnalysis(res);
      setStep(1);
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleDiscardConfirm = () => {
    setStep(2);
  };

  const handleDiscardProceed = () => {
    setStep(3);
  };

  const handleImport = async () => {
    if (!analysis?.rows?.length) return;
    setImporting(true);
    try {
      await empleadosApi.import({
        file_name: analysis.file_name,
        rows: analysis.rows,
      });
      sileo.success({ title: 'Importación completada', description: `${analysis.rows.length} empleados importados` });
      setStep(0);
      setFile(null);
      setAnalysis(null);
      empleadosApi.logs().then(setLogs).catch(() => {});
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setAnalysis(null);
  };

  if (!user || user.globalRole !== 'SUPERADMIN') return null;

  return (
    <AppLayout>
      <div className="empleados-page">
        <header className="empleados-header">
          <h1>Empleados municipales</h1>
          <p>Importar empleados desde archivo CSV</p>
        </header>

        <div className="empleados-wizard">
          <div className="empleados-wizard-steps">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`empleados-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              >
                <span className="empleados-step-num">{i + 1}</span>
                <span className="empleados-step-label">{label}</span>
                {i < STEPS.length - 1 && <span className="empleados-step-line" />}
              </div>
            ))}
          </div>

          <div className="empleados-wizard-content">
            {step === 0 && (
              <div className="empleados-upload">
                <label className="empleados-upload-zone">
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleFileChange}
                    className="empleados-upload-input"
                  />
                  <span className="empleados-upload-text">
                    {file ? file.name : 'Arrastrá un CSV o hacé clic para seleccionar'}
                  </span>
                  <span className="empleados-upload-hint">Archivos .csv hasta 10 MB</span>
                </label>
                <button
                  type="button"
                  className="empleados-btn-primary"
                  onClick={handleAnalyze}
                  disabled={!file || importing}
                >
                  {importing ? 'Analizando...' : 'Analizar archivo'}
                </button>
              </div>
            )}

            {step === 1 && analysis && (
              <div className="empleados-analyze">
                <div className="empleados-stats">
                  <div className="empleados-stat">
                    <span className="empleados-stat-value">{analysis.rows_count}</span>
                    <span className="empleados-stat-label">Nuevos en CSV</span>
                  </div>
                  <div className="empleados-stat">
                    <span className="empleados-stat-value">{analysis.existing_count}</span>
                    <span className="empleados-stat-label">Existentes en DB</span>
                  </div>
                </div>
                <p className="empleados-warn">
                  La importación reemplazará todos los empleados actuales por los del CSV.
                </p>
                <div className="empleados-actions">
                  <button type="button" className="empleados-btn-ghost" onClick={reset}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="empleados-btn-primary"
                    onClick={handleDiscardConfirm}
                  >
                    Descartar existentes y continuar
                  </button>
                </div>
              </div>
            )}

            {step === 2 && analysis && (
              <div className="empleados-discard">
                <p className="empleados-discard-text">
                  Se reemplazarán <strong>{analysis.existing_count}</strong> empleados actuales por{' '}
                  <strong>{analysis.rows_count}</strong> del CSV. ¿Continuar?
                </p>
                <div className="empleados-actions">
                  <button type="button" className="empleados-btn-ghost" onClick={() => setStep(1)}>
                    Volver
                  </button>
                  <button
                    type="button"
                    className="empleados-btn-primary"
                    onClick={handleDiscardProceed}
                  >
                    Sí, descartar y ver preview
                  </button>
                </div>
              </div>
            )}

            {step === 3 && analysis && (
              <div className="empleados-preview">
                <p className="empleados-preview-title">
                  Preview: {analysis.rows.length} empleados a insertar
                </p>
                <div className="empleados-table-wrap">
                  <table className="empleados-table">
                    <thead>
                      <tr>
                        <th>DNI</th>
                        <th>Legajo</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rows.slice(0, 20).map((r, i) => (
                        <tr key={i}>
                          <td>{r.dni}</td>
                          <td>{r.legajo}</td>
                          <td>{r.email || '—'}</td>
                          <td>{r.telefono || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {analysis.rows.length > 20 && (
                    <p className="empleados-preview-more">
                      ... y {analysis.rows.length - 20} más
                    </p>
                  )}
                </div>
                <div className="empleados-actions">
                  <button type="button" className="empleados-btn-ghost" onClick={() => setStep(2)}>
                    Volver
                  </button>
                  <button
                    type="button"
                    className="empleados-btn-primary"
                    onClick={() => setStep(4)}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {step === 4 && analysis && (
              <div className="empleados-confirm">
                <p className="empleados-confirm-text">
                  ¿Confirmar importación? Se insertarán <strong>{analysis.rows.length}</strong> empleados.
                </p>
                <div className="empleados-actions">
                  <button type="button" className="empleados-btn-ghost" onClick={() => setStep(3)}>
                    Volver
                  </button>
                  <button
                    type="button"
                    className="empleados-btn-primary"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? 'Importando...' : 'Confirmar e importar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {logs.length > 0 && (
          <section className="empleados-logs">
            <h3>Historial de importaciones</h3>
            <div className="empleados-logs-list">
              {logs.map((log) => (
                <div key={log.id} className={`empleados-log-item empleados-log-${log.status}`}>
                  <div className="empleados-log-main">
                    <span className="empleados-log-file">{log.file_name}</span>
                    <span className="empleados-log-status">{LOG_STATUS_LABELS[log.status] || log.status}</span>
                  </div>
                  <div className="empleados-log-meta">
                    {(log.rows_inserted ?? 0)} insertados · {log.user || '—'} ·{' '}
                    {new Date(log.created_at).toLocaleString('es-AR')}
                  </div>
                  {log.error_message && (
                    <p className="empleados-log-error">{log.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}

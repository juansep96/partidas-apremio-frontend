import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import { backupApi } from '../api/client';
import { sileo } from 'sileo';
import './BackupPage.css';

export default function BackupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  if (!user || user.globalRole !== 'SUPERADMIN') {
    navigate('/sistemas', { replace: true });
    return null;
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await backupApi.download();
      sileo.success({ title: 'Backup descargado', description: 'El archivo cifrado se ha descargado correctamente.' });
    } catch (err) {
      sileo.error({ title: 'Error al generar backup', description: err.message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AppLayout>
      <div className="backup-page">
        <header className="backup-header">
          <h1>Copia de seguridad</h1>
          <p>Genera una copia cifrada de la base de datos para guardarla de forma segura.</p>
        </header>

        <section className="backup-card">
          <div className="backup-card-body">
            <p className="backup-description">
              El backup incluye toda la información de la base de datos y se descarga cifrado con AES-256.
              Guarda el archivo en un lugar seguro. Para restaurar, necesitarás la misma clave de aplicación (APP_KEY) del entorno.
            </p>
            <button
              type="button"
              className="backup-btn"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Generando...' : 'Generar y descargar backup'}
            </button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

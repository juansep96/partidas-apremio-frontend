import AppLayout from '../components/AppLayout';
import './EstadisticasDesarrolloSocialPage.css';

export default function EstadisticasDesarrolloSocialPage() {
  return (
    <AppLayout>
      <div className="estadisticas-ds-page">
        <header className="estadisticas-ds-header">
          <h1>Estadísticas</h1>
          <p>Visualización de datos y métricas del módulo Desarrollo Social</p>
        </header>
        <div className="estadisticas-ds-content">
          <div className="estadisticas-ds-placeholder">
            <span className="estadisticas-ds-icon">📊</span>
            <p>Contenido en desarrollo.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

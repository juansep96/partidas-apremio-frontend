import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import './SistemaPage.css';

export default function SistemaPage() {
  const { id } = useParams();
  const { systems } = useAuth();
  const navigate = useNavigate();

  const system = systems?.find((s) => s.id === id);
  const modules = system?.modules || [];

  const handleSelectModule = (mod) => {
    if (mod.enabled === false) return;
    navigate(mod.route);
  };

  if (!system) {
    return (
      <AppLayout>
        <div className="sistema-page">
          <p>Sistema no encontrado.</p>
          <button onClick={() => navigate('/sistemas')}>Volver</button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="sistema-page">
        <header className="sistema-header">
          <h1>{system.name}</h1>
          {system.description && <p>{system.description}</p>}
        </header>

        <div className="modulos-grid">
          {modules.map((mod) => (
            <button
              key={mod.id}
              className={`modulo-card ${mod.enabled === false ? 'modulo-card-disabled' : ''}`}
              onClick={() => handleSelectModule(mod)}
              disabled={mod.enabled === false}
            >
              {mod.enabled === false && (
                <span className="modulo-badge-proximamente">Próximamente</span>
              )}
              <div className="modulo-icon">
                {mod.logo ? (
                  <img src={mod.logo} alt="" />
                ) : (
                  <span className="modulo-initial">{mod.name[0]}</span>
                )}
              </div>
              <h3>{mod.name}</h3>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

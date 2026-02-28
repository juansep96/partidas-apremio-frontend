import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import './SistemasPage.css';

export default function SistemasPage() {
  const { user, systems } = useAuth();
  const navigate = useNavigate();

  const handleSelectSystem = (system) => {
    if (system.modules?.length === 1) {
      navigate(system.modules[0].route);
    } else {
      navigate(`/sistema/${system.id}`);
    }
  };

  return (
    <AppLayout>
      <div className="sistemas-page">
        <header className="sistemas-header">
          <h1>Elegí el sistema</h1>
          <p>Hola, {user?.botname || user?.firstName}. Seleccioná el sistema al que querés acceder.</p>
        </header>

        <div className="sistemas-grid">
          {systems?.map((system) => (
            <button
              key={system.id}
              className="sistema-card"
              onClick={() => handleSelectSystem(system)}
            >
              <div className="sistema-card-logo">
                {system.logo ? (
                  <img src={system.logo} alt={system.name} />
                ) : (
                  <span className="sistema-initial">{system.name[0]}</span>
                )}
              </div>
              <div className="sistema-card-content">
                <h3>{system.name}</h3>
                {system.description && <p>{system.description}</p>}
              </div>
              <span className="sistema-card-arrow" aria-hidden>→</span>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import './DesarrolloSocialPage.css';

export default function DesarrolloSocialPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="desarrollo-social-page">
        <header className="desarrollo-social-header">
          <h1>Desarrollo Social</h1>
          <p>Gestión de programas y asistencia social municipal (Monte Hermoso y Sauce Grande)</p>
        </header>

        <div className="desarrollo-social-content">
          <div className="desarrollo-social-welcome">
            <p>Bienvenido/a, {user?.botname || user?.firstName}.</p>
            <p className="desarrollo-social-hint">Este módulo permite gestionar programas sociales, beneficiarios y asistencia municipal.</p>
          </div>

          <div className="desarrollo-social-grid">
            <NavLink to="/desarrollo-social/encuestas" className="desarrollo-social-card desarrollo-social-card--link" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="desarrollo-social-card-icon">📋</div>
              <h3>Encuestas Sociales</h3>
              <p>Encuestas realizadas a personas titulares</p>
            </NavLink>
            <div className="desarrollo-social-card desarrollo-social-card--placeholder">
              <div className="desarrollo-social-card-icon">📊</div>
              <h3>Programas sociales</h3>
              <p>Próximamente: gestión de programas y beneficios</p>
            </div>
            <div className="desarrollo-social-card desarrollo-social-card--placeholder">
              <div className="desarrollo-social-card-icon">👥</div>
              <h3>Beneficiarios</h3>
              <p>Próximamente: vinculación con personas y programas</p>
            </div>
            {user?.globalRole === 'SUPERADMIN' && (
              <button
                type="button"
                className="desarrollo-social-card desarrollo-social-card--link"
                onClick={() => navigate('/admin/personas')}
              >
                <div className="desarrollo-social-card-icon">📂</div>
                <h3>Personas</h3>
                <p>Administrar personas (titulares y grupos familiares)</p>
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import AssistantBot from './AssistantBot';
import './AppLayout.css';

function ConfigIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const LOGO_URL = '/logo.png';

function formatRole(role) {
  if (!role) return 'Usuario';
  const map = { SUPERADMIN: 'Superadmin', ADMIN: 'Administrador', USER: 'Usuario' };
  return map[role] || role;
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const now = useLiveClock();
  const [configOpen, setConfigOpen] = useState(false);
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const settings = useSettings();

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Usuario';
  const role = formatRole(user?.globalRole);
  const initial = (user?.lastName?.[0] || user?.firstName?.[0] || 'U').toUpperCase();

  useEffect(() => {
    if (!configOpen && !configMenuOpen) return;
    const onEscape = (e) => {
      if (e.key === 'Escape') {
        setConfigOpen(false);
        setConfigMenuOpen(false);
      }
    };
    const onClickOutside = (e) => {
      if (e.target.closest('.app-config-panel') == null && e.target.closest('.app-config-btn') == null) setConfigOpen(false);
      if (e.target.closest('.app-config-menu-panel') == null && e.target.closest('.app-config-menu-btn') == null) setConfigMenuOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    document.addEventListener('click', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('click', onClickOutside);
    };
  }, [configOpen, configMenuOpen]);

  return (
    <div className="app-layout">
      <header className="app-navbar">
        <div className="app-navbar-left">
          <button
            className="app-logo-btn"
            onClick={() => navigate('/sistemas')}
            type="button"
            aria-label="Ir a inicio"
          >
            <img src={LOGO_URL} alt="SIGEMI" className="app-logo-img" />
          </button>

          <nav className="app-nav">
            <NavLink
              to="/sistemas"
              className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
              end
            >
              Inicio
            </NavLink>
            {user?.globalRole === 'SUPERADMIN' && (
              <NavLink
                to="/admin/usuarios"
                className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
              >
                Usuarios
              </NavLink>
            )}
            {user?.globalRole === 'SUPERADMIN' && (
              <NavLink
                to="/admin/auditoria"
                className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
              >
                Auditoría
              </NavLink>
            )}
            {user?.globalRole === 'SUPERADMIN' && (
              <div className="app-config-menu-wrap">
                <button
                  type="button"
                  className={`app-config-menu-btn app-nav-link ${configMenuOpen ? 'active' : ''}`}
                  onClick={() => setConfigMenuOpen((v) => !v)}
                  aria-expanded={configMenuOpen}
                  aria-haspopup="true"
                >
                  Configuraciones
                </button>
                {configMenuOpen && (
                  <div className="app-config-menu-panel" role="menu">
                    <NavLink
                      to="/admin/empleados"
                      className={({ isActive }) => `app-config-menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => setConfigMenuOpen(false)}
                    >
                      Empleados Municipales
                    </NavLink>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        <div className="app-navbar-right">
          <div className="app-config-wrap">
            <button
              type="button"
              className="app-config-btn"
              onClick={() => setConfigOpen((v) => !v)}
              aria-label="Configuración"
              aria-expanded={configOpen}
            >
              <ConfigIcon />
            </button>
            {configOpen && settings && (
              <div className="app-config-panel" role="dialog" aria-label="Configuración">
                <div className="app-config-title">Tamaño de fuente</div>
                <div className="app-config-font-controls">
                  <button
                    type="button"
                    className="app-config-font-btn"
                    onClick={settings.decreaseFontSize}
                    disabled={!settings.canDecrease}
                    aria-label="Disminuir tamaño"
                  >
                    −
                  </button>
                  <span className="app-config-font-label">{settings.fontScaleLabel}</span>
                  <button
                    type="button"
                    className="app-config-font-btn"
                    onClick={settings.increaseFontSize}
                    disabled={!settings.canIncrease}
                    aria-label="Aumentar tamaño"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="app-clock">
            <span className="app-clock-time">
              {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="app-clock-date">
              {now.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>

          <div className="app-user-pill">
            <div className="app-user-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt="" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="app-user-meta">
              <span className="app-user-name">{displayName}</span>
              <span className="app-user-role">{role}</span>
            </div>
          </div>

          <button type="button" className="app-logout-btn" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>

      <AssistantBot />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import AlertasBell from './recaudacion/AlertasBell';
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
  const { user, systems, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useLiveClock();
  const [configOpen, setConfigOpen] = useState(false);
  const settings = useSettings();

  const { id: sistemaId } = useParams();
  const isSistemaContext = location.pathname.startsWith('/sistema/') && sistemaId;
  const sistemaSystem = systems?.find((s) => s.id === sistemaId);
  const isSistemaAdmin = user?.globalRole === 'SUPERADMIN' || sistemaSystem?.role === 'ADMIN';
  const isRecaudacionContext = location.pathname.startsWith('/recaudacion');
  const recSystem = systems?.find(s => s.modules?.some(m => m.route === '/recaudacion'));
  const recRole = recSystem?.role;
  const isSuperAdmin = user?.globalRole === 'SUPERADMIN';

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Usuario';
  const role = formatRole(user?.globalRole);
  const initial = (user?.lastName?.[0] || user?.firstName?.[0] || 'U').toUpperCase();

  useEffect(() => {
    if (!configOpen) return;
    const onEscape = (e) => {
      if (e.key === 'Escape') setConfigOpen(false);
    };
    const onClickOutside = (e) => {
      if (e.target.closest('.app-config-panel') == null && e.target.closest('.app-config-btn') == null) setConfigOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    document.addEventListener('click', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.removeEventListener('click', onClickOutside);
    };
  }, [configOpen]);

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
            <img src={LOGO_URL} alt="MMH" className="app-logo-img" />
          </button>

          <nav className="app-nav">
            {isRecaudacionContext ? (
              <>
                <NavLink to="/recaudacion" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`} end>
                  Dashboard
                </NavLink>
                <NavLink to="/recaudacion/partidas" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                  Legajos
                </NavLink>
                {(isSuperAdmin || ['Recaudacion', 'Sistemas'].includes(recRole)) && (
                  <NavLink to="/recaudacion/intimaciones" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                    Intimaci&#243;n
                  </NavLink>
                )}
                {(isSuperAdmin || recRole === 'SecretarioLegal') && (
                  <NavLink to="/recaudacion/bandeja-secretario" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                    Bandeja Legal
                  </NavLink>
                )}
                {(isSuperAdmin || recRole === 'Abogado') && (
                  <NavLink to="/recaudacion/bandeja-abogado" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                    Mis Casos
                  </NavLink>
                )}
                {(isSuperAdmin || ['Recaudacion', 'Sistemas', 'SecretarioLegal', 'ObservadorGlobal'].includes(recRole)) && (
                  <NavLink to="/recaudacion/estadisticas" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                    Estad&#237;sticas
                  </NavLink>
                )}
              </>
            ) : isRecaudacionContext ? (
              <>
                <NavLink to="/recaudacion" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`} end>
                  Dashboard
                </NavLink>
                <NavLink to="/recaudacion/partidas" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                  Partidas
                </NavLink>
                <NavLink to="/recaudacion/bandeja-secretario" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                  Bandeja Secretario
                </NavLink>
                <NavLink to="/recaudacion/bandeja-abogado" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                  Bandeja Abogado
                </NavLink>
                <NavLink to="/recaudacion/intimaciones" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                  Intimaciones
                </NavLink>
                <NavLink to="/recaudacion/estadisticas" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                  Estad&#237;sticas
                </NavLink>
              </>
            ) : isSistemaContext ? (
              <>
                <NavLink to="/sistemas" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`} end>
                  Inicio
                </NavLink>
                {isSistemaAdmin ? (
                  <NavLink
                    to={`/sistema/${sistemaId}/auditoria`}
                    className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
                  >
                    Auditor&#237;a
                  </NavLink>
                ) : (
                  <span className="app-nav-link app-nav-link-disabled" inert>Auditor&#237;a</span>
                )}
              </>
            ) : (
              <>
                <NavLink to="/sistemas" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`} end>
                  Inicio
                </NavLink>
                {user?.globalRole === 'SUPERADMIN' && (
                  <NavLink to="/admin/usuarios" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                    Usuarios
                  </NavLink>
                )}
                {user?.globalRole === 'SUPERADMIN' && (
                  <NavLink to="/admin/auditoria" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
                    Auditor&#237;a
                  </NavLink>
                )}
              </>
            )}
          </nav>
        </div>

        <div className="app-navbar-right">
          {isRecaudacionContext && <AlertasBell />}
          <div className="app-config-wrap">
            <button
              type="button"
              className="app-config-btn"
              onClick={() => setConfigOpen((v) => !v)}
              aria-label="Configuraci&#243;n"
              aria-expanded={configOpen}
            >
              <ConfigIcon />
            </button>
            {configOpen && settings && (
              <div className="app-config-panel" role="dialog" aria-label="Configuraci&#243;n">
                <div className="app-config-title">Tama&#241;o de fuente</div>
                <div className="app-config-font-controls">
                  <button
                    type="button"
                    className="app-config-font-btn"
                    onClick={settings.decreaseFontSize}
                    disabled={!settings.canDecrease}
                    aria-label="Disminuir tama&#241;o"
                  >
                    &#8722;
                  </button>
                  <span className="app-config-font-label">{settings.fontScaleLabel}</span>
                  <button
                    type="button"
                    className="app-config-font-btn"
                    onClick={settings.increaseFontSize}
                    disabled={!settings.canIncrease}
                    aria-label="Aumentar tama&#241;o"
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
    </div>
  );
}

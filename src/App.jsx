import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Component } from 'react';
import { Toaster } from 'sileo';
import { AuthProvider, useAuth } from './context/AuthContext';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', color: '#ef4444', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <strong>Error de render:</strong>{'\n'}{this.state.error?.message}{'\n\n'}{this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}
import { SettingsProvider } from './context/SettingsContext';
import LoginPage from './pages/LoginPage';
import SistemasPage from './pages/SistemasPage';
import SistemaPage from './pages/SistemaPage';
import AdminUsuariosPage from './pages/AdminUsuariosPage';
import AuditoriaPage from './pages/AuditoriaPage';
import AuditoriaSistemaPage from './pages/AuditoriaSistemaPage';
import DashboardPage from './pages/recaudacion/DashboardPage';
import PartidaListPage from './pages/recaudacion/PartidaListPage';
import LegajoListPage from './pages/recaudacion/LegajoListPage';
import LegajoDetailPage from './pages/recaudacion/LegajoDetailPage';
import IntimacionPage from './pages/recaudacion/IntimacionPage';
import BandejaSecretarioPage from './pages/recaudacion/BandejaSecretarioPage';
import BandejaAbogadoPage from './pages/recaudacion/BandejaAbogadoPage';
import EstadisticasPage from './pages/recaudacion/EstadisticasPage';
import ChatbotWidget from './components/recaudacion/ChatbotWidget';

function SistemaAdminRoute({ children }) {
  const { id: sistemaId } = useParams();
  const { user, systems } = useAuth();
  const sistemaSystem = systems?.find((s) => s.id === sistemaId);
  const isSistemaAdmin = user?.globalRole === 'SUPERADMIN' || sistemaSystem?.role === 'ADMIN';
  if (!isSistemaAdmin) return <Navigate to={sistemaId ? `/sistema/${sistemaId}` : '/sistemas'} replace />;
  return children;
}

function RecaudacionRoute({ children, roles = [] }) {
  const { user, systems } = useAuth();
  const recSystem = systems?.find((s) => s.modules?.some((m) => m.route?.startsWith('/recaudacion')));
  const recRole = recSystem?.role;
  const isSuperAdmin = user?.globalRole === 'SUPERADMIN';
  if (!isSuperAdmin && !recRole) return <Navigate to="/recaudacion" replace />;
  if (roles.length > 0 && !isSuperAdmin && !roles.includes(recRole)) return <Navigate to="/recaudacion" replace />;
  return children;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Cargando...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/recaudacion" replace />;
  return children;
}

// El asistente solo se muestra con sesión iniciada (nunca en /login)
function AuthedChatbot() {
  const { user } = useAuth();
  if (!user) return null;
  return <ChatbotWidget />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <SettingsProvider>
        <Toaster position="top-right" />
        <BrowserRouter basename="/">
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/sistemas" element={<ProtectedRoute><SistemasPage /></ProtectedRoute>} />
            <Route path="/sistema/:id" element={<ProtectedRoute><SistemaPage /></ProtectedRoute>} />
            <Route path="/sistema/:id/auditoria" element={<ProtectedRoute><SistemaAdminRoute><AuditoriaSistemaPage /></SistemaAdminRoute></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/recaudacion" replace />} />

            {/* Módulo Recaudación y Apremio */}
            <Route path="/recaudacion" element={<ProtectedRoute><RecaudacionRoute><DashboardPage /></RecaudacionRoute></ProtectedRoute>} />
            <Route path="/recaudacion/partidas" element={<ProtectedRoute><RecaudacionRoute><PartidaListPage /></RecaudacionRoute></ProtectedRoute>} />
            <Route path="/recaudacion/legajos" element={<ProtectedRoute><RecaudacionRoute><LegajoListPage /></RecaudacionRoute></ProtectedRoute>} />
            <Route path="/recaudacion/legajos/:id" element={<ProtectedRoute><RecaudacionRoute><LegajoDetailPage /></RecaudacionRoute></ProtectedRoute>} />
            <Route path="/recaudacion/intimaciones" element={<ProtectedRoute><RecaudacionRoute roles={['Recaudacion','Sistemas']}><IntimacionPage /></RecaudacionRoute></ProtectedRoute>} />
            <Route path="/recaudacion/bandeja-secretario" element={<ProtectedRoute><RecaudacionRoute roles={['SecretarioLegal']}><BandejaSecretarioPage /></RecaudacionRoute></ProtectedRoute>} />
            <Route path="/recaudacion/bandeja-abogado" element={<ProtectedRoute><RecaudacionRoute roles={['Abogado']}><BandejaAbogadoPage /></RecaudacionRoute></ProtectedRoute>} />
            <Route path="/recaudacion/estadisticas" element={<ProtectedRoute><RecaudacionRoute><EstadisticasPage /></RecaudacionRoute></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin/usuarios" element={<ProtectedRoute><AdminUsuariosPage /></ProtectedRoute>} />
            <Route path="/admin/auditoria" element={<ProtectedRoute><AuditoriaPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/recaudacion" replace />} />
          </Routes>
          <AuthedChatbot />
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

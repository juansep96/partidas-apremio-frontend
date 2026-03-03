import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'sileo';
import { AuthProvider, useAuth } from './context/AuthContext';

/** Ruta solo accesible por ADMIN o SUPERADMIN en Desarrollo Social. Redirige a encuestas si es USER. */
function DsAdminRoute({ children }) {
  const { user, systems } = useAuth();
  const desarrolloSocialSystem = systems?.find((s) => s.modules?.some((m) => m.route === '/desarrollo-social/encuestas'));
  const isDsAdmin = user?.globalRole === 'SUPERADMIN' || desarrolloSocialSystem?.role === 'ADMIN';
  if (!isDsAdmin) return <Navigate to="/desarrollo-social/encuestas" replace />;
  return children;
}

/** Ruta solo accesible por ADMIN o SUPERADMIN del sistema. Redirige al inicio del sistema si es USER. */
function SistemaAdminRoute({ children }) {
  const { id: sistemaId } = useParams();
  const { user, systems } = useAuth();
  const sistemaSystem = systems?.find((s) => s.id === sistemaId);
  const isSistemaAdmin = user?.globalRole === 'SUPERADMIN' || sistemaSystem?.role === 'ADMIN';
  if (!isSistemaAdmin) return <Navigate to={sistemaId ? `/sistema/${sistemaId}` : '/sistemas'} replace />;
  return children;
}
import { SettingsProvider } from './context/SettingsContext';
import LoginPage from './pages/LoginPage';
import SistemasPage from './pages/SistemasPage';
import SistemaPage from './pages/SistemaPage';
import DashboardPage from './pages/DashboardPage';
import AdminUsuariosPage from './pages/AdminUsuariosPage';
import AuditoriaPage from './pages/AuditoriaPage';
import CamposDinamicosPage from './pages/CamposDinamicosPage';
import BarriosPage from './pages/BarriosPage';
import InstitucionesEducativasPage from './pages/InstitucionesEducativasPage';
import NacionalidadesPage from './pages/NacionalidadesPage';
import CiudadesPage from './pages/CiudadesPage';
import NivelesEducativosPage from './pages/NivelesEducativosPage';
import CallesPage from './pages/CallesPage';
import EmpleadosPage from './pages/EmpleadosPage';
import PersonasPage from './pages/PersonasPage';
import DesarrolloSocialPage from './pages/DesarrolloSocialPage';
import EstadisticasDesarrolloSocialPage from './pages/EstadisticasDesarrolloSocialPage';
import EncuestasSocialesPage from './pages/EncuestasSocialesPage';
import NuevaEncuestaWizardPage from './pages/NuevaEncuestaWizardPage';
import AuditoriaDesarrolloSocialPage from './pages/AuditoriaDesarrolloSocialPage';
import AuditoriaSistemaPage from './pages/AuditoriaSistemaPage';
import BackupPage from './pages/BackupPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/sistemas" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Toaster position="top-right" />
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/sistemas" element={<ProtectedRoute><SistemasPage /></ProtectedRoute>} />
          <Route path="/sistema/:id" element={<ProtectedRoute><SistemaPage /></ProtectedRoute>} />
          <Route path="/sistema/:id/auditoria" element={<ProtectedRoute><SistemaAdminRoute><AuditoriaSistemaPage /></SistemaAdminRoute></ProtectedRoute>} />
          <Route path="/sistema/:id/backup" element={<ProtectedRoute><SistemaAdminRoute><BackupPage /></SistemaAdminRoute></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/sistemas" replace />} />
          <Route path="/documentos" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social" element={<ProtectedRoute><DesarrolloSocialPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/encuestas" element={<ProtectedRoute><EncuestasSocialesPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/encuestas/nueva" element={<ProtectedRoute><NuevaEncuestaWizardPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/estadisticas" element={<ProtectedRoute><DsAdminRoute><EstadisticasDesarrolloSocialPage /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/auditoria" element={<ProtectedRoute><DsAdminRoute><AuditoriaDesarrolloSocialPage /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/campos-dinamicos" element={<ProtectedRoute><DsAdminRoute><CamposDinamicosPage desarrolloSocial /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/calles" element={<ProtectedRoute><DsAdminRoute><CallesPage desarrolloSocial /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/barrios" element={<ProtectedRoute><DsAdminRoute><BarriosPage desarrolloSocial /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/niveles-educativos" element={<ProtectedRoute><DsAdminRoute><NivelesEducativosPage desarrolloSocial /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/instituciones-educativas" element={<ProtectedRoute><DsAdminRoute><InstitucionesEducativasPage desarrolloSocial /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/nacionalidades" element={<ProtectedRoute><DsAdminRoute><NacionalidadesPage desarrolloSocial /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/ciudades" element={<ProtectedRoute><DsAdminRoute><CiudadesPage desarrolloSocial /></DsAdminRoute></ProtectedRoute>} />
          <Route path="/admin/usuarios" element={<ProtectedRoute><AdminUsuariosPage /></ProtectedRoute>} />
          <Route path="/admin/auditoria" element={<ProtectedRoute><AuditoriaPage /></ProtectedRoute>} />
          <Route path="/admin/backup" element={<ProtectedRoute><BackupPage /></ProtectedRoute>} />
          <Route path="/admin/personas" element={<ProtectedRoute><PersonasPage /></ProtectedRoute>} />
          <Route path="/admin/empleados" element={<ProtectedRoute><EmpleadosPage /></ProtectedRoute>} />
          <Route path="/admin/campos-dinamicos" element={<ProtectedRoute><CamposDinamicosPage /></ProtectedRoute>} />
          <Route path="/admin/calles" element={<ProtectedRoute><CallesPage /></ProtectedRoute>} />
          <Route path="/admin/barrios" element={<ProtectedRoute><BarriosPage /></ProtectedRoute>} />
          <Route path="/admin/niveles-educativos" element={<ProtectedRoute><NivelesEducativosPage /></ProtectedRoute>} />
          <Route path="/admin/instituciones-educativas" element={<ProtectedRoute><InstitucionesEducativasPage /></ProtectedRoute>} />
          <Route path="/admin/nacionalidades" element={<ProtectedRoute><NacionalidadesPage /></ProtectedRoute>} />
          <Route path="/admin/ciudades" element={<ProtectedRoute><CiudadesPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/sistemas" replace />} />
        </Routes>
      </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

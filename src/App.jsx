import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sileo';
import { AuthProvider, useAuth } from './context/AuthContext';
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
          <Route path="/sistema/:id/auditoria" element={<ProtectedRoute><AuditoriaSistemaPage /></ProtectedRoute>} />
          <Route path="/sistema/:id/backup" element={<ProtectedRoute><BackupPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/sistemas" replace />} />
          <Route path="/documentos" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social" element={<ProtectedRoute><DesarrolloSocialPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/encuestas" element={<ProtectedRoute><EncuestasSocialesPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/encuestas/nueva" element={<ProtectedRoute><NuevaEncuestaWizardPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/estadisticas" element={<ProtectedRoute><EstadisticasDesarrolloSocialPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/auditoria" element={<ProtectedRoute><AuditoriaDesarrolloSocialPage /></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/campos-dinamicos" element={<ProtectedRoute><CamposDinamicosPage desarrolloSocial /></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/calles" element={<ProtectedRoute><CallesPage desarrolloSocial /></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/barrios" element={<ProtectedRoute><BarriosPage desarrolloSocial /></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/niveles-educativos" element={<ProtectedRoute><NivelesEducativosPage desarrolloSocial /></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/instituciones-educativas" element={<ProtectedRoute><InstitucionesEducativasPage desarrolloSocial /></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/nacionalidades" element={<ProtectedRoute><NacionalidadesPage desarrolloSocial /></ProtectedRoute>} />
          <Route path="/desarrollo-social/config/ciudades" element={<ProtectedRoute><CiudadesPage desarrolloSocial /></ProtectedRoute>} />
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

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
import EmpleadosPage from './pages/EmpleadosPage';

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
          <Route path="/" element={<Navigate to="/sistemas" replace />} />
          <Route path="/documentos" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin/usuarios" element={<ProtectedRoute><AdminUsuariosPage /></ProtectedRoute>} />
          <Route path="/admin/auditoria" element={<ProtectedRoute><AuditoriaPage /></ProtectedRoute>} />
          <Route path="/admin/empleados" element={<ProtectedRoute><EmpleadosPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/sistemas" replace />} />
        </Routes>
      </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

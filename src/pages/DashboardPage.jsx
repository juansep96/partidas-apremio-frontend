import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="dashboard-page">
        <p>Bienvenido al sistema.</p>
        <button onClick={() => navigate('/sistemas')}>Ir a Home</button>
      </div>
    </AppLayout>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { sileo } from 'sileo';
import { alertasApi } from '../../api/recaudacionApi';
import './AlertasBell.css';

export default function AlertasBell() {
  const location = useLocation();
  const [alertas, setAlertas] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isRecaudacionContext = location.pathname.startsWith('/recaudacion');

  const cargar = async () => {
    try {
      const res = await alertasApi.list({ leida: 0, per_page: 20 });
      setAlertas(res.data || res || []);
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    if (!isRecaudacionContext) return;
    cargar();
    const id = setInterval(cargar, 60000);
    return () => clearInterval(id);
  }, [isRecaudacionContext]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const marcarLeida = async (id) => {
    try {
      await alertasApi.marcarLeida(id);
      setAlertas((prev) => prev.filter((a) => a.id !== id));
      sileo.success({ title: 'Alerta marcada como leída' });
    } catch (err) {
      sileo.error({ title: 'Error', description: err.message });
    }
  };

  if (!isRecaudacionContext) return null;

  const count = alertas.length;

  return (
    <div className="pj-bell-wrap" ref={dropdownRef}>
      <button
        type="button"
        className="pj-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Alertas${count > 0 ? ` (${count} sin leer)` : ''}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="pj-bell-badge">{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {open && (
        <div className="pj-bell-dropdown">
          <div className="pj-bell-dropdown-header">
            <span className="pj-bell-dropdown-title">Alertas</span>
            {count > 0 && <span className="pj-bell-dropdown-count">{count} sin leer</span>}
          </div>
          {alertas.length === 0 ? (
            <div className="pj-bell-empty">Sin alertas pendientes</div>
          ) : (
            <ul className="pj-bell-list">
              {alertas.map((alerta) => (
                <li key={alerta.id} className="pj-bell-item">
                  <div className="pj-bell-item-info">
                    <span className="pj-bell-item-tipo">{alerta.tipo || 'Alerta'}</span>
                    <span className="pj-bell-item-msg">{alerta.mensaje}</span>
                    {alerta.legajo?.partida?.nro_partida && (
                      <span className="pj-bell-item-partida">Partida: {alerta.legajo.partida.nro_partida}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="pj-bell-item-leer"
                    onClick={() => marcarLeida(alerta.id)}
                  >
                    ✓
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

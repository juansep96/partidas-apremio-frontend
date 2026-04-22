import EstadoBadge from './EstadoBadge';
import './LegajoTimeline.css';

function formatFecha(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function LegajoTimeline({ historial = [] }) {
  if (!historial.length) {
    return <div className="pj-timeline-empty">Sin historial registrado.</div>;
  }

  return (
    <div className="pj-timeline">
      {historial.map((item, idx) => {
        const nombre = [item.cambiado_por?.firstName, item.cambiado_por?.lastName].filter(Boolean).join(' ') || 'Sistema';
        const isFirst = !item.estado_anterior;
        return (
          <div key={item.id ?? idx} className="pj-timeline-item">
            <div className="pj-timeline-line" />
            <div className="pj-timeline-dot-wrap">
              <div className={`pj-timeline-dot ${isFirst ? 'pj-timeline-dot--first' : ''}`} />
            </div>
            <div className="pj-timeline-body">
              <div className="pj-timeline-header">
                {isFirst ? (
                  <EstadoBadge estado={item.estado_nuevo} />
                ) : (
                  <>
                    <EstadoBadge estado={item.estado_anterior} />
                    <span className="pj-timeline-arrow">→</span>
                    <EstadoBadge estado={item.estado_nuevo} />
                  </>
                )}
              </div>
              <div className="pj-timeline-meta">
                {formatFecha(item.created_at)} &middot; <span>{isFirst ? 'Creación' : nombre}</span>
                {!isFirst && nombre !== 'Sistema' && ` (${nombre})`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

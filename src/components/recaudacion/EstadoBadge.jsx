import './EstadoBadge.css';

const ESTADO_LABELS = {
  deuda_informada: 'Deuda Informada',
  en_intimacion: 'En Intimación',
  notificada: 'Notificada',
  rechazada: 'Rechazada',
  marcada_apremio: 'Marcada para Apremio',
  asignada_legales: 'Asignada a Legales',
  en_juicio: 'En Juicio',
  finalizada: 'Finalizada',
};

export default function EstadoBadge({ estado }) {
  const label = ESTADO_LABELS[estado] || estado || '—';
  return (
    <span className={`pj-estado-badge pj-estado-badge--${estado || 'desconocido'}`}>
      {label}
    </span>
  );
}

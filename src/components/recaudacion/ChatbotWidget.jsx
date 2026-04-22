import { useState, useEffect, useRef } from 'react';
import './ChatbotWidget.css';

/* ── Knowledge base ── */
const KNOWLEDGE = [
  {
    keywords: ['estado', 'estados', 'flujo', 'proceso'],
    answer: `El sistema maneja 8 estados en el flujo de apremio:
1. **Deuda Informada** — Partida importada, en revisión inicial
2. **En Intimación** — Se generó carta documento, esperando acuse
3. **Notificada** — El titular fue notificado exitosamente
4. **Marcada para Apremio** — Escalada para proceso judicial
5. **Asignada a Legales** — Abogado asignado por el secretario
6. **En Juicio** — Expediente judicial iniciado
7. **Finalizada** — Proceso completado
8. **Rechazada** — Carta documento rechazada por el titular`,
  },
  {
    keywords: ['carta', 'documento', 'intimacion', 'intimar'],
    answer: `Las cartas documento se generan en el módulo de **Intimaciones**.
El flujo es:
1. Ir a Intimaciones → aplicar filtros de segmentación
2. Seleccionar las partidas a intimar
3. Generar el lote de cartas documento
4. Descargar el PDF triplicado para envío
5. Una vez enviadas, registrar el acuse de recibo en el legajo`,
  },
  {
    keywords: ['acuse', 'acuses', 'notificacion', 'notificado'],
    answer: `El acuse de recibo se registra en el detalle del legajo cuando el legajo está en estado **En Intimación**.
- Si el resultado es "notificada": el legajo avanza a estado Notificada
- Si el resultado es "rechazada": el legajo pasa a estado Rechazada
- Adjuntar el PDF del acuse es opcional pero recomendado`,
  },
  {
    keywords: ['apremio', 'marcar', 'escalar'],
    answer: `Para marcar un legajo para apremio, el legajo debe estar en estado **Notificada** o **Rechazada**.
Esta acción la puede hacer el rol Sistemas.
Una vez marcado, aparece en la **Bandeja del Secretario** para que asigne un abogado.`,
  },
  {
    keywords: ['abogado', 'asignar', 'secretario'],
    answer: `La asignación de abogados la realiza el **Secretario Legal** desde su bandeja.
Solo aparecen los legajos en estado Marcada para Apremio.
Los abogados disponibles son los usuarios con rol Abogado en el sistema.`,
  },
  {
    keywords: ['juicio', 'expediente', 'iniciar'],
    answer: `Para iniciar el juicio, el abogado debe:
1. Ir al legajo asignado (estado Asignada a Legales)
2. Click en "Iniciar Juicio"
3. Ingresar número de expediente y fecha de inicio
4. El legajo pasa a estado En Juicio
Desde ese punto puede subir escritos judiciales y certificados de deuda.`,
  },
  {
    keywords: ['importar', 'txt', 'archivo', 'partidas'],
    answer: `Las partidas se importan desde **Partidas y Legajos → Importar TXT**.
El archivo debe ser .txt con formato pipe-delimitado:
\`nro_partida|titular_nombre|titular_dni|domicilio|zona|cp|capital|intereses|cuotas\`
- Una partida por línea
- Los duplicados se omiten automáticamente
- Se crea un legajo en estado Deuda Informada por cada partida importada`,
  },
  {
    keywords: ['manual', 'nueva partida', 'crear partida'],
    answer: `Para crear una partida manualmente:
1. Ir a Partidas y Legajos
2. Click en **+ Nueva partida**
3. Completar los campos (Nro. Partida, Titular y Capital son obligatorios)
La partida se crea directamente en estado Deuda Informada.`,
  },
  {
    keywords: ['rol', 'roles', 'permisos', 'acceso'],
    answer: `Los roles del sistema son:
- **Sistemas**: acceso total, importación de partidas, marcar apremio
- **Recaudación**: gestión de intimaciones y acuses
- **Secretario Legal**: asignación de abogados
- **Abogado**: gestión de juicios, escritos y certificados
- **Observador Global**: solo lectura
- **SUPERADMIN**: acceso completo`,
  },
  {
    keywords: ['exclusion', 'excluir', 'exclusiones'],
    answer: `Las exclusiones permiten omitir partidas de futuras intimaciones.
Se cargan desde **Intimaciones → Cargar exclusiones TXT**.
Formato: una línea por nro_partida a excluir.
Las partidas excluidas no aparecen en la segmentación de intimaciones.`,
  },
  {
    keywords: ['certificado', 'deuda', 'cdc'],
    answer: `El Certificado de Deuda (CDC) se genera para legajos **En Juicio**.
Lo genera el abogado desde el panel de documentos del legajo.
Incluye el monto capital + intereses a la fecha de corte especificada.`,
  },
  {
    keywords: ['hola', 'ayuda', 'help', 'que puedo', 'cómo'],
    answer: `¡Hola! Soy el asistente del sistema de **Partidas Judicializadas**.
Puedo ayudarte con:
• Flujo de estados del legajo
• Cómo generar cartas documento
• Registro de acuses de recibo
• Proceso de apremio judicial
• Importación y creación de partidas
• Roles y permisos
¿Sobre qué tema necesitás información?`,
  },
];

const FALLBACK =
  'No encontré información sobre eso. Podés preguntar sobre: estados del legajo, cartas documento, acuses, apremio, abogados, importación de partidas, roles y permisos.';

function getResponse(input) {
  const lower = input.toLowerCase();
  for (const item of KNOWLEDGE) {
    if (item.keywords.some(k => lower.includes(k))) {
      return item.answer;
    }
  }
  return FALLBACK;
}

/* ── Markdown renderer (bold + newlines) ── */
function renderMarkdown(text) {
  // Split on **...**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // render newlines as <br>
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

/* ── Initial greeting (reuse knowledge base entry) ── */
const INITIAL_ANSWER = KNOWLEDGE.find(k => k.keywords.includes('hola')).answer;

let msgIdCounter = 0;
function makeMsg(from, text, typing = false) {
  return { id: ++msgIdCounter, from, text, typing };
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const initializedRef = useRef(false);

  /* Show initial greeting when panel first opens */
  useEffect(() => {
    if (open && !initializedRef.current) {
      initializedRef.current = true;
      setMessages([makeMsg('bot', INITIAL_ANSWER)]);
    }
  }, [open]);

  /* Auto-scroll to latest message */
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  /* Focus input when panel opens */
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    setInput('');
    setMessages(prev => [...prev, makeMsg('user', trimmed)]);
    setIsTyping(true);

    setTimeout(() => {
      const answer = getResponse(trimmed);
      setIsTyping(false);
      setMessages(prev => [...prev, makeMsg('bot', answer)]);
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="pj-bot-widget">
      {/* ── Chat panel ── */}
      <div
        className={`pj-bot-panel ${open ? 'pj-bot-panel--open' : ''}`}
        aria-hidden={!open}
        role="dialog"
        aria-label="Asistente Partidas Judicializadas"
      >
        {/* Panel header */}
        <div className="pj-bot-header">
          <div className="pj-bot-header-info">
            <div className="pj-bot-header-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12c0-2.76 1.12-5.26 2.93-7.07" />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <div>
              <div className="pj-bot-header-name">Asistente PJ</div>
              <div className="pj-bot-header-status">
                <span className="pj-bot-status-dot" />
                En línea
              </div>
            </div>
          </div>
          <button
            type="button"
            className="pj-bot-close-btn"
            onClick={() => setOpen(false)}
            aria-label="Cerrar asistente"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="pj-bot-messages" role="log" aria-live="polite">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`pj-bot-bubble-wrap ${msg.from === 'user' ? 'pj-bot-bubble-wrap--user' : 'pj-bot-bubble-wrap--bot'}`}
            >
              {msg.from === 'bot' && (
                <div className="pj-bot-bubble-avatar">PJ</div>
              )}
              <div className={`pj-bot-bubble ${msg.from === 'user' ? 'pj-bot-bubble--user' : 'pj-bot-bubble--bot'}`}>
                {renderMarkdown(msg.text)}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="pj-bot-bubble-wrap pj-bot-bubble-wrap--bot">
              <div className="pj-bot-bubble-avatar">PJ</div>
              <div className="pj-bot-bubble pj-bot-bubble--bot pj-bot-bubble--typing">
                <span className="pj-bot-typing-dot" />
                <span className="pj-bot-typing-dot" />
                <span className="pj-bot-typing-dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="pj-bot-input-bar">
          <input
            ref={inputRef}
            type="text"
            className="pj-bot-input"
            placeholder="Escribí tu consulta…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            maxLength={300}
            aria-label="Mensaje al asistente"
          />
          <button
            type="button"
            className="pj-bot-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            aria-label="Enviar mensaje"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9l20-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Floating trigger button ── */}
      <button
        type="button"
        className={`pj-bot-trigger ${open ? 'pj-bot-trigger--active' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        aria-expanded={open}
      >
        {open ? (
          /* X icon when open */
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          /* Chat bubble icon when closed */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

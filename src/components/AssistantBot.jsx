import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { assistantApi } from '../api/client';
import './AssistantBot.css';

const STORAGE_WELCOMED_SESSION = 'SIDESO-assistant-welcomed-session';
const MAX_HISTORY = 20;

const RUTAS_PROHIBIDAS_USER = ['/desarrollo-social/estadisticas', '/desarrollo-social/auditoria', '/desarrollo-social/config'];

export default function AssistantBot() {
  const { user, systems } = useAuth();
  const desarrolloSocialSystem = systems?.find((s) => s.modules?.some((m) => m.route === '/desarrollo-social/encuestas'));
  const isDsAdmin = user?.globalRole === 'SUPERADMIN' || desarrolloSocialSystem?.role === 'ADMIN';
  const navigate = useNavigate();
  const [showWelcomeBubble, setShowWelcomeBubble] = useState(() => {
    try {
      return !sessionStorage.getItem(STORAGE_WELCOMED_SESSION);
    } catch {
      return false;
    }
  });
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    assistantApi.history(MAX_HISTORY).then((res) => {
      setMessages(res.messages || []);
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!showWelcomeBubble) {
      try {
        sessionStorage.setItem(STORAGE_WELCOMED_SESSION, '1');
      } catch (_) {}
    }
  }, [showWelcomeBubble]);

  const openChatAndDismissBubble = () => {
    setShowWelcomeBubble(false);
    setExpanded(true);
  };

  const dismissBubble = () => {
    setShowWelcomeBubble(false);
  };

  const labelNavegar = (ruta) => {
    const labels = {
      '/desarrollo-social': 'Ir al módulo Desarrollo Social',
      '/desarrollo-social/encuestas': 'Ir al módulo Encuestas Sociales',
      '/desarrollo-social/encuestas/nueva': 'Ir a Nueva Encuesta',
      '/desarrollo-social/estadisticas': 'Ir al módulo Estadísticas',
      '/desarrollo-social/auditoria': 'Ir al módulo Auditoría',
      '/desarrollo-social/config/campos-dinamicos': 'Ir a Configuración → Campos dinámicos',
      '/desarrollo-social/config/calles': 'Ir a Configuración → Calles',
      '/desarrollo-social/config/barrios': 'Ir a Configuración → Barrios',
      '/sistemas': 'Ir a Inicio',
    };
    if (labels[ruta]) return labels[ruta];
    if (ruta?.startsWith('/desarrollo-social/config/')) return 'Ir a Configuración';
    return 'Ir';
  };

  const accionPermitida = (accion) => {
    if (isDsAdmin) return true;
    if (accion.tipo === 'navegar' && accion.ruta) {
      return !RUTAS_PROHIBIDAS_USER.some((r) => accion.ruta?.startsWith(r));
    }
    if (accion.tipo === 'generar_cruce') return false;
    return true;
  };

  const ejecutarAccion = (accion) => {
    if (!accionPermitida(accion)) return;
    if (accion.tipo === 'navegar' && accion.ruta) {
      navigate(accion.ruta);
      return;
    }
    if (accion.tipo === 'generar_cruce' && accion.params?.campos_multi?.length >= 2) {
      navigate('/desarrollo-social/estadisticas', {
        state: { tab: 'cruces', generarCruce: accion.params },
      });
      return;
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);
    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { message, acciones } = await assistantApi.chat(text, history);

      setMessages((prev) => [...prev, { role: 'assistant', content: message, acciones }]);
    } catch (err) {
      let errMsg = err.message || 'Error al enviar';
      if (/rate limit|TPD|tokens per day/i.test(errMsg)) {
        errMsg = 'Se alcanzó el límite de uso del asistente por hoy. Intentá de nuevo más tarde o mañana.';
      }
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errMsg,
          acciones: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    try {
      await assistantApi.clearHistory();
    } catch (_) {}
    setMessages([]);
    setError(null);
  };

  if (!user) return null;

  const botName = user.botname || user.firstName || 'Asistente';
  const botAvatar = user.avatar;

  return (
    <div className={`assistant-bot ${!expanded && !showWelcomeBubble ? 'assistant-bot--collapsed' : 'assistant-bot--expanded'}`}>
      {expanded && (
        <div className="assistant-chat-panel">
          <div className="assistant-chat-header">
            <div className="assistant-chat-title">
              <span className="assistant-chat-avatar">
                {botAvatar ? <img src={botAvatar} alt="" /> : <span>{(botName[0] || 'A').toUpperCase()}</span>}
              </span>
              <div>
                <strong>{botName}</strong>
                <span className="assistant-chat-sub">Asistente SIDESO</span>
              </div>
            </div>
            <div className="assistant-chat-actions">
              <button type="button" className="assistant-btn-icon" onClick={clearChat} title="Borrar chat">
                🗑
              </button>
              <button type="button" className="assistant-btn-icon" onClick={() => setExpanded(false)} title="Cerrar">
                ×
              </button>
            </div>
          </div>
          <div className="assistant-chat-messages">
            {messages.length === 0 && (
              <div className="assistant-chat-welcome">
                <p>¡Hola! Soy {botName}, tu asistente.</p>
                <p>Puedo ayudarte con:</p>
                <ul>
                  <li>Cómo hacer tareas en el sistema</li>
                  {isDsAdmin && <li>Generar cruces dinámicos entre datos</li>}
                  <li>Explicar funciones y detectar errores</li>
                  <li>Información sobre encuestas, personas, asistencias</li>
                </ul>
                <p>¿En qué necesitás ayuda?</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`assistant-msg assistant-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <span className="assistant-msg-avatar">
                    {botAvatar ? <img src={botAvatar} alt="" /> : (botName[0] || 'A').toUpperCase()}
                  </span>
                )}
                <div className="assistant-msg-body">
                  <div className="assistant-msg-text">{m.content}</div>
                  {m.acciones?.filter(accionPermitida)?.length > 0 && (
                    <div className="assistant-msg-acciones">
                      {m.acciones.filter(accionPermitida).map((a, j) => (
                        <button
                          key={j}
                          type="button"
                          className="assistant-btn-accion"
                          onClick={() => ejecutarAccion(a)}
                        >
                          {a.tipo === 'navegar' ? labelNavegar(a.ruta) : a.tipo === 'generar_cruce' ? 'Generar cruce' : 'Ejecutar'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="assistant-msg assistant-msg--assistant">
                <span className="assistant-msg-avatar">{(botName[0] || 'A').toUpperCase()}</span>
                <div className="assistant-msg-body">
                  <div className="assistant-msg-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="assistant-chat-input-wrap">
            {error && <div className="assistant-chat-error">{error}</div>}
            <div className="assistant-chat-input-row">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí tu pregunta..."
                disabled={loading}
                maxLength={2000}
              />
              <button
                type="button"
                className="assistant-btn-send"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                aria-label="Enviar"
              >
                {loading ? '...' : '→'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWelcomeBubble && !expanded && (
        <div className="assistant-bubble">
          <button
            type="button"
            className="assistant-bubble-close"
            onClick={dismissBubble}
            aria-label="Cerrar"
          >
            ×
          </button>
          <p className="assistant-bubble-message">
            <strong>¡Bienvenido/a!</strong> Soy {botName}, tu asistente. Hacé clic abajo para empezar a chatear.
          </p>
          <button
            type="button"
            className="assistant-btn-accion"
            onClick={openChatAndDismissBubble}
            style={{ marginTop: '0.5rem' }}
          >
            Abrir chat
          </button>
        </div>
      )}

      <button
        type="button"
        className="assistant-bot-trigger"
        onClick={() => showWelcomeBubble ? openChatAndDismissBubble() : setExpanded((v) => !v)}
        aria-label={expanded ? 'Cerrar asistente' : 'Abrir asistente'}
        aria-expanded={expanded}
      >
        {botAvatar ? (
          <img src={botAvatar} alt={botName} />
        ) : (
          <span className="assistant-bot-initial">{(botName[0] || 'A').toUpperCase()}</span>
        )}
      </button>
    </div>
  );
}

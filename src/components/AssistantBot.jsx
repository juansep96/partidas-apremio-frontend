import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { assistantApi } from '../api/client';
import './AssistantBot.css';

const STORAGE_KEY = 'sigemi-assistant-bubble-open';
const STORAGE_MESSAGES = 'sigemi-assistant-messages';
const MAX_HISTORY = 20;

export default function AssistantBot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_MESSAGES);
      return v ? JSON.parse(v) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch (_) {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const labelNavegar = (ruta) => {
    const labels = {
      '/desarrollo-social/encuestas': 'Ir al módulo',
      '/desarrollo-social/estadisticas': 'Ir a Estadísticas',
      '/desarrollo-social': 'Ir al módulo',
    };
    return labels[ruta] || `Ir a ${ruta}`;
  };

  const ejecutarAccion = (accion) => {
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

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  if (!user) return null;

  const botName = user.botname || user.firstName || 'Asistente';
  const botAvatar = user.avatar;

  return (
    <div className={`assistant-bot ${!expanded ? 'assistant-bot--collapsed' : 'assistant-bot--expanded'}`}>
      {expanded && (
        <div className="assistant-chat-panel">
          <div className="assistant-chat-header">
            <div className="assistant-chat-title">
              <span className="assistant-chat-avatar">
                {botAvatar ? <img src={botAvatar} alt="" /> : <span>{(botName[0] || 'A').toUpperCase()}</span>}
              </span>
              <div>
                <strong>{botName}</strong>
                <span className="assistant-chat-sub">Asistente SIGEMI</span>
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
                  <li>Generar cruces dinámicos entre datos</li>
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
                  {m.acciones?.length > 0 && (
                    <div className="assistant-msg-acciones">
                      {m.acciones.map((a, j) => (
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

      <button
        type="button"
        className="assistant-bot-trigger"
        onClick={() => setExpanded((v) => !v)}
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

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './AssistantBot.css';

const STORAGE_KEY = 'sigemi-assistant-bubble-open';

export default function AssistantBot() {
  const { user } = useAuth();
  const [bubbleOpen, setBubbleOpen] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v !== 'false';
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(bubbleOpen));
    } catch (_) {}
  }, [bubbleOpen]);

  const toggleBubble = () => setBubbleOpen((v) => !v);
  const closeBubble = () => setBubbleOpen(false);

  if (!user) return null;

  const botName = user.botname || user.firstName || 'Asistente';
  const botAvatar = user.avatar;

  return (
    <div className={`assistant-bot ${!bubbleOpen ? 'assistant-bot--collapsed' : ''}`}>
      {bubbleOpen && (
        <div className="assistant-bubble">
          <button
            type="button"
            className="assistant-bubble-close"
            onClick={closeBubble}
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
          <p className="assistant-bubble-message">
            ¡Hola! Soy <strong>{botName}</strong>, tu asistente. ¿En qué puedo ayudarte?
          </p>
          <div className="assistant-bubble-tail" />
        </div>
      )}

      <button
        type="button"
        className="assistant-bot-trigger"
        onClick={toggleBubble}
        aria-label={bubbleOpen ? `Cerrar asistente ${botName}` : `Abrir asistente ${botName}`}
        aria-expanded={bubbleOpen}
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

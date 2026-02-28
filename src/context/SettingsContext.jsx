import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const FONT_SCALES = [
  { value: 0.875, label: 'Pequeño' },
  { value: 1, label: 'Normal' },
  { value: 1.125, label: 'Grande' },
  { value: 1.25, label: 'Muy grande' },
];

const STORAGE_KEY_PREFIX = 'sigemi-font-scale';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const storageKey = user ? `${STORAGE_KEY_PREFIX}-${user.id}` : `${STORAGE_KEY_PREFIX}-guest`;

  const [fontScale, setFontScaleState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseFloat(saved);
        if (Number.isFinite(n) && n >= 0.875 && n <= 1.25) return n;
      }
    } catch (_) {}
    return 1;
  });

  // Al cambiar de usuario, cargar su preferencia
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseFloat(saved);
        if (Number.isFinite(n) && n >= 0.875 && n <= 1.25) setFontScaleState(n);
      } else {
        setFontScaleState(1);
      }
    } catch (_) {
      setFontScaleState(1);
    }
  }, [storageKey]);

  // Persistir y aplicar al documento
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(fontScale));
    } catch (_) {}
    document.documentElement.style.setProperty('--app-font-scale', String(fontScale));
  }, [fontScale, storageKey]);

  const increaseFontSize = () => {
    const i = FONT_SCALES.findIndex((s) => s.value === fontScale);
    if (i < FONT_SCALES.length - 1) setFontScaleState(FONT_SCALES[i + 1].value);
  };

  const decreaseFontSize = () => {
    const i = FONT_SCALES.findIndex((s) => s.value === fontScale);
    if (i > 0) setFontScaleState(FONT_SCALES[i - 1].value);
  };

  const currentLabel = FONT_SCALES.find((s) => s.value === fontScale)?.label ?? 'Normal';

  return (
    <SettingsContext.Provider
      value={{
        fontScale,
        fontScaleLabel: currentLabel,
        increaseFontSize,
        decreaseFontSize,
        canIncrease: fontScale < 1.25,
        canDecrease: fontScale > 0.875,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  return ctx;
}

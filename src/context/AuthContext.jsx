import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')) || null);
  const [systems, setSystems] = useState(() => JSON.parse(localStorage.getItem('systems')) || []);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !user) {
      authApi.me()
        .then(({ user: u, systems: s }) => {
          setUser(u);
          setSystems(s);
          localStorage.setItem('user', JSON.stringify(u));
          localStorage.setItem('systems', JSON.stringify(s));
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setSystems(data.systems);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('systems', JSON.stringify(data.systems));
    setError(null);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('systems');
    localStorage.removeItem('SIDESO-assistant-messages');
    sessionStorage.removeItem('SIDESO-assistant-welcomed-session');
    setUser(null);
    setSystems([]);
  };

  return (
    <AuthContext.Provider value={{ user, systems, loading, error, setError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

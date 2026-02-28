const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('systems');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data.message || (data.errors && Object.values(data.errors).flat()[0]) || 'Error en la solicitud';
    throw new Error(msg);
  }
  return data;
}

export const authApi = {
  requestOtp: (dni) => apiRequest('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ dni }),
  }),
  verifyOtp: (dni, code) => apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ dni, code }),
  }),
  me: () => apiRequest('/me'),
  logout: () => apiRequest('/logout', { method: 'POST' }),
};

export const empleadosApi = {
  findByDni: (dni) => {
    const d = String(dni).replace(/\D/g, '');
    return apiRequest(`/admin/empleados?dni=${encodeURIComponent(d)}`);
  },
  analyze: async (formData) => {
    const token = getToken();
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/admin/empleados/analyze`, {
      method: 'POST',
      body: formData,
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('systems');
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }
    if (!res.ok) throw new Error(data.message || 'Error al analizar');
    return data;
  },
  import: (data) => apiRequest('/admin/empleados/import', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  logs: () => apiRequest('/admin/empleados/logs'),
};

export const auditApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/audit${sp ? `?${sp}` : ''}`);
  },
  get: (id) => apiRequest(`/admin/audit/${id}`),
  delete: (id) => apiRequest(`/admin/audit/${id}`, { method: 'DELETE' }),
};

export const usersApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/users${sp ? `?${sp}` : ''}`);
  },
  get: (id) => apiRequest(`/admin/users/${id}`),
  create: (data) => apiRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
  getSystems: () => apiRequest('/admin/systems'),
};

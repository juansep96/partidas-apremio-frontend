const API_BASE = import.meta.env.VITE_API_URL || '/api';
const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';

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

  const { timeout, ...fetchOptions } = options;
  let controller;
  if (timeout) {
    controller = new AbortController();
    fetchOptions.signal = controller.signal;
    setTimeout(() => controller?.abort(), timeout);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('systems');
    window.location.href = `${BASE_PATH}/login`;
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

export const sistemaAuditApi = (systemId) => ({
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/sistemas/${systemId}/audit${sp ? `?${sp}` : ''}`);
  },
  get: (logId) => apiRequest(`/sistemas/${systemId}/audit/${logId}`),
  delete: (logId) => apiRequest(`/sistemas/${systemId}/audit/${logId}`, { method: 'DELETE' }),
});

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

export const auditApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/audit${sp ? `?${sp}` : ''}`);
  },
  get: (id) => apiRequest(`/admin/audit/${id}`),
  delete: (id) => apiRequest(`/admin/audit/${id}`, { method: 'DELETE' }),
};

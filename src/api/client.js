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
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/empleados/list${sp ? `?${sp}` : ''}`);
  },
  create: (data) => apiRequest('/admin/empleados', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/empleados/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiRequest(`/admin/empleados/${id}`, { method: 'DELETE' }),
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

export const sistemaAuditApi = (systemId) => ({
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/sistemas/${systemId}/audit${sp ? `?${sp}` : ''}`);
  },
  get: (logId) => apiRequest(`/sistemas/${systemId}/audit/${logId}`),
  delete: (logId) => apiRequest(`/sistemas/${systemId}/audit/${logId}`, { method: 'DELETE' }),
});

export const backupApi = {
  download: async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/admin/backup`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('systems');
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error al generar el backup');
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition');
    const filename = cd?.match(/filename="?([^"]+)"?/)?.[1] || `sigemi-backup-${new Date().toISOString().slice(0, 10)}.enc`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const auditApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/audit${sp ? `?${sp}` : ''}`);
  },
  get: (id) => apiRequest(`/admin/audit/${id}`),
  delete: (id) => apiRequest(`/admin/audit/${id}`, { method: 'DELETE' }),
};

/** APIs para módulo Desarrollo Social (usa /ds/*, permite admin DS) */
export const dsApi = {
  audit: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/audit${sp ? `?${sp}` : ''}`);
    },
    get: (id) => apiRequest(`/ds/audit/${id}`),
    delete: (id) => apiRequest(`/ds/audit/${id}`, { method: 'DELETE' }),
  },
  camposDinamicos: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/campos-dinamicos${sp ? `?${sp}` : ''}`);
    },
    reorder: (appliesTo, ids) => apiRequest('/ds/campos-dinamicos/reorder', { method: 'POST', body: JSON.stringify({ appliesTo, ids }) }),
    toggleEnabled: (id) => apiRequest(`/ds/campos-dinamicos/${id}/toggle`, { method: 'POST' }),
    get: (id) => apiRequest(`/ds/campos-dinamicos/${id}`),
    create: (data) => apiRequest('/ds/campos-dinamicos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/ds/campos-dinamicos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  personas: {
    update: (id, data) => apiRequest(`/ds/personas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  calles: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/calles${sp ? `?${sp}` : ''}`);
    },
    export: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return fetch(`${API_BASE}/ds/calles/export${sp ? `?${sp}` : ''}`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      }).then((r) => {
        if (!r.ok) throw new Error('Error al exportar');
        return r.blob();
      }).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'calles.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    },
    create: (data) => apiRequest('/ds/calles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/ds/calles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    import: () => apiRequest('/ds/calles/import', { method: 'POST' }),
  },
  barrios: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/barrios${sp ? `?${sp}` : ''}`);
    },
    export: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return fetch(`${API_BASE}/ds/barrios/export${sp ? `?${sp}` : ''}`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      }).then((r) => {
        if (!r.ok) throw new Error('Error al exportar');
        return r.blob();
      }).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'barrios.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    },
    create: (data) => apiRequest('/ds/barrios', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/ds/barrios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  nivelesEducativos: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/niveles-educativos${sp ? `?${sp}` : ''}`);
    },
    create: (data) => apiRequest('/ds/niveles-educativos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/ds/niveles-educativos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  institucionesEducativas: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/instituciones-educativas${sp ? `?${sp}` : ''}`);
    },
    export: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return fetch(`${API_BASE}/ds/instituciones-educativas/export${sp ? `?${sp}` : ''}`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      }).then((r) => {
        if (!r.ok) throw new Error('Error al exportar');
        return r.blob();
      }).then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'instituciones-educativas.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    },
    create: (data) => apiRequest('/ds/instituciones-educativas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/ds/instituciones-educativas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  nacionalidades: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/nacionalidades${sp ? `?${sp}` : ''}`);
    },
    create: (data) => apiRequest('/ds/nacionalidades', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/ds/nacionalidades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  ciudades: {
    list: (params = {}) => {
      const sp = new URLSearchParams(params).toString();
      return apiRequest(`/ds/ciudades${sp ? `?${sp}` : ''}`);
    },
    create: (data) => apiRequest('/ds/ciudades', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiRequest(`/ds/ciudades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
};

export const padronApi = {
  buscar: (dni) => {
    const d = String(dni).replace(/\D/g, '');
    return apiRequest(`/admin/padron/buscar?dni=${encodeURIComponent(d)}`);
  },
};

export const personasApi = {
  findByDni: (dni) => {
    const d = String(dni).replace(/\D/g, '');
    return apiRequest(`/admin/personas/by-dni?dni=${encodeURIComponent(d)}`);
  },
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/personas${sp ? `?${sp}` : ''}`);
  },
  get: (id) => apiRequest(`/admin/personas/${id}`),
  create: (data) => apiRequest('/admin/personas', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/personas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiRequest(`/admin/personas/${id}`, { method: 'DELETE' }),
};

export const callesApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/calles${sp ? `?${sp}` : ''}`);
  },
  export: async (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/admin/calles/export${sp ? `?${sp}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calles.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
  create: (data) => apiRequest('/admin/calles', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/calles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  import: () => apiRequest('/admin/calles/import', { method: 'POST' }),
};

export const barriosApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/barrios${sp ? `?${sp}` : ''}`);
  },
  export: async (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/admin/barrios/export${sp ? `?${sp}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'barrios.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
  create: (data) => apiRequest('/admin/barrios', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/barrios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export const nivelesEducativosApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/niveles-educativos${sp ? `?${sp}` : ''}`);
  },
  create: (data) => apiRequest('/admin/niveles-educativos', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/niveles-educativos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export const institucionesEducativasApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/instituciones-educativas${sp ? `?${sp}` : ''}`);
  },
  export: async (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/admin/instituciones-educativas/export${sp ? `?${sp}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'instituciones-educativas.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
  create: (data) => apiRequest('/admin/instituciones-educativas', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/instituciones-educativas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export const nacionalidadesApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/nacionalidades${sp ? `?${sp}` : ''}`);
  },
  create: (data) => apiRequest('/admin/nacionalidades', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/nacionalidades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export const ciudadesApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/ciudades${sp ? `?${sp}` : ''}`);
  },
  create: (data) => apiRequest('/admin/ciudades', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/ciudades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export const opcionesTablaApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/opciones-tabla${sp ? `?${sp}` : ''}`);
  },
};

export const encuestasSocialesApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/encuestas-sociales${sp ? `?${sp}` : ''}`);
  },
  titularesList: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/encuestas-sociales/titulares-list${sp ? `?${sp}` : ''}`);
  },
  titulares: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/encuestas-sociales/titulares${sp ? `?${sp}` : ''}`);
  },
  campos: () => apiRequest('/encuestas-sociales/campos'),
  get: (id) => apiRequest(`/encuestas-sociales/${id}`),
  create: (data) => apiRequest('/encuestas-sociales', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/encuestas-sociales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => apiRequest(`/encuestas-sociales/${id}`, { method: 'DELETE' }),
  pdfUrl: (id) => {
    const base = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('token');
    return `${base}/encuestas-sociales/${id}/pdf` + (token ? `?token=${encodeURIComponent(token)}` : '');
  },
  descargarPdf: async (id) => {
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${base}/encuestas-sociales/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Error al descargar PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encuesta-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
  enviarWhatsapp: (id, telefono) => apiRequest(`/encuestas-sociales/${id}/enviar-whatsapp`, {
    method: 'POST',
    body: JSON.stringify({ telefono }),
    timeout: 90000,
  }),
  enviarEmail: (id, email) => apiRequest(`/encuestas-sociales/${id}/enviar-email`, {
    method: 'POST',
    body: JSON.stringify({ email }),
    timeout: 60000,
  }),
  // Wizard nueva encuesta
  wizardPersonaBuscar: (dni) => {
    const d = String(dni).replace(/\D/g, '');
    return apiRequest(`/encuestas-sociales/wizard/persona-buscar?dni=${encodeURIComponent(d)}`);
  },
  wizardPadronBuscar: (dni) => {
    const d = String(dni).replace(/\D/g, '');
    return apiRequest(`/encuestas-sociales/wizard/padron-buscar?dni=${encodeURIComponent(d)}`);
  },
  wizardPersonaGuardar: (data) => apiRequest('/encuestas-sociales/wizard/persona-guardar', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  wizardCamposTitular: () => apiRequest('/encuestas-sociales/wizard/campos-titular'),
  wizardCamposGrupo: () => apiRequest('/encuestas-sociales/wizard/campos-grupo'),
  wizardPersonasBuscar: (q) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    return apiRequest(`/encuestas-sociales/wizard/personas-buscar${sp.toString() ? `?${sp}` : ''}`);
  },
  wizardGrupoAgregar: (personaId, titularId) => apiRequest('/encuestas-sociales/wizard/grupo-agregar', {
    method: 'POST',
    body: JSON.stringify({ personaId, titularId }),
  }),
  wizardGrupoQuitar: (personaId) => apiRequest('/encuestas-sociales/wizard/grupo-quitar', {
    method: 'POST',
    body: JSON.stringify({ personaId }),
  }),
};

export const camposDinamicosApi = {
  list: (params = {}) => {
    const sp = new URLSearchParams(params).toString();
    return apiRequest(`/admin/campos-dinamicos${sp ? `?${sp}` : ''}`);
  },
  reorder: (appliesTo, ids) => apiRequest('/admin/campos-dinamicos/reorder', {
    method: 'POST',
    body: JSON.stringify({ appliesTo, ids }),
  }),
  toggleEnabled: (id) => apiRequest(`/admin/campos-dinamicos/${id}/toggle`, { method: 'POST' }),
  get: (id) => apiRequest(`/admin/campos-dinamicos/${id}`),
  create: (data) => apiRequest('/admin/campos-dinamicos', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiRequest(`/admin/campos-dinamicos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
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

import { apiRequest } from './client';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';

function getToken() {
  return localStorage.getItem('token');
}

function handle401AndThrow(res, data) {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('systems');
    window.location.href = `${BASE_PATH}/login`;
    throw new Error('Sesión expirada');
  }
  if (!res.ok) throw new Error(data.message || 'Error en la solicitud');
}

async function fetchFormData(url, formData) {
  const token = getToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${url}`, { method: 'POST', body: formData, headers });
  const data = await res.json().catch(() => ({}));
  handle401AndThrow(res, data);
  return data;
}

export const partidaApi = {
  list: (params = {}) => apiRequest(`/pj/partidas?${new URLSearchParams(params)}`),
  preview: (params = {}) => apiRequest(`/pj/partidas/preview-segmentacion?${new URLSearchParams(params)}`),
  excluirTxt: (formData) => fetchFormData('/pj/partidas/excluir-txt', formData),
  crearManual: (data) => apiRequest('/pj/partidas/manual', { method: 'POST', body: JSON.stringify(data) }),
};

// Proceso 1 — Padrón (datos maestros). preview = dry-run con diff; confirmar = aplica.
export const padronApi = {
  preview: (formData) => fetchFormData('/pj/padron/preview', formData),
  confirmar: (token) => apiRequest('/pj/padron/confirmar', { method: 'POST', body: JSON.stringify({ token }) }),
};

// Proceso 2 — TSU/.DAT. preview = vista previa sin escribir (devuelve items+token);
// confirmar = crea legajos solo para los nro_partida seleccionados.
export const apremioApi = {
  preview: (formData) => fetchFormData('/pj/apremio/preview', formData),
  confirmar: (token, cargar) => apiRequest('/pj/apremio/confirmar', { method: 'POST', body: JSON.stringify({ token, cargar }) }),
};

export const legajoApi = {
  list: (params = {}) => apiRequest(`/pj/legajos?${new URLSearchParams(params)}`),
  get: (id) => apiRequest(`/pj/legajos/${id}`),
  marcarApremio: (id, data) => apiRequest(`/pj/legajos/${id}/marcar-apremio`, { method: 'POST', body: JSON.stringify(data) }),
  asignarAbogado: (id, data) => apiRequest(`/pj/legajos/${id}/asignar-abogado`, { method: 'POST', body: JSON.stringify(data) }),
  iniciarJuicio: (id, data) => apiRequest(`/pj/legajos/${id}/iniciar-juicio`, { method: 'POST', body: JSON.stringify(data) }),
  ampliarDemanda: (id, data) => apiRequest(`/pj/legajos/${id}/ampliar-demanda`, { method: 'POST', body: JSON.stringify(data) }),
  finalizar: (id, data) => apiRequest(`/pj/legajos/${id}/finalizar`, { method: 'POST', body: JSON.stringify(data) }),
  confirmarDesbloqueo: (id, data) => apiRequest(`/pj/legajos/${id}/confirmar-desbloqueo`, { method: 'POST', body: JSON.stringify(data) }),
  subirAcuse: (id, formData) => fetchFormData(`/pj/legajos/${id}/acuse`, formData),
  downloadCartaDocumento: async (id) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/pj/legajos/${id}/carta-documento`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('systems');
      window.location.href = `${BASE_PATH}/login`;
      throw new Error('Sesión expirada');
    }
    if (!res.ok) throw new Error('Error al generar carta documento');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carta-documento-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const loteApi = {
  list: (params = {}) => apiRequest(`/pj/lotes-intimacion?${new URLSearchParams(params)}`),
  create: (data) => apiRequest('/pj/lotes-intimacion', { method: 'POST', body: JSON.stringify(data) }),
  download: async (id) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/pj/lotes-intimacion/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('systems');
      window.location.href = `${BASE_PATH}/login`;
      throw new Error('Sesión expirada');
    }
    if (!res.ok) throw new Error('Error al descargar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lote-intimacion-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const cdcApi = {
  create: (formData) => fetchFormData('/pj/certificados-deuda', formData),
  getPdfUrl: (id) => `${API_BASE}/pj/certificados-deuda/${id}/pdf`,
  download: async (id) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/pj/certificados-deuda/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('systems');
      window.location.href = `${BASE_PATH}/login`;
      throw new Error('Sesión expirada');
    }
    if (!res.ok) throw new Error('Error al descargar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificado-deuda-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const escritosApi = {
  list: (legajoId) => apiRequest(`/pj/legajos/${legajoId}/escritos`),
  upload: (legajoId, formData) => fetchFormData(`/pj/legajos/${legajoId}/escritos`, formData),
};

export const alertasApi = {
  list: (params = {}) => apiRequest(`/pj/alertas?${new URLSearchParams(params)}`),
  marcarLeida: (id) => apiRequest(`/pj/alertas/${id}/leer`, { method: 'PUT' }),
};

function buildQuery(params) {
  if (!params) return '';
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return q ? '?' + q : '';
}

export const estadisticasApi = {
  resumen: (params) => apiRequest('/pj/estadisticas' + buildQuery(params)),
  tendencia: (params) => apiRequest('/pj/estadisticas/tendencia' + buildQuery(params)),
  porZona: (params) => apiRequest('/pj/estadisticas/zonas' + buildQuery(params)),
  funnel: (params) => apiRequest('/pj/estadisticas/funnel' + buildQuery(params)),
  metricasLegales: (params) => apiRequest('/pj/metricas-legales' + buildQuery(params)),
};

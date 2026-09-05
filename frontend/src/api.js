// Thin API client for the JalDrishti backend. Uses same-origin relative URLs
// (Vite proxies /api, /images, /uploads to the backend in dev).

async function req(path, options = {}) {
  const res = await fetch(path, options);
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (body && body.error) || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return body;
}

export const api = {
  health: () => req('/api/health'),
  mode: () => req('/api/mode'),

  // Sites
  listSites: () => req('/api/sites'),
  getSite: (id) => req(`/api/sites/${id}`),
  interventionTypes: () => req('/api/sites/meta/intervention-types'),
  createSite: (data) =>
    req('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateSite: (id, data) =>
    req(`/api/sites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteSite: (id) => req(`/api/sites/${id}`, { method: 'DELETE' }),

  // Satellite observations
  fetchObservation: (id, date, force = false) =>
    req(`/api/sites/${id}/observations/fetch${force ? '?force=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    }),
  deleteObservation: (obsId) => req(`/api/observations/${obsId}`, { method: 'DELETE' }),

  // Photos
  listPhotos: (id) => req(`/api/sites/${id}/photos`),
  uploadPhoto: (id, formData) =>
    req(`/api/sites/${id}/photos`, { method: 'POST', body: formData }),
  deletePhoto: (photoId) => req(`/api/photos/${photoId}`, { method: 'DELETE' }),

  // GIS layers (watershed boundaries, streams, water bodies, structures)
  geo: () => req('/api/geo'),

  // Dashboard
  dashboard: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString();
    return req(`/api/dashboard${qs ? `?${qs}` : ''}`);
  },
};

export const TREND_COLORS = {
  green: '#1a9850',
  yellow: '#e0b300',
  red: '#d73027',
  grey: '#9aa0a6',
};

export const TREND_LABEL_COLORS = {
  Improving: '#1a9850',
  Stable: '#e0b300',
  Declining: '#d73027',
  'Insufficient data': '#9aa0a6',
};

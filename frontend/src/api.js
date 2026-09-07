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
  config: () => req('/api/config'),
  activity: (limit = 12) => req(`/api/activity?limit=${limit}`),

  // Sites
  listSites: () => req('/api/sites'),
  getSite: (id) => req(`/api/sites/${id}`),
  landuse: (id) => req(`/api/sites/${id}/landuse`),
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

  // Analyze an uploaded GeoTIFF (compute NDVI/NDWI from its bands)
  analyzeImagery: (id, formData) => req(`/api/sites/${id}/analyze`, { method: 'POST', body: formData }),
  // Land cover: classify an uploaded ESA WorldCover / Dynamic World raster
  uploadLandcover: (id, formData) => req(`/api/sites/${id}/landcover`, { method: 'POST', body: formData }),
  deleteLandcover: (id) => req(`/api/sites/${id}/landcover`, { method: 'DELETE' }),

  // Photos
  allPhotos: () => req('/api/photos'),
  listPhotos: (id) => req(`/api/sites/${id}/photos`),
  uploadPhoto: (id, formData) =>
    req(`/api/sites/${id}/photos`, { method: 'POST', body: formData }),
  deletePhoto: (photoId) => req(`/api/photos/${photoId}`, { method: 'DELETE' }),

  // GIS layers (watershed boundaries, streams, water bodies, structures)
  geo: () => req('/api/geo'),
  siteGeoStatus: (id) => req(`/api/sites/${id}/geo`),
  uploadSiteGeo: (id, formData) => req(`/api/sites/${id}/geo`, { method: 'POST', body: formData }),
  deleteSiteGeo: (id) => req(`/api/sites/${id}/geo`, { method: 'DELETE' }),

  // Dashboard
  dashboard: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString();
    return req(`/api/dashboard${qs ? `?${qs}` : ''}`);
  },
};

export const TREND_COLORS = {
  green: '#2f8f5b',
  yellow: '#c2963a',
  red: '#bb5138',
  grey: '#99a29a',
};

export const TREND_LABEL_COLORS = {
  Improving: '#2f8f5b',
  Stable: '#c2963a',
  Declining: '#bb5138',
  'Insufficient data': '#99a29a',
};

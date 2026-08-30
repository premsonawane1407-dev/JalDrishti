import { useEffect, useState } from 'react';
import { api } from '../api.js';
import LocationPicker from './LocationPicker.jsx';

const EMPTY = {
  name: '',
  district: '',
  state: '',
  latitude: '',
  longitude: '',
  intervention_type: '',
  intervention_date: '',
  description: '',
};

export default function SiteForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(EMPTY);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.interventionTypes().then(setTypes).catch(() => setTypes(['Check-dam', 'Plantation', 'Pond', 'Other']));
  }, []);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? '',
        district: initial.district ?? '',
        state: initial.state ?? '',
        latitude: initial.latitude ?? '',
        longitude: initial.longitude ?? '',
        intervention_type: initial.intervention_type ?? '',
        intervention_date: (initial.intervention_date ?? '').slice(0, 10),
        description: initial.description ?? '',
      });
    } else {
      setForm(EMPTY);
    }
  }, [initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pick = (lat, lng) =>
    setForm((f) => ({ ...f, latitude: lat.toFixed(5), longitude: lng.toFixed(5) }));

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.district || !form.intervention_type) {
      setError('Name, district and intervention type are required.');
      return;
    }
    if (form.latitude === '' || form.longitude === '') {
      setError('Set coordinates — type them or click the map.');
      return;
    }
    onSubmit({
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      intervention_date: form.intervention_date || null,
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <div className="field full">
          <label>Site name *</label>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Hiware Bazar Watershed" />
        </div>
        <div className="field">
          <label>District *</label>
          <input value={form.district} onChange={set('district')} placeholder="e.g. Ahmednagar" />
        </div>
        <div className="field">
          <label>State</label>
          <input value={form.state} onChange={set('state')} placeholder="e.g. Maharashtra" />
        </div>
        <div className="field">
          <label>Intervention type *</label>
          <select value={form.intervention_type} onChange={set('intervention_type')}>
            <option value="">Select…</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Intervention date</label>
          <input type="date" value={form.intervention_date} onChange={set('intervention_date')} />
        </div>
        <div className="field">
          <label>Latitude *</label>
          <input value={form.latitude} onChange={set('latitude')} placeholder="19.1512" inputMode="decimal" />
        </div>
        <div className="field">
          <label>Longitude *</label>
          <input value={form.longitude} onChange={set('longitude')} placeholder="74.7215" inputMode="decimal" />
        </div>
        <div className="field full">
          <label>Pick location (click the map to set coordinates)</label>
          <LocationPicker lat={Number(form.latitude)} lng={Number(form.longitude)} onPick={pick} />
        </div>
        <div className="field full">
          <label>Description</label>
          <textarea value={form.description} onChange={set('description')} placeholder="Intervention details, notes…" />
        </div>
      </div>
      {error && <p style={{ color: '#d73027', fontSize: 13, marginTop: 12 }}>{error}</p>}
      <div className="btn-row" style={{ marginTop: 18 }}>
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? <span className="spinner" /> : null}
          {initial ? 'Save changes' : 'Create site'}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

import { Router } from 'express';
import { db } from '../db.js';

export const activityRouter = Router();

// A merged, reverse-chronological activity feed derived from real data:
// field-photo uploads, latest satellite readings, interventions, and site
// registrations. GET /api/activity?limit=15
activityRouter.get('/activity', (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
  const events = [];

  const sites = db.prepare('SELECT id, name, intervention_type, intervention_date, created_at FROM sites').all();
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  for (const p of db.prepare('SELECT * FROM photos').all()) {
    events.push({
      type: 'photo', icon: 'camera', site_id: p.site_id, site_name: siteName[p.site_id],
      title: 'Field image uploaded', sub: p.caption || siteName[p.site_id],
      date: p.taken_at || (p.created_at || '').slice(0, 10),
    });
  }

  // Latest satellite reading per site (avoid flooding with every observation).
  const latestObs = db.prepare(
    `SELECT o.* FROM observations o
     JOIN (SELECT site_id, MAX(observation_date) md FROM observations GROUP BY site_id) m
       ON m.site_id = o.site_id AND m.md = o.observation_date`
  ).all();
  for (const o of latestObs) {
    events.push({
      type: 'observation', icon: 'leaf', site_id: o.site_id, site_name: siteName[o.site_id],
      title: `Satellite reading · NDVI ${o.ndvi}`, sub: `${siteName[o.site_id]} · ${o.source}`,
      date: o.observation_date,
    });
  }

  for (const s of sites) {
    if (s.intervention_date) {
      events.push({
        type: 'intervention', icon: 'pin', site_id: s.id, site_name: s.name,
        title: `Intervention · ${s.intervention_type}`, sub: s.name, date: s.intervention_date,
      });
    }
  }

  events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json(events.slice(0, limit));
});

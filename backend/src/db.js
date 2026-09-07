import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'jaldrishti.db');
export const db = new DatabaseSync(dbPath);

// Pragmas for reliable concurrent-ish access in a dev/demo setting.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT    NOT NULL,
      district          TEXT    NOT NULL,
      state             TEXT    DEFAULT '',
      latitude          REAL    NOT NULL,
      longitude         REAL    NOT NULL,
      intervention_type TEXT    NOT NULL,
      intervention_date TEXT,
      description        TEXT    DEFAULT '',
      created_at        TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      filename      TEXT    NOT NULL,
      original_name TEXT    DEFAULT '',
      caption       TEXT    DEFAULT '',
      latitude      REAL,
      longitude     REAL,
      taken_at      TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS observations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id          INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      observation_date TEXT    NOT NULL,
      ndvi             REAL    NOT NULL,
      ndwi             REAL    NOT NULL,
      cloud_coverage   REAL    DEFAULT 0,
      image_filename   TEXT    DEFAULT '',
      source           TEXT    DEFAULT 'mock',
      created_at       TEXT    DEFAULT (datetime('now')),
      UNIQUE(site_id, observation_date)
    );

    CREATE TABLE IF NOT EXISTS site_geo (
      site_id     INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      geojson     TEXT    NOT NULL,
      source      TEXT    DEFAULT 'upload',
      updated_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_landcover (
      site_id      INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      distribution TEXT    NOT NULL,
      source       TEXT    DEFAULT 'worldcover',
      updated_at   TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_photos_site       ON photos(site_id);
    CREATE INDEX IF NOT EXISTS idx_obs_site          ON observations(site_id);
    CREATE INDEX IF NOT EXISTS idx_obs_site_date     ON observations(site_id, observation_date);
  `);
}

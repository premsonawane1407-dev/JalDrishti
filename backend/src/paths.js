import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = join(__dirname, '..');
export const DATA_DIR = join(ROOT_DIR, 'data');
export const IMAGES_DIR = join(DATA_DIR, 'images'); // generated NDVI heatmaps
export const UPLOADS_DIR = join(ROOT_DIR, 'uploads'); // user-uploaded field photos

for (const dir of [DATA_DIR, IMAGES_DIR, UPLOADS_DIR]) {
  mkdirSync(dir, { recursive: true });
}

// Generates a per-site watershed PDF report with pdfkit (pure Node, no browser).
// Contents: site metadata, trend verdict, NDVI/NDWI chart (drawn), latest
// satellite heatmap, observations table, and field photos.

import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGES_DIR, UPLOADS_DIR } from '../paths.js';

const BRAND = '#0d5c75';
const INK = '#16232e';
const SOFT = '#5b6b78';
const LINE = '#d9e2e8';
const TREND_COLOR = { Improving: '#1a9850', Stable: '#e0b300', Declining: '#d73027', 'Insufficient data': '#9aa0a6' };

const PAGE = { w: 595.28, h: 841.89, margin: 48 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;

export function streamSiteReport(res, site) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, info: { Title: `JalDrishti report — ${site.name}` } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="jaldrishti-${slug(site.name)}.pdf"`);
  doc.pipe(res);

  let y = header(doc, site);
  y = trendBox(doc, site, y + 6);
  y = chartAndHeatmap(doc, site, y + 18);
  y = observationsTable(doc, site, y + 18);
  photos(doc, site, y + 18);
  footer(doc, site);

  doc.end();
}

// ---------------------------------------------------------------------------

function header(doc, site) {
  const { margin } = PAGE;
  doc.save();
  doc.rect(0, 0, PAGE.w, 92).fill(BRAND);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('JalDrishti', margin, 24);
  doc.font('Helvetica').fontSize(10).fillColor('#dbeef3').text('Watershed Geospatial Monitoring — Site Report', margin, 50);
  doc.font('Helvetica').fontSize(9).fillColor('#dbeef3')
    .text(`Generated ${new Date().toISOString().slice(0, 10)}`, margin, 66);
  doc.restore();

  let y = 112;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(17).text(site.name, margin, y);
  y = doc.y + 2;
  doc.font('Helvetica').fontSize(10).fillColor(SOFT).text(
    `${site.district}${site.state ? ', ' + site.state : ''}  •  ${site.intervention_type}` +
      `${site.intervention_date ? '  •  intervention ' + site.intervention_date : ''}` +
      `  •  ${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`,
    margin, y, { width: CONTENT_W }
  );
  y = doc.y;
  if (site.description) {
    doc.fontSize(9.5).fillColor(INK).text(site.description, margin, y + 4, { width: CONTENT_W });
    y = doc.y;
  }
  return y;
}

function trendBox(doc, site, y) {
  const { margin } = PAGE;
  const t = site.trend;
  const color = TREND_COLOR[t.label] || SOFT;
  const h = 58;
  doc.save();
  doc.roundedRect(margin, y, CONTENT_W, h, 8).fill('#f4f7f9');
  doc.roundedRect(margin, y, 6, h, 3).fill(color);
  // Verdict
  doc.fillColor(color).font('Helvetica-Bold').fontSize(15).text(t.label, margin + 18, y + 12);
  const pct = t.ndviChangePct;
  doc.fillColor(INK).font('Helvetica').fontSize(10).text(
    pct == null ? 'Not enough data' : `${pct > 0 ? '+' : ''}${pct}% NDVI change`,
    margin + 18, y + 33
  );
  // Metrics on the right
  const cols = [
    ['Baseline NDVI', t.baseline ? `${t.baseline.ndvi}  (${t.baseline.observation_date})` : '—'],
    ['Latest NDVI', t.latest ? `${t.latest.ndvi}  (${t.latest.observation_date})` : '—'],
    ['Observations', String(site.observations.length)],
  ];
  let cx = margin + 190;
  const colW = (CONTENT_W - 190) / cols.length;
  for (const [label, val] of cols) {
    doc.fillColor(SOFT).font('Helvetica').fontSize(8).text(label.toUpperCase(), cx, y + 12, { width: colW - 8 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text(val, cx, y + 26, { width: colW - 8 });
    cx += colW;
  }
  doc.restore();
  return y + h;
}

function chartAndHeatmap(doc, site, y) {
  const { margin } = PAGE;
  const gap = 16;
  const chartW = CONTENT_W * 0.58;
  const heatW = CONTENT_W - chartW - gap;

  sectionTitle(doc, 'NDVI & NDWI over time', margin, y);
  sectionTitle(doc, 'Latest satellite NDVI', margin + chartW + gap, y);
  const top = y + 16;

  const chartH = 150;
  drawChart(doc, margin, top, chartW, chartH, site.observations);

  // Heatmap (SVG) for the latest observation.
  const latest = site.observations[site.observations.length - 1];
  const heatH = chartH;
  doc.save().roundedRect(margin + chartW + gap, top, heatW, heatH, 6).lineWidth(0.8).stroke(LINE).restore();
  if (latest?.image_filename) {
    tryEmbedSvg(doc, join(IMAGES_DIR, latest.image_filename), margin + chartW + gap + 6, top + 6, heatW - 12, heatH - 22);
    doc.fillColor(SOFT).font('Helvetica').fontSize(7.5).text(
      `${latest.observation_date} • NDVI ${latest.ndvi} • NDWI ${latest.ndwi} • ${latest.source}`,
      margin + chartW + gap + 6, top + heatH - 13, { width: heatW - 12 }
    );
  } else {
    doc.fillColor(SOFT).fontSize(9).text('No imagery', margin + chartW + gap, top + heatH / 2 - 4, { width: heatW, align: 'center' });
  }
  return top + chartH;
}

function drawChart(doc, x, y, w, h, obs) {
  doc.save();
  doc.roundedRect(x, y, w, h, 6).lineWidth(0.8).stroke(LINE);
  const pad = { l: 30, r: 10, t: 10, b: 18 };
  const px = x + pad.l, py = y + pad.t;
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  const ymin = -0.4, ymax = 0.9;
  const toY = (v) => py + ph - ((v - ymin) / (ymax - ymin)) * ph;

  // Gridlines + y labels
  doc.font('Helvetica').fontSize(6.5).fillColor(SOFT);
  for (const gv of [-0.4, 0, 0.4, 0.8]) {
    const gy = toY(gv);
    doc.moveTo(px, gy).lineTo(px + pw, gy).lineWidth(0.4).stroke('#eef2f5');
    doc.fillColor(SOFT).text(gv.toFixed(1), x + 4, gy - 4, { width: pad.l - 6, align: 'right' });
  }

  if (!obs || obs.length === 0) {
    doc.fillColor(SOFT).fontSize(9).text('No observations', x, y + h / 2 - 4, { width: w, align: 'center' });
    doc.restore();
    return;
  }

  const n = obs.length;
  const stepX = n > 1 ? pw / (n - 1) : 0;
  const ptX = (i) => px + (n > 1 ? i * stepX : pw / 2);

  const drawSeries = (key, color, dash) => {
    doc.save().strokeColor(color).lineWidth(1.4);
    if (dash) doc.dash(3, { space: 2 });
    obs.forEach((o, i) => {
      const X = ptX(i), Y = toY(o[key]);
      if (i === 0) doc.moveTo(X, Y);
      else doc.lineTo(X, Y);
    });
    doc.stroke();
    doc.undash().restore();
    // dots
    doc.save().fillColor(color);
    obs.forEach((o, i) => doc.circle(ptX(i), toY(o[key]), 1.6).fill());
    doc.restore();
  };
  drawSeries('ndvi', '#1a9850', false);
  drawSeries('ndwi', '#2c7fb8', true);

  // x labels (first / mid / last)
  doc.font('Helvetica').fontSize(6).fillColor(SOFT);
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i) => {
    if (i < 0) return;
    doc.text(obs[i].observation_date.slice(0, 7), ptX(i) - 14, y + h - 12, { width: 28, align: 'center' });
  });

  // legend
  doc.fontSize(7);
  doc.fillColor('#1a9850').text('— NDVI', px + 4, py + 2);
  doc.fillColor('#2c7fb8').text('-- NDWI', px + 44, py + 2);
  doc.restore();
}

function observationsTable(doc, site, y) {
  const { margin } = PAGE;
  y = ensureSpace(doc, y, 40 + Math.min(site.observations.length, 12) * 16);
  sectionTitle(doc, 'Observation history', margin, y);
  y += 18;

  const cols = [
    { k: 'observation_date', label: 'Date', w: 0.24 },
    { k: 'ndvi', label: 'NDVI', w: 0.16 },
    { k: 'ndwi', label: 'NDWI', w: 0.16 },
    { k: 'cloud_coverage', label: 'Cloud %', w: 0.18 },
    { k: 'source', label: 'Source', w: 0.26 },
  ];
  // header row
  doc.save().rect(margin, y, CONTENT_W, 18).fill('#eef3f5');
  let cx = margin + 8;
  doc.fillColor(SOFT).font('Helvetica-Bold').fontSize(8);
  cols.forEach((c) => { doc.text(c.label.toUpperCase(), cx, y + 5, { width: c.w * CONTENT_W - 8 }); cx += c.w * CONTENT_W; });
  doc.restore();
  y += 18;

  doc.font('Helvetica').fontSize(9).fillColor(INK);
  site.observations.forEach((o, idx) => {
    y = ensureSpace(doc, y, 18, () => { /* header repeat skipped for brevity */ });
    if (idx % 2 === 1) doc.save().rect(margin, y, CONTENT_W, 16).fill('#fafcfd').restore();
    cx = margin + 8;
    doc.fillColor(INK);
    cols.forEach((c) => {
      const v = c.k === 'cloud_coverage' ? `${o[c.k]}%` : String(o[c.k]);
      doc.text(v, cx, y + 4, { width: c.w * CONTENT_W - 8 });
      cx += c.w * CONTENT_W;
    });
    y += 16;
  });
  return y;
}

function photos(doc, site, y) {
  if (!site.photos.length) return y;
  const { margin } = PAGE;
  y = ensureSpace(doc, y, 160);
  sectionTitle(doc, 'Field photos', margin, y);
  y += 18;

  const gap = 14;
  const cardW = (CONTENT_W - gap) / 2;
  const cardH = 120;
  site.photos.slice(0, 2).forEach((p, i) => {
    const x = margin + i * (cardW + gap);
    doc.save().roundedRect(x, y, cardW, cardH, 6).lineWidth(0.8).stroke(LINE).restore();
    const path = join(UPLOADS_DIR, p.filename);
    if (p.filename.toLowerCase().endsWith('.svg')) {
      tryEmbedSvg(doc, path, x + 4, y + 4, cardW - 8, cardH - 26);
    } else {
      try { doc.image(path, x + 4, y + 4, { fit: [cardW - 8, cardH - 26], align: 'center' }); }
      catch { doc.fillColor(SOFT).fontSize(8).text('image unavailable', x, y + cardH / 2, { width: cardW, align: 'center' }); }
    }
    doc.fillColor(INK).font('Helvetica').fontSize(8).text(
      `${p.caption || 'Field photo'} — ${p.taken_at || ''}`,
      x + 4, y + cardH - 18, { width: cardW - 8, ellipsis: true }
    );
  });
  return y + cardH;
}

function footer(doc, site) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Zero the bottom margin so writing near the page bottom doesn't trigger
    // pdfkit's auto page-break (the classic "footer adds a blank page" gotcha).
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor(SOFT).text(
      `JalDrishti • Satellite data source: ${site.observations[0]?.source || 'mock'} • ` +
        'Sample/demo data where labelled • Page ' + (i + 1) + ' of ' + range.count,
      PAGE.margin, PAGE.h - 34, { width: CONTENT_W, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = savedBottom;
  }
}

// ---------------------------------------------------------------------------

function sectionTitle(doc, text, x, y) {
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(11).text(text, x, y);
}

function tryEmbedSvg(doc, path, x, y, w, h) {
  try {
    const svg = readFileSync(path, 'utf8');
    SVGtoPDF(doc, svg, x, y, { width: w, height: h, assumePt: true, preserveAspectRatio: 'xMidYMid meet' });
  } catch {
    doc.save().fillColor(SOFT).font('Helvetica').fontSize(8).text('preview unavailable', x, y + h / 2 - 4, { width: w, align: 'center' }).restore();
  }
}

// Add a page if there isn't `need` vertical space left; returns the y to use.
function ensureSpace(doc, y, need) {
  if (y + need > PAGE.h - PAGE.margin) {
    doc.addPage();
    return PAGE.margin;
  }
  return y;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'site';
}

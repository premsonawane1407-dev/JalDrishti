# Testing JalDrishti with a real satellite GeoTIFF

The **"Analyze your own satellite image (GeoTIFF)"** panel (on any site's detail
page) computes NDVI/NDWI from a real satellite image. This note explains where to
get a suitable file and **which band numbers to type in**.

> **TL;DR (easiest path):** In **Copernicus Browser / EO Browser**, download the
> **NDVI** layer as a **32-bit float GeoTIFF**, upload it, and leave the band
> boxes as they are — a single-band file is treated as ready-made NDVI.

---

## What the tool needs

One GeoTIFF (`.tif`) that contains **either**:
- a single band that is already NDVI (easiest), **or**
- at least the **Red** and **Near-Infrared (NIR)** bands (so it can compute NDVI).

Keep the area small (a few km across) so the file stays under the **80 MB** limit,
and pick a **low-cloud** date. Resolution doesn't matter — the tool resamples
internally. NDVI is a ratio, so it doesn't matter whether values are raw digital
numbers or reflectance.

The band-to-satellite mapping you'll need:

| Index | Sentinel-2 | Landsat 8/9 |
|---|---|---|
| **Red** | B04 | B4 |
| **NIR** | B08 | B5 |
| **Green** (optional, for NDWI) | B03 | B3 |

---

## Option A — EO Browser / Copernicus Browser (recommended, free, no install)

1. Go to **https://browser.dataspace.copernicus.eu** (Copernicus Browser) or
   **https://apps.sentinel-hub.com/eo-browser** and sign in (free account).
2. Search over one of our demo sites (coordinates below), pick **Sentinel-2 L2A**
   and a recent **low-cloud** date.
3. Zoom to a small area around the site.
4. Open the **download / "Analytical"** panel and choose:
   - **Image format:** TIFF (32-bit float)
   - **Layer:** either **NDVI** (→ single-band file, *easiest*) **or** the **raw
     bands** you need.

### Which band numbers to enter after download
- **You downloaded the NDVI layer (1 band):** upload it and **ignore** the band
  boxes — a single band is read directly as NDVI.
- **You downloaded a Red + NIR file (2 bands, in that order):** **Red = 1, NIR = 2.**
- **You downloaded a "true colour + NIR" file** with band order B02, B03, B04, B08
  (Blue, Green, Red, NIR): **Green = 2, Red = 3, NIR = 4.**

> The rule: **band number = the position of that band in the file.** If you chose
> the bands yourself, enter them in the order you selected. If unsure, download the
> **NDVI** single-band product and skip the band boxes entirely.

---

## Option B — SRISHTI-DRISHTI (the PS's own platform)

If you have access to the **SRISHTI-DRISHTI** portal (the DoLR/NRSC platform named
in the problem statement), export a small NDVI or multi-band clip as GeoTIFF and
follow the same band rules above. This is the most "on-brief" data source.

## Option C — USGS EarthExplorer (Landsat)

**https://earthexplorer.usgs.gov** → Landsat 8/9 Level-2. Use Red = B4, NIR = B5.
If you get a single multi-band file, enter the band positions accordingly.

---

## Demo-site coordinates (to choose an area over a real project)

| Site | Lat | Lon |
|---|---|---|
| Hiware Bazar Watershed (Ahmednagar, MH) | 19.1512 | 74.7215 |
| Ralegan Siddhi Watershed (Ahmednagar, MH) | 18.9812 | 74.6790 |
| Arvari River Catchment (Alwar, RJ) | 27.5620 | 76.6050 |
| Anantapur Dryland Block (Anantapur, AP) | 14.6810 | 77.6000 |
| Jhabua Micro-Watershed (Jhabua, MP) | 22.7700 | 74.5900 |

---

## What happens after you upload

The server reads the GeoTIFF, computes NDVI (and NDWI if a green band is given),
renders a heatmap from the actual pixels, and saves it as an **observation** for
that date. It immediately appears in the site's **chart**, **heatmap timeline**,
**trend label**, and **PDF report** — no manual GIS step.

**Troubleshooting**
- *"No valid pixels"* → the band numbers are wrong for your file, or the area is
  all no-data/cloud. Try the NDVI single-band download.
- *NDVI looks flat/near zero* → you likely picked the wrong Red/NIR bands; swap the
  numbers to match your file's band order.
- *File rejected* → it must be `.tif`/`.tiff` and under 80 MB (shrink the area).

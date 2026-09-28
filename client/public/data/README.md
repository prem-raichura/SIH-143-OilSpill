# Static data bundle: SIH 26143 oil-spill investigation demo

Everything the website needs, precomputed offline by `Dataset/build/` (no model runs in the browser).
Coordinates are WGS84 lon/lat. Times are UTC ISO 8601. Speeds are knots unless stated.

## Index

| File | Content |
|---|---|
| `cases.json` | One entry per incident: id, kind, region, image time, labels (REAL/SYNTHETIC), verdict summary, folder |
| `shared/benchmark.json` | Synthetic benchmark: thresholds, tuning + held-out metrics with 95 % Wilson intervals, comparison methods, trade-off curve |
| `shared/gallery/gallery.json` | 36 Zenodo Part III tiles (12 oil, 12 look-alike, 12 clean): `image` PNG, `mask` overlay PNG, `bounds_wgs84` |
| `shared/land_*.geojson`, `eez.geojson`, `ports.geojson`, `platforms.geojson` | Map layers |

## Per case (`<case>/`)

| File | Content |
|---|---|
| `meta.json` | Provenance and reproducibility: Sentinel-1 product id and times, forcing dataset ids, physics config, labels, verdict |
| `sar_quicklook.png` | Calibrated VV sigma0 (dB), geocoded, gray + alpha. Place it with `meta.satellite.bounds` = [west, south, east, north]. Real cases only |
| `sar_targets.geojson` | Bright point targets (simple CFAR, not validated). `platform: true` = matches a known platform |
| `slick.geojson` | Slick outline. `properties`: area, length, width, elongation, compactness, components, orientation, taper, `edge_truncated`, wind, `age_prior_h` (weak), `shape_indicator` |
| `corridor.geojson` | `kind: age` polygons (where the oil was N hours before the image), `release_corridor` (union over the age prior), `expanded_corridor_for_veto` |
| `drift_frames.json` | Animation. `backward.frames[h]` = particle lon/lat h hours before the image (10 members x 30). `forward.frames[h]` = OpenOil elements h hours after (null = removed) |
| `forecast.geojson` | 24/48/72 h `forecast_envelope` polygons, `stranded` points; `properties.mass_budget_fraction` (hourly surface/evaporated/dispersed), `coastal_impact` |
| `forcing_arrows.json` | 0.5 deg grid, 3-hourly current (SMOC circulation + tide) and ERA5 wind vectors (m/s) |
| `ais_tracks.geojson` | LineStrings with `role` (leading / candidate / eliminated / background), `t_offset_s` (seconds from image time per vertex), `sog`, `synthetic` |
| `ledger.json` | Investigation Ledger (see below) |
| `monitoring.json` | Post-incident events for every shortlisted vessel. Context only, never changes the verdict |

### `ledger.json`

- `verdict.code`: 1 not oil, 2 insufficient data, 3 leading candidate, 4 multiple plausible, 5 no consistent AIS vessel (+ `probable_source`). Checked in that order; exactly one per case.
- `candidates[]` (top 30, sorted by `score`): `items[]` = evidence for (+) and against (-) with `weight x value x reliability = contribution`; `screening` (drift-corrected distance, sigma), `confirmation` (FSS, centroid, orientation, release window), `best_fit_release_time`, `rank1_share` (rank stability over 50 perturbed runs), `band` (High/Medium/Low, synthetic-calibrated: never a real-world probability).
- `candidates_summary`, `candidates_not_listed`: lower-ranked vessels.
- `eliminated[]`: vessels removed by the only hard rule (continuous AIS, no spoofing flags, cannot reach the corridor even at 25 kn), each with `why_not`.
- `why_not[]`: short reasons for every non-leading candidate.
- `ais_coverage.score`: share of time nearby vessels have a known position; below `threshold` gives verdict 2.
- `scenario_key` (synthetic cases): the answer and the automatic `outcome`. Hide it until the user clicks "reveal".
- `disclaimer`: candidates are analytical associations from public data, not evidence of wrongdoing.

## Labels to show in the UI

- SYNTHETIC AIS: every Indian case (free raw Indian AIS is unavailable; the PS permits synthetic data).
- SIMULATED SLICK: IN-S1, IN-S2, IN-S3, IN-R1 (no satellite image).
- Benchmark numbers: always "synthetic".

// Fails the build if a case listed in cases.json is missing a required file or has invalid JSON.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../public/data");
const errors = [];
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    errors.push(`${p}: ${e.message}`);
    return null;
  }
};

const index = readJson(resolve(root, "cases.json"));
if (!index) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const required = [
  "meta.json", "ledger.json", "monitoring.json", "slick.geojson", "corridor.geojson",
  "drift_frames.json", "forecast.geojson", "forcing_arrows.json", "ais_tracks.geojson",
];
for (const c of index.cases) {
  const dir = resolve(root, c.path);
  for (const f of required) {
    const p = resolve(dir, f);
    if (!existsSync(p)) errors.push(`${c.id}: missing ${f}`);
    else readJson(p);
  }
  if (c.has_sar_image) {
    for (const f of ["sar_quicklook.png", "sar_targets.geojson"]) {
      if (!existsSync(resolve(dir, f))) errors.push(`${c.id}: has_sar_image but missing ${f}`);
    }
  }
}
for (const f of index.shared) {
  if (!existsSync(resolve(root, "shared", f))) errors.push(`shared: missing ${f}`);
}
const gallery = readJson(resolve(root, index.gallery));
if (gallery) {
  for (const it of gallery.items) {
    for (const f of [it.image, it.mask]) {
      if (!existsSync(resolve(root, "shared/gallery", f))) errors.push(`gallery: missing ${f}`);
    }
  }
}
if (errors.length) {
  console.error("validate-data failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`validate-data: ${index.cases.length} cases OK`);

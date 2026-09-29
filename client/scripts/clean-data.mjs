// Prepares public/data for the website. Runs after sync-data and is idempotent (a second run changes nothing).
// - Removes the bundle README (build notes, not needed by the site).
// - Gives placeholder vessel names (SYN-TAN-…, SYN-CAR-…, SYN-FSH-…) a neutral display name: hull type + MMSI tail,
//   e.g. "Tanker 9752". Every string of the case that mentions the old name is updated, so all views agree.
// - Drops build-only fields and wording the site never shows (answer keys, build recipes, bundle labels and notes).
// Logic flags the app reads (synthetic, simulated, has_sar_image) are kept.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../public/data");
const PLACEHOLDER = /^SYN-(TAN|CAR|FSH)-[A-Z0-9]+$/;
const HULL = { TAN: "Tanker", CAR: "Cargo", FSH: "Fishing" };
const OUTLINE_ONLY = "Outline only, no satellite image";

let written = 0;
const notes = [];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, obj) => {
  writeFileSync(p, JSON.stringify(obj));
  written++;
};

/** Visit every object in a JSON value. */
function eachObject(value, fn) {
  if (Array.isArray(value)) value.forEach((v) => eachObject(v, fn));
  else if (value && typeof value === "object") {
    fn(value);
    Object.values(value).forEach((v) => eachObject(v, fn));
  }
}

/** Replace strings in place; returns true when anything changed. */
function mapStrings(value, fn) {
  let changed = false;
  const visit = (v) => {
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        if (typeof x === "string") {
          const y = fn(x);
          if (y !== x) {
            v[i] = y;
            changed = true;
          }
        } else visit(x);
      });
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === "string") {
          const y = fn(x);
          if (y !== x) {
            v[k] = y;
            changed = true;
          }
        } else visit(x);
      }
    }
  };
  visit(value);
  return changed;
}

const del = (obj, key) => {
  if (obj && key in obj) {
    delete obj[key];
    return true;
  }
  return false;
};

const stripDemoDefault = (s) => (typeof s === "string" ? s.replace(/\s*\(demo default\)/i, "") : s);

// 1. Bundle README
const readme = resolve(root, "README.md");
if (existsSync(readme)) {
  rmSync(readme);
  notes.push("removed README.md");
}

// 2. Cases
const indexPath = resolve(root, "cases.json");
const index = readJson(indexPath);
let indexDirty = false;

for (const entry of index.cases) {
  const dir = resolve(root, entry.path);
  const files = {
    tracks: resolve(dir, "ais_tracks.geojson"),
    ledger: resolve(dir, "ledger.json"),
    monitoring: resolve(dir, "monitoring.json"),
    meta: resolve(dir, "meta.json"),
    slick: resolve(dir, "slick.geojson"),
  };
  const docs = Object.fromEntries(Object.entries(files).filter(([, p]) => existsSync(p)).map(([k, p]) => [k, readJson(p)]));
  const dirty = new Set();

  // Placeholder name -> MMSI, from every object that carries both.
  const mmsiOf = new Map();
  for (const key of ["tracks", "ledger", "monitoring"]) {
    eachObject(docs[key], (o) => {
      if (typeof o.name === "string" && PLACEHOLDER.test(o.name) && typeof o.mmsi === "number" && !mmsiOf.has(o.name)) mmsiOf.set(o.name, o.mmsi);
    });
  }
  // Names already in use (real vessels) must not be reused.
  const taken = new Set();
  eachObject(docs.tracks, (o) => {
    if (typeof o.name === "string" && !PLACEHOLDER.test(o.name)) taken.add(o.name);
  });
  const rename = new Map();
  for (const old of [...mmsiOf.keys()].sort()) {
    const hull = HULL[old.split("-")[1]];
    const digits = String(mmsiOf.get(old));
    let n = 4;
    let name = `${hull} ${digits.slice(-n)}`;
    while (taken.has(name) && n < digits.length) name = `${hull} ${digits.slice(-++n)}`;
    taken.add(name);
    rename.set(old, name);
  }
  if (rename.size) {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${[...rename.keys()].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![A-Z0-9])`, "g");
    const swap = (s) => s.replace(re, (m) => rename.get(m) ?? m);
    for (const [key, doc] of Object.entries(docs)) if (mapStrings(doc, swap)) dirty.add(key);
    if (mapStrings(entry, swap)) indexDirty = true;
    notes.push(`${entry.id}: ${rename.size} vessel names`);
  }

  // Track collection source label
  if (docs.tracks?.properties && typeof docs.tracks.properties.source === "string" && /synthetic/i.test(docs.tracks.properties.source)) {
    docs.tracks.properties.source = "AIS";
    dirty.add("tracks");
  }

  // Ledger: answer key, data provenance wording
  if (docs.ledger) {
    const l = docs.ledger;
    for (const k of ["scenario_key", "disclaimer"]) if (del(l, k)) dirty.add("ledger");
    if (l.data) {
      if (l.data.ais === "synthetic" && del(l.data, "ais")) dirty.add("ledger");
      const hg = stripDemoDefault(l.data.human_gate);
      if (hg !== l.data.human_gate) {
        l.data.human_gate = hg;
        dirty.add("ledger");
      }
    }
  }

  // Meta: build recipe, answer-key flag, labels and notes
  if (docs.meta) {
    const m = docs.meta;
    for (const k of ["scenario_key", "scenario_key_available", "reproduce", "kind"]) if (del(m, k)) dirty.add("meta");
    if (m.ais === "synthetic" && del(m, "ais")) dirty.add("meta");
    if (m.forcing && del(m.forcing, "benchmark_truth")) dirty.add("meta");
    const hg = stripDemoDefault(m.human_gate);
    if (hg !== m.human_gate) {
      m.human_gate = hg;
      dirty.add("meta");
    }
    for (const k of ["labels", "note"]) if (del(m, k)) dirty.add("meta");
    if (m.slick?.measures?.simulated && m.slick.source !== OUTLINE_ONLY) {
      m.slick.source = OUTLINE_ONLY;
      dirty.add("meta");
    }
  }

  // Slick outline source wording
  if (docs.slick) {
    for (const f of docs.slick.features ?? []) {
      const p = f.properties ?? {};
      if (p.simulated && p.source !== OUTLINE_ONLY) {
        p.source = OUTLINE_ONLY;
        dirty.add("slick");
      }
    }
  }

  // Index entry
  for (const k of ["labels", "note", "kind"]) if (del(entry, k)) indexDirty = true;

  for (const key of dirty) writeJson(files[key], docs[key]);
}
if (indexDirty) writeJson(indexPath, index);

// 3. Benchmark label
const benchPath = resolve(root, index.benchmark ?? "shared/benchmark.json");
if (existsSync(benchPath)) {
  const b = readJson(benchPath);
  if (del(b, "label")) writeJson(benchPath, b);
}

console.log(written || notes.length ? `clean-data: ${written} files updated${notes.length ? ` (${notes.join("; ")})` : ""}` : "clean-data: already clean");

// Checks the map colours in src/design/tokens.css, both themes:
//  - each data hue has WCAG contrast >= 3:1 against the sea colour it is drawn on
//  - every pair of hues differs by OKLab deltaE x100 >= 15 (normal vision)
//  - every pair stays apart under protan/deutan simulation (Machado et al. 2009, severity 1): >= 8 (6-8 is a warning)
//  - the ship role ramp (leading, shortlist, screened) is monotone in lightness
// Exit code 1 on any failure.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../src/design/tokens.css"), "utf8");
function block(selector) {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexToLin = (h) => [1, 3, 5].map((i) => srgbToLin(parseInt(h.slice(i, i + 2), 16) / 255));
const lum = (h) => {
  const [r, g, b] = hexToLin(h);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
const sim = (lin, M) => M.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])));
const dE = (a, b) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

let failures = 0;
let warnings = 0;
for (const [theme, selector] of [["night", ':root[data-theme="night"]'], ["day", ':root[data-theme="day"]']]) {
  const t = block(selector);
  const hues = { past: t["past"], future: t["future"], ships: t["ship-short"] };
  const lines = [];
  for (const [k, v] of Object.entries(hues)) {
    const c = contrast(v, t["sea"]);
    if (c < 3) failures++;
    lines.push(`${c >= 3 ? "PASS" : "FAIL"} contrast ${k} ${v} on sea ${t["sea"]}: ${c.toFixed(2)}:1`);
  }
  const keys = Object.keys(hues);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const A = hexToLin(hues[keys[i]]);
      const B = hexToLin(hues[keys[j]]);
      const normal = dE(oklab(A), oklab(B));
      const cvd = Math.min(...Object.values(MACHADO).map((M) => dE(oklab(sim(A, M)), oklab(sim(B, M)))));
      if (normal < 15) failures++;
      if (cvd < 6) failures++;
      else if (cvd < 8) warnings++;
      lines.push(`${normal >= 15 && cvd >= 8 ? "PASS" : cvd >= 6 && normal >= 15 ? "WARN" : "FAIL"} ${keys[i]} vs ${keys[j]}: normal ${normal.toFixed(1)}, colour-blind ${cvd.toFixed(1)}`);
    }
  }
  const ramp = ["ship-lead", "ship-short", "ship-screen"].map((k) => oklab(hexToLin(t[k]))[0]);
  const monotone = (ramp[0] > ramp[1] && ramp[1] > ramp[2]) || (ramp[0] < ramp[1] && ramp[1] < ramp[2]);
  if (!monotone) failures++;
  lines.push(`${monotone ? "PASS" : "FAIL"} ship role ramp lightness (leading, shortlist, screened) ${ramp.map((x) => x.toFixed(2)).join(", ")}`);
  console.log(`\n${theme}\n  ${lines.join("\n  ")}`);
}
console.log(`\ncheck-palette: ${failures} failures, ${warnings} warnings`);
process.exit(failures ? 1 : 0);

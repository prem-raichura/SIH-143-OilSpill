// Copies the precomputed bundle ("static data", produced by Dataset/build) into public/data, which is
// committed so the app builds anywhere (Vercel has no access to the Dataset folder).
// - Looks for "static data" next to the repo (new layout: Oil Spill/app/client) or one level up (old layout).
// - If it is not there (for example on Vercel), keeps the committed public/data as is.
// - Replaces bare NaN/Infinity (Python json output) with null, which JSON.parse rejects.
// - On macOS, converts the gallery tiles to JPEG with `sips` to keep the deployment small.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dst = resolve(here, "../public/data");
const candidates = [resolve(here, "../../../static data"), resolve(here, "../../static data")];
const src = candidates.find((p) => existsSync(resolve(p, "cases.json")));

if (!src) {
  if (existsSync(resolve(dst, "cases.json"))) {
    console.log("sync-data: no 'static data' folder found; using the committed public/data");
    process.exit(0);
  }
  console.error(`sync-data: no data. Put the bundle in one of:\n  ${candidates.join("\n  ")}\nor commit public/data.`);
  process.exit(1);
}

const srcTime = statSync(resolve(src, "cases.json")).mtimeMs;
const dstCases = resolve(dst, "cases.json");
if (existsSync(dstCases) && statSync(dstCases).mtimeMs >= srcTime && !process.argv.includes("--force")) {
  console.log("sync-data: public/data is up to date");
  process.exit(0);
}
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true, filter: (p) => !p.endsWith(".DS_Store") });
console.log(`sync-data: copied ${src} -> ${dst}`);

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(geo)?json$/.test(entry.name)) {
      const text = readFileSync(p, "utf8");
      const fixed = text.replace(/([\[,:]\s*)-?(NaN|Infinity)(?=\s*[,\]}])/g, "$1null");
      if (fixed !== text) {
        writeFileSync(p, fixed);
        console.log(`sync-data: replaced NaN/Infinity with null in ${p.slice(dst.length + 1)}`);
      }
    }
  }
};
walk(dst);

// Gallery tiles: PNG -> 768 px JPEG (they show at most ~600 px wide; speckle does not compress well). Masks stay PNG (alpha).
const galleryDir = resolve(dst, "shared/gallery");
const galleryJson = resolve(galleryDir, "gallery.json");
let hasSips = false;
try {
  execFileSync("sips", ["--help"], { stdio: "ignore" });
  hasSips = true;
} catch {
  hasSips = false;
}
if (hasSips && existsSync(galleryJson)) {
  const g = JSON.parse(readFileSync(galleryJson, "utf8"));
  let n = 0;
  for (const it of g.items) {
    if (!it.image.endsWith(".png")) continue;
    const from = resolve(galleryDir, it.image);
    const jpg = it.image.replace(/\.png$/, ".jpg");
    execFileSync("sips", ["-Z", "768", "-s", "format", "jpeg", "-s", "formatOptions", "72", from, "--out", resolve(galleryDir, jpg)], { stdio: "ignore" });
    rmSync(from);
    it.image = jpg;
    n++;
  }
  writeFileSync(galleryJson, JSON.stringify(g, null, 1));
  console.log(`sync-data: converted ${n} gallery tiles to JPEG`);
}

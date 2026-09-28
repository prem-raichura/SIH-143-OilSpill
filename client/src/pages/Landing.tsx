import { ArrowDown, LogIn } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../auth/session";
import { DotCIRows } from "../charts/charts";
import { dataUrl, fetchJson, useBenchmark } from "../data/load";
import type { FeatureCollection, LonLat, Meta, PolygonGeometry } from "../data/types";
import { backwardRoute } from "../lib/oilroutes";
import type { DriftFrames } from "../data/types";
import { Mark } from "../shell/TopBar";
import { useTheme } from "../store/theme";

const HERO_CASE = "AS-01";

interface HeroGeo {
  meta: Meta;
  slick: LonLat[][];
  back: LonLat[];
  cone: LonLat[][];
}

/** Project lon/lat into the quicklook image's pixel box (equirectangular within the scene bounds). */
function useHero(): HeroGeo | null {
  const [g, setG] = useState<HeroGeo | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      fetchJson<Meta>(`${HERO_CASE}/meta.json`),
      fetchJson<FeatureCollection<PolygonGeometry>>(`${HERO_CASE}/slick.geojson`),
      fetchJson<DriftFrames>(`${HERO_CASE}/drift_frames.json`),
      fetchJson<FeatureCollection<PolygonGeometry, { kind: string; hours?: number }>>(`${HERO_CASE}/forecast.geojson`),
    ]).then(([meta, slick, drift, fc]) => {
      if (!live) return;
      const rings = slick.features.flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0])));
      const back = backwardRoute(drift.backward.frames).mean.slice(0, 49);
      const cone = fc.features
        .filter((f) => f.properties.kind === "forecast_envelope")
        .map((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]));
      setG({ meta, slick: rings, back, cone });
    });
    return () => {
      live = false;
    };
  }, []);
  return g;
}

function HeroScene() {
  const g = useHero();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The quicklook is a lon/lat grid over meta.satellite.bounds, so positions map linearly onto its pixels.
  const view = useMemo(() => {
    if (!g?.meta.satellite || !img) return null;
    const [w, s, e, n] = g.meta.satellite.bounds;
    const px = (p: LonLat): [number, number] => [((p[0] - w) / (e - w)) * img.w, ((n - p[1]) / (n - s)) * img.h];
    const path = (pts: LonLat[], close = false) => `M${pts.map((p) => px(p).map((v) => v.toFixed(1)).join(",")).join(" L")}${close ? " Z" : ""}`;
    const c = px(g.meta.slick.measures.centroid);
    // Crop: scale the image so the slick area fills the right side of the hero.
    const aspect = img.w / img.h;
    let W = size.w * 1.7;
    let H = W / aspect;
    if (H < size.h * 1.15) {
      H = size.h * 1.15;
      W = H * aspect;
    }
    let left = size.w * 0.68 - (c[0] / img.w) * W;
    let top = size.h * 0.42 - (c[1] / img.h) * H;
    left = Math.min(0, Math.max(size.w - W, left));
    top = Math.min(0, Math.max(size.h - H, top));
    return { W, H, left, top, vb: `0 0 ${img.w} ${img.h}`, slick: g.slick.map((r) => path(r, true)).join(" "), back: path(g.back), cone: g.cone.map((r) => path(r, true)) };
  }, [g, img, size]);
  return (
    <div className="hero-scene" aria-hidden="true" ref={box}>
      <div className="hero-plate" style={view ? { width: view.W, height: view.H, left: view.left, top: view.top } : { inset: 0 }}>
        <img src={dataUrl(`${HERO_CASE}/sar_quicklook.png`)} alt="" onLoad={(e) => setImg({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {view && (
          <svg viewBox={view.vb} preserveAspectRatio="none">
            {view.cone.map((d, i) => (
              <path key={i} d={d} className="hero-cone" style={{ animationDelay: `${1.6 + i * 0.15}s` }} />
            ))}
            <path d={view.back} className="hero-back" pathLength={1} />
            <path d={view.slick} className="hero-slick" pathLength={1} />
          </svg>
        )}
      </div>
    </div>
  );
}

const STAGES = [
  { t: "Detect", d: "A segmentation model marks dark patches on Sentinel-1 radar images and a second check separates oil from look-alikes such as calm water or algae." },
  { t: "Human oil check", d: "An analyst confirms oil before any ship data is shown. A look-alike closes the case. Blind reviews measure reliance on the model." },
  { t: "Drift back and forward", d: "Particles run backward through currents, tides, waves and wind to a release corridor, and forward 72 hours to show where the oil goes." },
  { t: "Screen ships", d: "AIS tracks and radar-detected ships are checked against the corridor. Only physical impossibility removes a ship; everything else is weighed as evidence." },
  { t: "Verdict, or a refusal", d: "One of five ordered verdicts. The system names a ship only when the evidence clearly separates it, and says what data would help when it does not." },
];

const DATA = [
  ["Sentinel-1 radar (Copernicus)", "Slick detection, bright-point ship targets"],
  ["AIS ship positions", "NOAA MarineCadastre for US waters; synthetic tracks for Indian waters, as the problem statement permits"],
  ["CMEMS ocean currents, tides and waves", "Drift physics, backward and forward"],
  ["ERA5 wind (ECMWF)", "Drift physics and radar reliability"],
  ["OpenDrift OpenOil", "Forecast and forward confirmation"],
  ["SkyTruth Cerulean", "Real slick outlines with scene IDs, and a real-world comparison"],
];

export default function Landing() {
  const session = useSession((s) => s.session);
  const bench = useBenchmark().data;
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    document.title = "Oil spill investigation";
  }, []);
  const B = bench?.held_out.set_B;
  const cmp = bench?.comparison_methods_held_out;
  return (
    <div className="landing" data-theme-hint={theme}>
      <header className="landing-bar">
        <span className="brand"><Mark /><span className="brand-name">Oil spill investigation</span></span>
        <nav aria-label="Page sections" className="landing-nav">
          <a href="#how">How it works</a>
          <a href="#proof">Results</a>
          <a href="#data">Data</a>
        </nav>
        {session ? (
          <Link to="/app" className="btn btn-primary">Open the console</Link>
        ) : (
          <Link to="/login" className="btn btn-primary"><LogIn size={15} /> Sign in</Link>
        )}
      </header>

      <section className="hero">
        <HeroScene />
        <div className="hero-copy">
          <span className="hero-kicker">Smart India Hackathon · Problem 26143</span>
          <h1 className="hero-title">Find the slick. Trace it back. Name the ship, or say why not.</h1>
          <p className="hero-sub">
            Satellite radar, ocean physics and ship tracks in one investigation, with the evidence for and against every ship laid out, and a
            measured willingness to refuse.
          </p>
          <div className="hero-actions">
            <Link to={session ? "/app" : "/login"} className="btn btn-primary btn-lg">{session ? "Open the console" : "Sign in"}</Link>
            <a href="#how" className="btn btn-secondary btn-lg hero-secondary"><ArrowDown size={15} /> See how it works</a>
          </div>
          <p className="hero-caption"><span className="place">Mumbai approaches</span>, Sentinel-1, 3 Oct 2024. Outline: the 66 km slick. Magenta: where it came from. Amber: where it goes.</p>
        </div>
      </section>

      <section id="how" className="l-section">
        <span className="l-eyebrow">Workflow</span>
        <h2 className="l-h2">How an investigation runs</h2>
        <ol className="stages">
          {STAGES.map((s, i) => (
            <li key={s.t}>
              <span className="stage-n">{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="l-band">
      <section id="proof" className="l-section l-split">
        <div>
          <span className="l-eyebrow">Results</span>
          <h2 className="l-h2">Measured, not claimed</h2>
          <p className="l-lead">
            {B
              ? `On ${B.n} held-out synthetic scenarios where the source ship was not in AIS, the system named a ship ${B.wrongful_naming[0]} times (95 % CI ${(B.wrongful_naming[1][0] * 100).toFixed(0)}–${(B.wrongful_naming[1][1] * 100).toFixed(1)} %).`
              : "Loading benchmark…"}
          </p>
          <p className="muted">
            Simpler methods on the same scenarios name the wrong ship far more often. All numbers are synthetic, with deliberately different
            physics in the generator, and are never presented as real-world probabilities.
          </p>
        </div>
        <div className="l-card">
          <h3 className="t-section">Wrongful naming, source absent (held out, synthetic)</h3>
          {B && cmp && (
            <DotCIRows
              rows={[
                { label: "Full system", k: B.wrongful_naming[0], n: B.n, p: B.wrongful_naming[0] / B.n, ci: B.wrongful_naming[1], strong: true },
                { label: "Forward match only", k: cmp.baseline_forward.set_B_wrongful_naming[0], n: 100, p: cmp.baseline_forward.set_B_wrongful_naming[0] / 100, ci: cmp.baseline_forward.set_B_wrongful_naming[1] },
                { label: "Proximity and timing only", k: cmp.baseline_proximity.set_B_wrongful_naming[0], n: 100, p: cmp.baseline_proximity.set_B_wrongful_naming[0] / 100, ci: cmp.baseline_proximity.set_B_wrongful_naming[1] },
              ]}
            />
          )}
        </div>
      </section>
      </div>

      <section id="data" className="l-section">
        <span className="l-eyebrow">Sources</span>
        <h2 className="l-h2">Data it runs on</h2>
        <dl className="data-list">
          {DATA.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="l-section">
        <span className="l-eyebrow">Users</span>
        <h2 className="l-h2">Built for</h2>
        <p className="l-lead">Maritime pollution-response teams, coast guard investigators and port state control officers who need to act on a slick and defend the decision later.</p>
      </section>

      <footer className="landing-foot">
        <span>Smart India Hackathon, problem statement 26143.</span>
        <span>Candidates are analytical associations from public data, not evidence of wrongdoing.</span>
        <span>Static demo build: data is precomputed and replayed in the browser.</span>
      </footer>
    </div>
  );
}

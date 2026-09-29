// The brand chart on the landing and sign-in pages: one real investigation (the 66 km slick off Mumbai, 3 Oct 2024)
// drawn as a night nautical chart. Coast, slick, where the oil came from, where it will drift, and the track of the
// top candidate ship. Built from the same case files the app uses, so it stays true to the data.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LogoLoader } from "../components/loaders";
import { fetchJson, useLand } from "../data/load";
import type { CorridorProps, FeatureCollection, ForecastProps, Ledger, LonLat, Meta, PolygonGeometry, TrackProps } from "../data/types";
import { bearingDeg, geometryRings } from "../lib/geo";
import { boundsOf, centredProjector, landPath, type Projector } from "../map/svgChart";

const CASE = "AS-01";
const MUMBAI: LonLat = [72.8777, 19.076];
const HULL = "M10 1 Q14 3 14 6 V19 H6 V6 Q6 3 10 1Z";

interface HeroCase {
  slick: LonLat[][];
  centroid: LonLat;
  trail: { p: LonLat; h: number }[];
  corridor: LonLat[][];
  cone: { hours: number; rings: LonLat[][] }[];
  track: LonLat[];
  release: { p: LonLat; heading: number } | null;
}

const ringCentroid = (r: LonLat[]): LonLat => {
  let x = 0, y = 0;
  for (const p of r) { x += p[0]; y += p[1]; }
  return [x / r.length, y / r.length];
};

function useHeroCase(): HeroCase | null {
  const [data, setData] = useState<HeroCase | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      fetchJson<Meta>(`${CASE}/meta.json`),
      fetchJson<FeatureCollection<PolygonGeometry>>(`${CASE}/slick.geojson`),
      fetchJson<FeatureCollection<PolygonGeometry, CorridorProps>>(`${CASE}/corridor.geojson`),
      fetchJson<FeatureCollection<PolygonGeometry, ForecastProps>>(`${CASE}/forecast.geojson`),
      fetchJson<Ledger>(`${CASE}/ledger.json`),
      fetchJson<FeatureCollection<{ type: "LineString"; coordinates: LonLat[] }, TrackProps>>(`${CASE}/ais_tracks.geojson`),
    ]).then(([meta, slick, corridor, forecast, ledger, tracks]) => {
      if (!live) return;
      const centroid = meta.slick.measures.centroid;
      const ages = corridor.features
        .filter((f) => f.properties.kind === "age" && f.properties.age_h != null)
        .sort((a, b) => a.properties.age_h! - b.properties.age_h!);
      const trail = [{ p: centroid, h: 0 }, ...ages.map((f) => ({ p: ringCentroid(geometryRings(f.geometry)[0]), h: f.properties.age_h! }))];
      const release = corridor.features.find((f) => f.properties.kind === "release_corridor");
      const cone = forecast.features
        .filter((f) => f.properties.kind === "forecast_envelope" && f.properties.hours != null)
        .map((f) => ({ hours: f.properties.hours!, rings: geometryRings(f.geometry) }))
        .sort((a, b) => a.hours - b.hours);
      const top = ledger.candidates[0];
      const tf = top ? tracks.features.find((f) => f.properties.mmsi === top.mmsi) : undefined;
      const track = tf ? tf.geometry.coordinates.filter((_, i) => tf.properties.t_offset_s[i] >= -24 * 3600 && tf.properties.t_offset_s[i] <= 3 * 3600) : [];
      let releasePt: HeroCase["release"] = null;
      if (top && tf) {
        // Heading of the track around the best-fit release time.
        const t = -top.best_fit_age_h * 3600;
        const offs = tf.properties.t_offset_s;
        let i = offs.findIndex((o) => o >= t);
        if (i <= 0) i = 1;
        const c = tf.geometry.coordinates;
        releasePt = { p: top.best_fit_position, heading: bearingDeg(c[Math.max(0, i - 1)], c[Math.min(c.length - 1, i)]) };
      }
      setData({
        slick: slick.features.flatMap((f) => geometryRings(f.geometry)),
        centroid,
        trail,
        corridor: release ? geometryRings(release.geometry) : [],
        cone,
        track,
        release: releasePt,
      });
    });
    return () => {
      live = false;
    };
  }, []);
  return data;
}

/** Where the data sits in the box: the right side of the hero on wide screens, centred otherwise. */
function frame(framing: "hero" | "panel", W: number, H: number) {
  if (framing === "hero" && W >= 900) return { x0: W * 0.47, x1: W * 0.95, y0: H * 0.12, y1: H * 0.72 };
  if (framing === "hero") return { x0: W * 0.06, x1: W * 0.94, y0: H * 0.1, y1: H * 0.82 };
  return { x0: W * 0.1, x1: W * 0.9, y0: H * 0.12, y1: H * 0.72 };
}

function project(d: HeroCase, framing: "hero" | "panel", W: number, H: number): Projector {
  // Frame the oil (slick, where it came from, where it goes); the ship track simply runs off the edges.
  const pts: LonLat[] = [...d.slick.flat(), ...d.trail.map((t) => t.p), ...d.corridor.flat(), ...d.cone.flatMap((c) => c.rings.flat())];
  const [w, s, e, n] = boundsOf(pts, 0.12) ?? [72, 18.5, 73, 19.5];
  const box = frame(framing, W, H);
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const pxPerDeg = Math.min((box.x1 - box.x0) / ((e - w) * k), (box.y1 - box.y0) / (n - s));
  const bcx = (box.x0 + box.x1) / 2;
  const bcy = (box.y0 + box.y1) / 2;
  const center: LonLat = [(w + e) / 2 - (bcx - W / 2) / (k * pxPerDeg), (s + n) / 2 + (bcy - H / 2) / pxPerDeg];
  return centredProjector(center, pxPerDeg, W, H);
}

/** Point of a ring furthest from `from`, for placing a label on its outer edge. */
function farPoint(rings: LonLat[][], from: LonLat): LonLat {
  let best = rings[0]?.[0] ?? from;
  let dmax = -1;
  for (const r of rings) for (const p of r) {
    const d = (p[0] - from[0]) ** 2 + (p[1] - from[1]) ** 2;
    if (d > dmax) { dmax = d; best = p; }
  }
  return best;
}

export default function ChartPlate({ framing, animate = false }: { framing: "hero" | "panel"; animate?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const d = useHeroCase();
  const land = useLand("india");
  const uid = useId().replace(/:/g, "");

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) setSize({ W: Math.round(r.width), H: Math.round(r.height) });
    const ro = new ResizeObserver(([e]) => setSize({ W: Math.round(e.contentRect.width), H: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawn = useMemo(() => {
    if (!d || !size || !size.W || !size.H) return null;
    const { W, H } = size;
    const proj = project(d, framing, W, H);
    const [vw, vs, ve, vn] = proj.view;
    const lons: number[] = [];
    const lats: number[] = [];
    for (let x = Math.ceil(vw * 2) / 2; x <= ve; x += 0.5) lons.push(x);
    for (let y = Math.ceil(vs * 2) / 2; y <= vn; y += 0.5) lats.push(y);
    const oil = boundsOf([...d.slick.flat(), ...d.corridor.flat(), ...d.cone.flatMap((c) => c.rings.flat())], 0) ?? [72, 19, 73, 20];
    const [sx, sy] = proj.xy([oil[0], oil[1]]);
    return {
      W,
      H,
      proj,
      coast: landPath(land, proj),
      lons,
      lats,
      seaLabel: [sx - 36, sy + 56] as [number, number],
      mumbai: proj.xy(MUMBAI),
      trail: proj.path(d.trail.map((t) => t.p)),
      ticks: d.trail.filter((t) => t.h === 24 || t.h === 72).map((t) => ({ h: t.h, xy: proj.xy(t.p) })),
      corridor: d.corridor.map((r) => proj.path(r, true)).join(" "),
      cone: d.cone.map((c) => ({ hours: c.hours, d: c.rings.map((r) => proj.path(r, true)).join(" "), label: proj.xy(farPoint(c.rings, d.centroid)) })),
      slick: d.slick.map((r) => proj.path(r, true)).join(" "),
      track: proj.path(d.track),
      release: d.release ? { xy: proj.xy(d.release.p), heading: d.release.heading } : null,
    };
  }, [d, size, land, framing]);

  return (
    <div
      ref={box}
      className={`chart-plate chart-plate-${framing}${animate ? " animate" : ""}`}
      role="img"
      aria-label="Chart of the Mumbai approaches: a 66 km oil slick, the area it drifted from, where it will drift over the next 72 hours, and the track of the top candidate ship."
    >
      {drawn && (
        <svg width={drawn.W} height={drawn.H} viewBox={`0 0 ${drawn.W} ${drawn.H}`} aria-hidden="true">
          <defs>
            <radialGradient id={`${uid}-sea`} cx="70%" cy="45%" r="85%">
              <stop offset="0" stopColor="#123047" />
              <stop offset="0.55" stopColor="#0F2433" />
              <stop offset="1" stopColor="#081725" />
            </radialGradient>
            <pattern id={`${uid}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0V7" stroke="#D55181" strokeOpacity="0.4" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width={drawn.W} height={drawn.H} fill={`url(#${uid}-sea)`} />
          <g className="cp-grid">
            {drawn.lons.map((x) => {
              const [px] = drawn.proj.xy([x, 0]);
              return <line key={`x${x}`} x1={px} x2={px} y1={0} y2={drawn.H} />;
            })}
            {drawn.lats.map((y) => {
              const [, py] = drawn.proj.xy([0, y]);
              return <line key={`y${y}`} x1={0} x2={drawn.W} y1={py} y2={py} />;
            })}
          </g>
          <g className="cp-grid-labels">
            {drawn.lons.filter((x) => Number.isInteger(x)).map((x) => {
              const [px] = drawn.proj.xy([x, 0]);
              return <text key={`lx${x}`} x={px + 5} y={44}>{x}°E</text>;
            })}
            {drawn.lats.filter((y) => Number.isInteger(y)).map((y) => {
              const [, py] = drawn.proj.xy([0, y]);
              return <text key={`ly${y}`} x={drawn.W - 44} y={py - 5} textAnchor="end">{y}°N</text>;
            })}
          </g>
          {drawn.coast && <path className="cp-land" d={drawn.coast} fillRule="evenodd" />}
          {framing === "hero" && <text className="cp-water" x={drawn.seaLabel[0]} y={drawn.seaLabel[1]} textAnchor="end">Arabian Sea</text>}
          <g className="cp-town">
            <circle cx={drawn.mumbai[0]} cy={drawn.mumbai[1]} r={3.5} />
            <text x={drawn.mumbai[0] + 9} y={drawn.mumbai[1] + 4}>Mumbai</text>
          </g>

          <path className="cp-corridor" d={drawn.corridor} fill={`url(#${uid}-hatch)`} />
          {drawn.cone.map((c, i) => (
            <g key={c.hours} className="cp-ring" style={{ animationDelay: `${3.1 + i * 0.3}s` }}>
              <path d={c.d} />
              <text x={c.label[0] + 6} y={c.label[1] + 4}>{c.hours} h</text>
            </g>
          ))}
          <path className="cp-track" d={drawn.track} pathLength={1} />
          <path className="cp-trail" d={drawn.trail} pathLength={1} />
          {drawn.ticks.map((t) => (
            <g key={t.h} className="cp-tick">
              <circle cx={t.xy[0]} cy={t.xy[1]} r={3} />
              <text x={t.xy[0] - 8} y={t.xy[1] + 4} textAnchor="end">{t.h} h earlier</text>
            </g>
          ))}
          <path className="cp-slick" d={drawn.slick} pathLength={1} />
          {drawn.release && (
            <g className="cp-ship" transform={`translate(${drawn.release.xy[0]} ${drawn.release.xy[1]}) rotate(${drawn.release.heading}) scale(1.3) translate(-10 -10)`}>
              <path d={HULL} />
            </g>
          )}
        </svg>
      )}
      {!drawn && (
        <div className="chart-plate-loading">
          <LogoLoader size="sm" label="Loading chart" />
        </div>
      )}
      <div className="chart-plate-frame" aria-hidden="true" />
    </div>
  );
}

/** The chart key, in plain words. */
export function ChartKey() {
  return (
    <ul className="chart-key" aria-label="Chart key">
      <li>
        <svg width="26" height="14" aria-hidden="true"><path d="M3 10c5-7 12-8 20-6-4 5-11 9-20 6z" fill="rgba(0,0,0,.55)" stroke="#E8EFF2" strokeWidth="1.4" /></svg>
        Oil slick seen by satellite
      </li>
      <li>
        <svg width="26" height="14" aria-hidden="true"><path d="M2 11 C9 3, 16 12, 24 4" fill="none" stroke="#D55181" strokeWidth="2.4" strokeLinecap="round" /></svg>
        Where it came from
      </li>
      <li>
        <svg width="26" height="14" aria-hidden="true"><ellipse cx="13" cy="7" rx="11" ry="5.5" fill="rgba(201,133,0,.14)" stroke="#C98500" strokeWidth="1.5" /></svg>
        Where it will drift, 24 to 72 h
      </li>
      <li>
        <svg width="26" height="14" aria-hidden="true"><path d="M2 10 L24 4" stroke="#86B6EF" strokeWidth="2" /><path d={HULL} fill="#86B6EF" transform="translate(9 -1) rotate(75 10 10) scale(0.8)" /></svg>
        Track of the top candidate ship
      </li>
    </ul>
  );
}

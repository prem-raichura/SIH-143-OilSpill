// Space-time cube: x/y in local km, z = hours relative to the image (image plane at the top, the past below).
// A ship whose track passes through the oil's past positions at the same time is consistent with being the source.
import type { OrbitViewState, PickingInfo } from "@deck.gl/core";
import { OrbitView } from "@deck.gl/core";
import { LineLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { useMemo, useState } from "react";
import { useCase } from "../case/useCase";
import type { LonLat } from "../data/types";
import { PALETTES, rgba } from "../design/palette";
import { geometryRings, makeEnu } from "../lib/geo";
import { fmtSignedH } from "../lib/time";
import { ROLE_LABEL, type Role } from "../lib/vessels";
import { FONT_SANS } from "../map/layers/basemap";
import { roleColor } from "../map/caseLayers";
import { useClock } from "../store/clock";
import { useTheme } from "../store/theme";
import { useWorkspace } from "../store/workspace";

const VIEW = new OrbitView({ orbitAxis: "Z", fovy: 40 });
type P3 = [number, number, number];

export default function SpaceTimeCube() {
  const c = useCase();
  const theme = useTheme((s) => s.theme);
  const P = PALETTES[theme];
  const ws = useWorkspace();
  const h = useClock((s) => s.h);
  const [zs, setZs] = useState(1.2); // km per hour
  const [onlyKey, setOnlyKey] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const ap = c.bundle.meta.slick.measures.age_prior_h;

  const geo = useMemo(() => {
    const enu = makeEnu(c.centroid);
    const km = (p: LonLat) => enu.toKm(p);
    const slick = c.slickRings.map((r) => r.map((p) => [...km(p), 0] as P3));
    const ages = c.ages.map((f) => {
      const age = (f.properties as { age_h: number }).age_h;
      return { age, rings: geometryRings(f.geometry).map((r) => r.map((p) => [...km(p), -age] as P3)) };
    });
    const particles: { p: P3; age: number }[] = [];
    if (c.drift) {
      c.drift.backward.frames.forEach((fr, age) => {
        if (age % 2 !== 0 || age > ap.max + 12) return;
        for (let i = 0; i < fr.length; i += 2) particles.push({ p: [...km(fr[i]), -age], age });
      });
    }
    const tracks = c.vessels
      .filter((v) => c.trackIdx.has(v.mmsi) && v.role !== "background")
      .map((v) => {
        const ti = c.trackIdx.get(v.mmsi)!;
        const pts: P3[] = [];
        ti.tH.forEach((t, i) => {
          if (t >= -72 && t <= 24) pts.push([...km(ti.coords[i]), t]);
        });
        return { v, pts };
      })
      .filter((t) => t.pts.length > 1);
    const release = c.vessels
      .filter((v) => v.candidate && (v.role === "leading" || v.role === "shortlist"))
      .map((v) => ({ v, p: [...km(v.candidate!.best_fit_position), -v.candidate!.best_fit_age_h] as P3 }));
    // horizontal extent for the floor grid
    let ext = 15;
    for (const a of ages) if (a.age <= ap.max) for (const r of a.rings) for (const p of r) ext = Math.max(ext, Math.abs(p[0]), Math.abs(p[1]));
    ext = Math.min(90, ext * 1.25);
    return { slick, ages, particles, tracks, release, ext: Math.ceil(ext / 5) * 5 };
  }, [c, ap.max]);

  const [viewState, setViewState] = useState<OrbitViewState>(() => ({
    target: [0, 0, -Math.min(36, ap.max * 0.6) * 1.2],
    rotationX: 22,
    rotationOrbit: -35,
    zoom: Math.log2(520 / (2.6 * Math.max(15, geo.ext))),
    minZoom: -3,
    maxZoom: 8,
  }));

  const Z = (p: P3): P3 => [p[0], p[1], p[2] * zs];
  const focus = ws.selectedMmsi;
  const tracks = !c.shipsUnlocked ? [] : geo.tracks.filter((t) => !onlyKey || t.v.role === "leading" || t.v.role === "shortlist" || t.v.mmsi === focus);
  const E = geo.ext;
  const grid: { a: P3; b: P3 }[] = [];
  for (let x = -E; x <= E; x += E / 4) {
    grid.push({ a: [x, -E, -72 * zs], b: [x, E, -72 * zs] }, { a: [-E, x, -72 * zs], b: [E, x, -72 * zs] });
  }
  const axisHours = [0, -12, -24, -36, -48, -60, -72];

  const layers = [
    new LineLayer({
      id: "floor",
      data: grid,
      getSourcePosition: (d) => d.a,
      getTargetPosition: (d) => d.b,
      getColor: rgba(P.grid),
      getWidth: 1,
    }),
    new LineLayer({
      id: "axis",
      data: [{ a: [-E, -E, 0] as P3, b: [-E, -E, -72 * zs] as P3 }],
      getSourcePosition: (d) => d.a,
      getTargetPosition: (d) => d.b,
      getColor: rgba(P.ink2),
      getWidth: 1.5,
    }),
    new TextLayer({
      id: "axis-labels",
      data: axisHours,
      getPosition: (t: number) => [-E, -E, t * zs],
      getText: (t: number) => (t === 0 ? "Image" : fmtSignedH(t)),
      getSize: 12,
      getColor: rgba(P.ink2),
      fontFamily: FONT_SANS,
      getTextAnchor: "end",
      getPixelOffset: [-8, 0],
      billboard: true,
      characterSet: "auto",
      updateTriggers: { getPosition: zs },
    }),
    new PathLayer({
      id: "age-slices",
      data: geo.ages.flatMap((a) => a.rings.map((r) => ({ r, age: a.age }))),
      getPath: (d) => d.r.map(Z),
      getColor: (d) => rgba(P.past, d.age >= ap.min && d.age <= ap.max ? 0.75 : 0.3),
      getWidth: 1.5,
      widthUnits: "pixels",
      updateTriggers: { getPath: zs, getColor: theme },
    }),
    new ScatterplotLayer({
      id: "cube-particles",
      data: geo.particles,
      getPosition: (d) => Z(d.p),
      getRadius: 1.6,
      radiusUnits: "pixels",
      getFillColor: (d) => rgba(P.past, 0.25 + 0.4 * (1 - d.age / 72)),
      updateTriggers: { getPosition: zs, getFillColor: theme },
    }),
    new PathLayer({
      id: "cube-slick",
      data: geo.slick,
      getPath: (r) => r,
      getColor: rgba(P.ink),
      getWidth: 2,
      widthUnits: "pixels",
      updateTriggers: { getColor: theme },
    }),
    new PathLayer({
      id: "cube-tracks",
      data: tracks,
      getPath: (t) => t.pts.map(Z),
      getColor: (t) => (t.v.mmsi === focus ? rgba(P.accent) : roleColor(P, t.v.role as Role)),
      getWidth: (t) => (t.v.role === "leading" || t.v.mmsi === focus ? 3 : 1.6),
      widthUnits: "pixels",
      pickable: true,
      updateTriggers: { getPath: zs, getColor: [theme, focus], getWidth: focus },
    }),
    new ScatterplotLayer({
      id: "cube-release",
      data: c.shipsUnlocked ? geo.release : [],
      getPosition: (d) => Z(d.p),
      getRadius: 7,
      radiusUnits: "pixels",
      stroked: true,
      filled: true,
      getFillColor: rgba(P.sea),
      getLineColor: rgba(P.past),
      getLineWidth: 2.5,
      lineWidthUnits: "pixels",
      pickable: true,
      updateTriggers: { getPosition: zs, getFillColor: theme, getLineColor: theme },
    }),
    new TextLayer({
      id: "cube-release-labels",
      data: c.shipsUnlocked ? geo.release : [],
      getPosition: (d) => Z(d.p),
      getText: (d) => `${d.v.name}: best-fit release ${fmtSignedH(-d.v.candidate!.best_fit_age_h)}`,
      getSize: 12,
      getColor: rgba(P.ink),
      fontFamily: FONT_SANS,
      fontWeight: 600,
      getTextAnchor: "start",
      getPixelOffset: [12, 0],
      outlineWidth: 3,
      outlineColor: rgba(P.sea),
      fontSettings: { sdf: true },
      characterSet: "auto",
      billboard: true,
      updateTriggers: { getPosition: zs, getColor: theme, outlineColor: theme },
    }),
    new PathLayer({
      id: "clock-plane",
      data: [{ r: [[-E, -E, h * zs], [E, -E, h * zs], [E, E, h * zs], [-E, E, h * zs], [-E, -E, h * zs]] as P3[] }],
      getPath: (d) => d.r,
      getColor: rgba(P.ink, 0.45),
      getWidth: 1,
      widthUnits: "pixels",
      updateTriggers: { getPath: [h, zs], getColor: theme },
    }),
  ];

  const onHover = (info: PickingInfo) => {
    const o = info.object as { v?: { name: string; role: Role; mmsi: number }; p?: P3 } | undefined;
    if (!o?.v) return setHover(null);
    setHover({ x: info.x, y: info.y, text: info.layer?.id === "cube-release" ? `${o.v.name}: best-fit release point` : `${o.v.name}, ${ROLE_LABEL[o.v.role].toLowerCase()}` });
  };

  return (
    <div className="cube-wrap" style={{ position: "absolute", inset: 0, background: "var(--sea)" }}>
      <DeckGL
        views={VIEW}
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as OrbitViewState)}
        controller={{ dragPan: true, dragRotate: true, scrollZoom: true }}
        layers={layers}
        onHover={onHover}
        onClick={(info) => {
          const o = info.object as { v?: { mmsi: number } } | undefined;
          if (o?.v) ws.select(o.v.mmsi);
        }}
        getCursor={({ isDragging, isHovering }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab")}
      />
      {hover && <div className="map-tooltip" style={{ left: hover.x, top: hover.y }}>{hover.text}</div>}
      <div className="cube-panel">
        <b>Space-time cube</b>
        <p>Up is time: the slick at the image sits on top, where the oil was N hours earlier sits below it (magenta). Ship tracks climb with time. A track that passes through the oil's past at the same height is consistent with releasing it.</p>
        <label className="field">
          <span className="t-label">Vertical scale {zs.toFixed(1)} km per hour</span>
          <input type="range" min={0.3} max={4} step={0.1} value={zs} onChange={(e) => setZs(Number(e.target.value))} />
        </label>
        <label className="check-row">
          <span /> <span>Only leading and shortlist</span>
          <input type="checkbox" checked={onlyKey} onChange={(e) => setOnlyKey(e.target.checked)} />
        </label>
        {!c.shipsUnlocked && <p className="note">Ships appear after the oil check.</p>}
        <p className="t-label">Thin frame: the current timeline time. Highlighted track: the selected ship. Drag to rotate, scroll to zoom.</p>
      </div>
    </div>
  );
}

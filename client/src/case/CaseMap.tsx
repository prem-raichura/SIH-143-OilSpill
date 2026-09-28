import type { PickingInfo, WebMercatorViewport } from "@deck.gl/core";
import { CompositeLayer } from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Camera, Crosshair, Minus, Navigation, Plus, Ruler, Ship, Target, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShared } from "../data/load";
import type { Bounds, LonLat } from "../data/types";
import { PALETTES, rgba } from "../design/palette";
import { driftCorrectTrack } from "../lib/drift";
import { bearingDeg, distanceKm, fmtKmNm, fmtLonLat } from "../lib/geo";
import { fmtSignedH } from "../lib/time";
import { HULL_LABEL, hullKind, ROLE_LABEL } from "../lib/vessels";
import ChartFrame, { graticuleLines } from "../map/ChartFrame";
import { buildCaseLayers, prepareStatic, withOpacity } from "../map/caseLayers";
import { basemapLayers } from "../map/layers/basemap";
import { MapCanvas, type MapHandle } from "../map/MapCanvas";
import ScaleBar from "../map/ScaleBar";
import { useClock } from "../store/clock";
import { useTheme } from "../store/theme";
import { useWorkspace } from "../store/workspace";
import { useReview } from "../store/review";
import { useCase } from "./useCase";
import { Tip } from "../components/ui";

interface Hover {
  x: number;
  y: number;
  content: React.ReactNode;
}

export default function CaseMap() {
  const c = useCase();
  const theme = useTheme((s) => s.theme);
  const P = PALETTES[theme];
  const h = useClock((s) => s.h);
  const ws = useWorkspace();
  const shared = useShared(c.bundle.meta.region);
  const [vp, setVp] = useState<WebMercatorViewport | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [cursor, setCursor] = useState<LonLat | null>(null);
  const [measure, setMeasure] = useState<{ active: boolean; pts: LonLat[] }>({ active: false, pts: [] });
  const mapRef = useRef<MapHandle>(null);

  const allObs = useReview((s) => s.observations);
  const observations = useMemo(() => allObs.filter((o) => o.caseId === c.bundle.entry.id), [allObs, c.bundle.entry.id]);
  const staticData = useMemo(() => prepareStatic(c), [c.bundle, c.vessels]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = ws.selectedMmsi ? c.byMmsi.get(ws.selectedMmsi) : undefined;
  const drifted = useMemo(() => {
    if (!selected || !c.trackIdx.has(selected.mmsi)) return null;
    const ap = c.bundle.meta.slick.measures.age_prior_h;
    return driftCorrectTrack(c.forcing, c.trackIdx.get(selected.mmsi)!, Math.max(0, ap.min - 1), Math.min(72, ap.max + 6));
  }, [selected, c.forcing, c.trackIdx, c.bundle]);

  // Fit on request (step change, fit buttons)
  const fitBounds: Bounds | null = useMemo(() => {
    const k = ws.fitRequest.kind;
    if (k === "sar") return c.bounds.sar ?? c.bounds.slick;
    if (k === "slick") return c.bounds.slick;
    if (k === "corridor") return c.bounds.corridor;
    if (k === "drift") return c.bounds.drift;
    if (k === "ships") return c.shipsUnlocked ? c.bounds.ships : c.bounds.corridor;
    if (k === "selected" && selected?.track) {
      const coords = selected.track.geometry.coordinates.filter((_, i) => Math.abs(selected.track!.properties.t_offset_s[i]) < 48 * 3600);
      let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
      for (const [x, y] of [...coords, ...c.slickRings.flat()]) {
        w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
      }
      return isFinite(w) ? [w - 0.1, s - 0.1, e + 0.1, n + 0.1] : c.bounds.corridor;
    }
    return c.bounds.corridor;
  }, [ws.fitRequest, c, selected]);

  const caseLayers = buildCaseLayers({
      c,
      s: staticData,
      on: ws.layers,
      h,
      P,
      theme,
      zoom: vp?.zoom ?? 6,
      sarOpacity: ws.sarOpacity,
      hover: ws.hoverMmsi,
      selected: ws.selectedMmsi,
      onlyShortlist: ws.onlyShortlist,
      colorBySpeed: ws.colorBySpeed,
      drifted,
      platforms: shared.platforms,
      ports: shared.ports,
      showMeasureLabels: ws.step === "slick",
      tilt: ws.tilt,
      observations,
    });
  // The SAR image sits under the land so the coastline stays readable.
  const layers = withOpacity([
    ...caseLayers.filter((l) => l.id === "sar"),
    ...basemapLayers({
      land: shared.land,
      eez: shared.eez,
      graticule: ws.layers.graticule ? graticuleLines(vp) : [],
      palette: P,
      show: { eez: ws.layers.eez, graticule: ws.layers.graticule },
      region: c.bundle.meta.region,
      zoom: vp?.zoom ?? 6,
      theme,
      online: ws.layers.online,
    }),
    ...caseLayers.filter((l) => l.id !== "sar"),
  ].filter(Boolean) as never, ws.opacity);

  const onHover = useCallback(
    (info: PickingInfo) => {
      if (info.coordinate) setCursor(info.coordinate as LonLat);
      const id = info.layer?.id ?? "";
      const o = info.object as Record<string, unknown> | undefined;
      let mmsi: number | null = null;
      let content: React.ReactNode = null;
      if (o && (id.startsWith("tracks") || id.startsWith("heads") || id === "gaps" || id === "reach-fill")) {
        mmsi = (o.mmsi as number) ?? ((o.v as { mmsi: number })?.mmsi ?? null);
        const v = mmsi != null ? c.byMmsi.get(mmsi) : undefined;
        if (v) {
          const st = c.trackIdx.has(v.mmsi) ? (o.st as { sog: number | null } | undefined) : undefined;
          content = (
            <>
              <b>{v.name}</b>
              <div className="muted">MMSI {v.mmsi}, {HULL_LABEL[hullKind(v.vesselType)]}</div>
              <div>{ROLE_LABEL[v.role]}{v.synthetic ? ", synthetic AIS" : ""}</div>
              {st?.sog != null && <div className="num">{st.sog.toFixed(1)} kn at {fmtSignedH(h)}</div>}
              {id === "gaps" && <div>AIS gap {(o.gap as { hours: number }).hours.toFixed(1)} h</div>}
              {id === "reach-fill" && <div>Area reachable at 25 kn during a {(o.hours as number).toFixed(1)} h gap</div>}
              {v.candidate && <div className="muted num">Score {v.candidate.score.toFixed(2)}, {v.candidate.band} band</div>}
            </>
          );
        }
      } else if (o && id === "cone") {
        content = <><b>Forecast +{(o.properties as { hours: number }).hours} h</b><div className="muted">Where the oil is expected to be (OpenOil)</div></>;
      } else if (o && id === "isochrones") {
        content = <><b>{fmtSignedH(-(o.age as number))}</b><div className="muted">Where the oil was {o.age as number} h before the image</div></>;
      } else if (id === "corridor") {
        content = <><b>Release corridor</b><div className="muted">Where and when the oil could have been released, over the age prior</div></>;
      } else if (id === "expanded") {
        content = <><b>Expanded corridor</b><div className="muted">Used only by the reachability veto (outer ensemble + 5 km)</div></>;
      } else if (id === "slick") {
        const m = c.bundle.meta.slick.measures;
        content = <><b>Slick</b><div className="muted num">{m.area_km2.toFixed(1)} km², {m.length_km.toFixed(1)} km long</div></>;
      } else if (o && id === "targets") {
        const p = o.props as { peak_db: number; approx_length_m: number; platform: boolean };
        content = <><b>{p.platform ? "Bright point at a known platform" : "Bright point (simple CFAR)"}</b><div className="muted num">Peak {p.peak_db} dB, about {p.approx_length_m} m. Not validated.</div></>;
      } else if (o && id === "platforms") {
        content = <><b>Offshore platform</b><div className="muted">Public infrastructure layer</div></>;
      } else if (o && id === "ports") {
        const pp = (o.properties as Record<string, string>) ?? {};
        content = <><b>{pp["Main Port Name"] ?? "Port"}</b><div className="muted">World Port Index</div></>;
      } else if (o && id === "release") {
        const v = c.byMmsi.get(o.mmsi as number);
        content = <><b>{o.text as string}</b><div className="muted">{v?.name}: where its track best fits the slick</div></>;
      } else if (o && id === "currents") {
        const v = o.v as [number, number];
        content = <><b>Current</b><div className="num">{Math.hypot(v[0], v[1]).toFixed(2)} m/s toward {Math.round((Math.atan2(v[0], v[1]) * 180) / Math.PI + 360) % 360}°</div></>;
      } else if (o && id === "wind") {
        const v = o.v as [number, number];
        content = <><b>Wind (ERA5)</b><div className="num">{Math.hypot(v[0], v[1]).toFixed(1)} m/s from {Math.round((Math.atan2(-v[0], -v[1]) * 180) / Math.PI + 360) % 360}°</div></>;
      } else if (o && id === "observations") {
        content = <><b>{(o.oilSeen as boolean) ? "Oil observed" : "Searched, none found"}</b><div className="muted">Forecast verification record (Drift, Goes to)</div></>;
      } else if (id === "back-route") {
        content = <><b>Backward route</b><div className="muted">Ensemble mean of where the oil was, hour by hour</div></>;
      } else if (id === "fwd-route") {
        content = <><b>Forecast route</b><div className="muted">Mean position of the forecast oil, hour by hour</div></>;
      }
      if (useWorkspace.getState().hoverMmsi !== mmsi) useWorkspace.getState().hover(mmsi);
      setHover(content ? { x: info.x, y: info.y, content } : null);
    },
    [c, h],
  );

  const onClick = useCallback(
    (info: PickingInfo) => {
      if (measure.active && info.coordinate) {
        setMeasure((m) => ({ active: true, pts: m.pts.length >= 2 ? [info.coordinate as LonLat] : [...m.pts, info.coordinate as LonLat] }));
        return;
      }
      const o = info.object as Record<string, unknown> | undefined;
      const mmsi = (o?.mmsi as number) ?? (o?.v as { mmsi: number } | undefined)?.mmsi;
      if (mmsi && c.shipsUnlocked) {
        const st = useWorkspace.getState();
        st.select(mmsi);
        if (st.step !== "evidence" && st.step !== "followup" && st.step !== "verdict") st.setStep("evidence");
        st.toggleLayer("driftCorrected", true);
      }
    },
    [c.shipsUnlocked, measure.active],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMeasure({ active: false, pts: [] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const measureInfo = measure.pts.length === 2
    ? `${fmtKmNm(distanceKm(measure.pts[0], measure.pts[1]))}, bearing ${Math.round(bearingDeg(measure.pts[0], measure.pts[1]))}°`
    : measure.active ? (measure.pts.length ? "Click the second point" : "Click the first point") : null;

  const saveImage = () => {
    const url = mapRef.current?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.bundle.entry.id}-${ws.step}-map.png`;
    a.click();
  };

  return (
    <MapCanvas
      ref={mapRef}
      ariaLabel={`Map of case ${c.bundle.entry.id}`}
      layers={[
        ...layers,
        ...(measure.pts.length
          ? [measureLayer(measure.pts, P.focus)]
          : []),
      ]}
      fit={{ bounds: fitBounds, key: `${c.bundle.entry.id}:${ws.fitRequest.n}`, padding: 56, maxZoom: 11.5 }}
      onHover={onHover}
      onClick={onClick}
      onViewport={setVp}
      pitch={ws.tilt ? 50 : 0}
      cursor={measure.active ? "crosshair" : undefined}
    >
      <ChartFrame vp={vp} />
      {hover && <div className="map-tooltip" style={{ left: hover.x, top: hover.y }}>{hover.content}</div>}
      {measureInfo && <div className="map-banner num">{measureInfo} <span className="muted">(Esc to stop)</span></div>}
      <div className="map-status">
        <button type="button" className="coord-readout" onClick={() => ws.set({ decimalCoords: !ws.decimalCoords })} title="Switch between degrees-minutes and decimal">
          {cursor ? fmtLonLat(cursor, ws.decimalCoords) : "Move over the map"}
        </button>
        <ScaleBar vp={vp} />
        {ws.layers.online && <span className="attribution">Basemap: Esri, GEBCO, NOAA, National Geographic and other contributors</span>}
      </div>
      <div className="map-ctrls">
        <div className="ctrl-group">
          <Tip content="Zoom in" side="left"><button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => mapRef.current?.zoomBy(1)}><Plus size={16} /></button></Tip>
          <Tip content="Zoom out" side="left"><button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => mapRef.current?.zoomBy(-1)}><Minus size={16} /></button></Tip>
          <Tip content="North up" side="left"><button type="button" className="icon-btn" aria-label="Reset north" onClick={() => mapRef.current?.resetNorth()}><Navigation size={16} /></button></Tip>
        </div>
        <div className="ctrl-group">
          <Tip content="Fit slick" side="left"><button type="button" className="icon-btn" aria-label="Fit slick" onClick={() => ws.requestFit("slick")}><Target size={16} /></button></Tip>
          <Tip content="Fit release corridor and forecast" side="left"><button type="button" className="icon-btn" aria-label="Fit corridor" onClick={() => ws.requestFit("drift")}><Waves size={16} /></button></Tip>
          <Tip content={c.shipsUnlocked ? "Fit all ships" : "Decide on the oil check first"} side="left"><button type="button" className="icon-btn" aria-label="Fit ships" disabled={!c.shipsUnlocked} onClick={() => ws.requestFit("ships")}><Ship size={16} /></button></Tip>
        </div>
        <div className="ctrl-group">
          <Tip content={ws.tilt ? "Flat map" : "Tilt map (3D)"} side="left"><button type="button" className="icon-btn" aria-pressed={ws.tilt} aria-label="Tilt map" onClick={() => ws.set({ tilt: !ws.tilt })}><span style={{ fontSize: 11, fontWeight: 700 }}>3D</span></button></Tip>
          <Tip content="Measure distance" side="left"><button type="button" className="icon-btn" aria-pressed={measure.active} aria-label="Measure distance" onClick={() => setMeasure((m) => ({ active: !m.active, pts: [] }))}><Ruler size={16} /></button></Tip>
          <Tip content="Save map image" side="left"><button type="button" className="icon-btn" aria-label="Save map image" onClick={saveImage}><Camera size={16} /></button></Tip>
          <Tip content="Center on selected ship" side="left"><button type="button" className="icon-btn" aria-label="Center on selected ship" disabled={!selected} onClick={() => ws.requestFit("selected")}><Crosshair size={16} /></button></Tip>
        </div>
      </div>
    </MapCanvas>
  );
}


class MeasureLayer extends CompositeLayer<{ pts: LonLat[]; color: string }> {
  static layerName = "MeasureLayer";
  renderLayers() {
    const { pts, color } = this.props;
    return [
      new PathLayer({ id: "measure-path", data: [pts], getPath: (d: LonLat[]) => d, getColor: rgba(color), getWidth: 2, widthUnits: "pixels" }),
      new ScatterplotLayer({ id: "measure-pts", data: pts, getPosition: (d: LonLat) => d, getRadius: 4, radiusUnits: "pixels", getFillColor: rgba(color) }),
    ];
  }
}
function measureLayer(pts: LonLat[], color: string) {
  return new MeasureLayer({ id: "measure", pts, color });
}

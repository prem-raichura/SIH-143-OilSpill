import type { PickingInfo, WebMercatorViewport } from "@deck.gl/core";
import { CompositeLayer } from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Camera, Crosshair, Layers, Navigation, Ruler, Ship, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShared } from "../data/load";
import type { Bounds, LonLat } from "../data/types";
import { PALETTES, rgba } from "../design/palette";
import { driftCorrectTrack } from "../lib/drift";
import { bearingDeg, distanceKm, fmtKmNm, fmtLonLat } from "../lib/geo";
import BasemapSwitcher from "../map/BasemapSwitcher";
import ChartFrame, { graticuleLines } from "../map/ChartFrame";
import { buildCaseLayers, prepareStatic, withOpacity } from "../map/caseLayers";
import GoTo from "../map/GoTo";
import IdentifyPanel, { type Identified } from "../map/IdentifyPanel";
import { basemapDef, basemapLayers } from "../map/layers/basemap";
import MapControls, { type MapTool } from "../map/MapControls";
import MapLegend, { type LegendGroup } from "../map/MapLegend";
import { MapCanvas, type FitPadding, type MapHandle } from "../map/MapCanvas";
import MapTooltip from "../map/MapTooltip";
import OverviewMap from "../map/OverviewMap";
import ScaleBar from "../map/ScaleBar";
import { Swatch } from "../map/Swatch";
import { NARROW, useMedia } from "../lib/useMedia";
import { useClock } from "../store/clock";
import { useMapPrefs } from "../store/mapPrefs";
import { useTheme } from "../store/theme";
import { LAYERS, useWorkspace, type LayerId } from "../store/workspace";
import { useReview } from "../store/review";
import { describePick, type PickInfo } from "./describePick";
import { useCase } from "./useCase";

interface Hover {
  x: number;
  y: number;
  info: PickInfo;
}

const SHIP_LAYERS: LayerId[] = ["tracks", "tracksElim", "tracksBg", "heads", "gaps", "reach", "release", "driftCorrected"];

export default function CaseMap() {
  const c = useCase();
  const theme = useTheme((s) => s.theme);
  const P = PALETTES[theme];
  const h = useClock((s) => s.h);
  const ws = useWorkspace();
  const { basemap, advanced } = useMapPrefs();
  const narrow = useMedia(NARROW);
  const shared = useShared(c.bundle.meta.region);
  const [vp, setVp] = useState<WebMercatorViewport | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [cursor, setCursor] = useState<LonLat | null>(null);
  const [measure, setMeasure] = useState<{ active: boolean; pts: LonLat[] }>({ active: false, pts: [] });
  const [identified, setIdentified] = useState<(Identified & { fit?: PickInfo["fit"] }) | null>(null);
  const [pin, setPin] = useState<LonLat | null>(null);
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
  const base = basemapLayers({
    land: shared.land,
    eez: shared.eez,
    graticule: ws.layers.graticule ? graticuleLines(vp) : [],
    palette: P,
    show: { eez: ws.layers.eez, graticule: ws.layers.graticule },
    region: c.bundle.meta.region,
    zoom: vp?.zoom ?? 6,
    theme,
    basemap,
  });
  // Web tiles, then the SAR image, then land (the coastline stays readable over the image), then the case data.
  const layers = withOpacity([
    ...base.under,
    ...caseLayers.filter((l) => l.id === "sar"),
    ...base.over,
    ...caseLayers.filter((l) => l.id !== "sar"),
  ].filter(Boolean) as never, ws.opacity);

  const onHover = useCallback(
    (info: PickingInfo) => {
      if (info.coordinate) setCursor(info.coordinate as LonLat);
      const d = describePick(info, c, h);
      const mmsi = d?.mmsi ?? null;
      if (useWorkspace.getState().hoverMmsi !== mmsi) useWorkspace.getState().hover(mmsi);
      setHover(d ? { x: info.x, y: info.y, info: d } : null);
    },
    [c, h],
  );

  const onClick = useCallback(
    (info: PickingInfo) => {
      if (measure.active && info.coordinate) {
        setMeasure((m) => ({ active: true, pts: m.pts.length >= 2 ? [info.coordinate as LonLat] : [...m.pts, info.coordinate as LonLat] }));
        return;
      }
      const d = describePick(info, c, useClock.getState().h);
      setIdentified(d ? { title: d.title, subtitle: d.subtitle, rows: d.rows, at: (info.coordinate as LonLat) ?? null, fit: d.fit } : null);
      const o = info.object as Record<string, unknown> | undefined;
      const mmsi = (o?.mmsi as number) ?? (o?.v as { mmsi: number } | undefined)?.mmsi;
      if (mmsi && c.shipsUnlocked) {
        const st = useWorkspace.getState();
        st.select(mmsi);
        if (st.step !== "evidence" && st.step !== "followup" && st.step !== "verdict") st.setStep("evidence");
        st.toggleLayer("driftCorrected", true);
      }
    },
    [c, measure.active],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMeasure({ active: false, pts: [] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A new case or step closes the identify panel.
  useEffect(() => setIdentified(null), [c.bundle.entry.id, ws.step]);

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

  // Legend: every layer that is on and available, grouped like the layers panel.
  const hasSar = Boolean(c.bundle.meta.satellite);
  const legend: LegendGroup[] = [];
  let layersOn = 0;
  for (const l of LAYERS) {
    if (!ws.layers[l.id]) continue;
    if (l.ships && !c.shipsUnlocked) continue;
    if ((l.id === "sar" || l.id === "targets") && !hasSar) continue;
    layersOn++;
    if (l.id === "graticule") continue;
    let g = legend.find((x) => x.title === l.group);
    if (!g) legend.push((g = { title: l.group, items: [] }));
    g.items.push({ key: l.id, swatch: <Swatch kind={l.swatch} />, label: l.label });
  }
  if (c.shipsUnlocked && SHIP_LAYERS.some((id) => ws.layers[id])) {
    legend.push({
      title: "Ship roles",
      items: (["leading", "shortlist", "screened", "eliminated", "background"] as const).map((r) => ({
        key: r,
        swatch: <i className={`role-dot role-${r}`} />,
        label: { leading: "Leading candidate", shortlist: "Plausible (shortlist)", screened: "Screened, not supported", eliminated: "Eliminated", background: "Background traffic" }[r],
      })),
    });
  }

  const attribution = basemapDef(basemap).attribution;
  const zoomTo = identified
    ? () => {
        if (identified.fit) ws.requestFit(identified.fit);
        else if (identified.at) mapRef.current?.flyTo(identified.at[0], identified.at[1], Math.max(vp?.zoom ?? 8, 10));
      }
    : undefined;

  // Keep the data clear of the panels floating over the map (same sizes as the CSS in app.css).
  const W = vp?.width ?? 1200;
  const H = vp?.height ?? 700;
  const padding: FitPadding = narrow
    ? { top: 64, right: 24, bottom: (ws.panelOpen ? H * 0.5 : 60) + 40, left: 24 }
    : { top: 64, right: (ws.panelOpen ? Math.min(400, W * 0.42) + 12 : 0) + 64, bottom: 56, left: (ws.railOpen ? 312 : 0) + 32 };

  const tools: MapTool[] = [
    { key: "north", label: "North up", icon: <Navigation size={16} />, onClick: () => mapRef.current?.resetNorth() },
    { key: "fit-drift", label: "Show release area and forecast", icon: <Waves size={16} />, onClick: () => ws.requestFit("drift") },
    { key: "fit-ships", label: "Show all ships", icon: <Ship size={16} />, onClick: () => ws.requestFit("ships"), disabled: !c.shipsUnlocked, disabledReason: "Decide on the oil check first" },
    { key: "ship", label: "Centre on the selected ship", icon: <Crosshair size={16} />, onClick: () => ws.requestFit("selected"), disabled: !selected, disabledReason: "Select a ship first" },
    { key: "measure", label: "Measure distance", icon: <Ruler size={16} />, onClick: () => setMeasure((m) => ({ active: !m.active, pts: [] })), pressed: measure.active },
    { key: "tilt", label: ws.tilt ? "Flat map" : "Tilt map (3D)", icon: <span style={{ fontSize: 11, fontWeight: 700 }}>3D</span>, onClick: () => ws.set({ tilt: !ws.tilt }), pressed: ws.tilt },
    { key: "save", label: "Save map image", icon: <Camera size={16} />, onClick: saveImage },
  ];

  return (
    <MapCanvas
      ref={mapRef}
      ariaLabel={`Map of case ${c.bundle.entry.id}`}
      layers={[
        ...layers,
        ...(measure.pts.length ? [measureLayer(measure.pts, P.focus)] : []),
        ...(pin ? [pinLayer(pin, P.focus, P.ink)] : []),
      ]}
      fit={{ bounds: fitBounds, key: `${c.bundle.entry.id}:${ws.fitRequest.n}`, padding, maxZoom: 11.5 }}
      onHover={onHover}
      onClick={onClick}
      onViewport={setVp}
      pitch={ws.tilt ? 50 : 0}
      cursor={measure.active ? "crosshair" : undefined}
    >
      {advanced && <ChartFrame vp={vp} bottomInset={30} />}
      {hover && (
        <MapTooltip x={hover.x} y={hover.y} width={W} height={H}>
          <b>{hover.info.title}</b>
          {hover.info.subtitle && <div className="muted">{hover.info.subtitle}</div>}
          {hover.info.rows.slice(0, 2).map(([k, v]) => <div key={k} className="num">{k}: {v}</div>)}
          <div className="tooltip-hint">Click for details</div>
        </MapTooltip>
      )}
      {measureInfo && <div className="map-banner num">{measureInfo} <span className="muted">(Esc to stop)</span></div>}

      <div className="map-tl">
        <button type="button" className="map-chip layers-chip" aria-pressed={ws.railOpen} onClick={() => ws.set({ railOpen: !ws.railOpen })}>
          <Layers size={15} strokeWidth={1.9} aria-hidden="true" />
          <span>Layers</span>
          <span className="chip-count num" aria-label={`${layersOn} on`}>{layersOn}</span>
        </button>
        <BasemapSwitcher />
        {advanced && (
          <GoTo
            active={Boolean(pin)}
            onGo={(p) => { setPin(p); mapRef.current?.flyTo(p[0], p[1], Math.max(vp?.zoom ?? 7, 8)); }}
            onClear={() => setPin(null)}
          />
        )}
      </div>

      <div className="map-tr">
        {identified && <IdentifyPanel item={identified} decimal={ws.decimalCoords} onClose={() => setIdentified(null)} onZoom={zoomTo} />}
      </div>

      <div className="map-bl">
        <MapLegend groups={legend} />
      </div>
      <div className="map-br">
        {advanced && !narrow && <OverviewMap vp={vp} land={shared.land} onJump={(p) => mapRef.current?.flyTo(p[0], p[1])} />}
        <MapControls
          onZoomIn={() => mapRef.current?.zoomBy(1)}
          onZoomOut={() => mapRef.current?.zoomBy(-1)}
          onFit={() => ws.refit()}
          fitLabel="Fit to this step"
          tools={tools}
        />
      </div>

      <div className="map-statusbar">
        {advanced && (
          <button type="button" className="coord-readout" onClick={() => ws.set({ decimalCoords: !ws.decimalCoords })} title="Switch between degrees-minutes and decimal">
            {cursor ? fmtLonLat(cursor, ws.decimalCoords) : "Move over the map"}
          </button>
        )}
        <ScaleBar vp={vp} units={advanced ? "both" : "km"} />
        {advanced && <span className="status-zoom num" title="Zoom level">z {vp ? vp.zoom.toFixed(1) : "–"}</span>}
        {attribution && <span className="attribution">{attribution}</span>}
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

class PinLayer extends CompositeLayer<{ p: LonLat; color: string; ring: string }> {
  static layerName = "PinLayer";
  renderLayers() {
    const { p, color, ring } = this.props;
    return [
      new ScatterplotLayer({ id: "goto-halo", data: [p], getPosition: (d: LonLat) => d, getRadius: 14, radiusUnits: "pixels", getFillColor: rgba(color, 0.25), stroked: false }),
      new ScatterplotLayer({ id: "goto-dot", data: [p], getPosition: (d: LonLat) => d, getRadius: 6, radiusUnits: "pixels", getFillColor: rgba(color), stroked: true, getLineColor: rgba(ring), getLineWidth: 2, lineWidthUnits: "pixels" }),
    ];
  }
}
function pinLayer(p: LonLat, color: string, ring: string) {
  return new PinLayer({ id: "goto-pin", p, color, ring });
}

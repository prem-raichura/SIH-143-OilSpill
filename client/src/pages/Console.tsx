// Operations console: Sentinel-1 passes arrive in time order and move through the processing stages.
// The machine stages advance on their own; the oil check waits for a person.
import type { WebMercatorViewport } from "@deck.gl/core";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Pause, Play, Radar, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ROLE_TEXT } from "../auth/accounts";
import { canSeeShips, useSession } from "../auth/session";
import { PageHeader, Tabs, Tip, VerdictChip } from "../components/ui";
import { fetchJson, useCasesIndex, useShared } from "../data/load";
import { PLACE, REGION_BOUNDS, REGION_LABEL, type Region } from "../data/places";
import type { CaseIndexEntry, Ledger, Meta, VerdictCode } from "../data/types";
import { PALETTES, rgba } from "../design/palette";
import BasemapSwitcher from "../map/BasemapSwitcher";
import ChartFrame, { graticuleLines } from "../map/ChartFrame";
import { basemapDef, basemapLayers, FONT_SANS } from "../map/layers/basemap";
import MapControls from "../map/MapControls";
import MapLegend from "../map/MapLegend";
import { MapCanvas, type MapHandle } from "../map/MapCanvas";
import { fmtUtc, parseUtc } from "../lib/time";
import { deriveVerdict } from "../lib/verdict";
import { useMapPrefs } from "../store/mapPrefs";
import { useReview } from "../store/review";
import { useTheme } from "../store/theme";

const STAGES = ["Ingested", "Slick detected", "Oil check", "Drift", "Attribution", "Verdict"] as const;
const SECONDS_PER_PASS = 3.2;

interface Pass {
  entry: CaseIndexEntry;
  meta: Meta;
  ledger: Ledger;
  t: number;
}

export default function Console() {
  const index = useCasesIndex();
  const session = useSession((s) => s.session)!;
  const gates = useReview((s) => s.gate);
  const theme = useTheme((s) => s.theme);
  const P = PALETTES[theme];
  const [passes, setPasses] = useState<Pass[]>([]);
  const [progress, setProgress] = useState(0); // passes arrived (fractional)
  const [playing, setPlaying] = useState(true);
  const [region, setRegion] = useState<Region>("india");
  const [vp, setVp] = useState<WebMercatorViewport | null>(null);
  const shared = useShared(region);
  const { basemap, advanced } = useMapPrefs();
  const raf = useRef(0);
  const mapRef = useRef<MapHandle>(null);
  const [fitN, setFitN] = useState(0);

  useEffect(() => {
    if (!index.data) return;
    let live = true;
    Promise.all(
      index.data.cases.map(async (entry) => {
        const [meta, ledger] = await Promise.all([fetchJson<Meta>(`${entry.path}meta.json`), fetchJson<Ledger>(`${entry.path}ledger.json`)]);
        return { entry, meta, ledger, t: parseUtc(entry.t_image) };
      }),
    ).then((ps) => live && setPasses(ps.sort((a, b) => a.t - b.t)));
    return () => {
      live = false;
    };
  }, [index.data]);

  // Feed clock: passes arrive in order of image time.
  useEffect(() => {
    if (!playing || !passes.length) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        const next = p + dt / SECONDS_PER_PASS;
        if (next >= passes.length + 1) {
          setPlaying(false);
          return passes.length + 1;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, passes.length]);

  const arrived = passes.filter((_, i) => i < progress);
  const current = passes[Math.min(passes.length - 1, Math.floor(progress))];
  const feedClock = current ? fmtUtc(current.entry.t_image) : "–";

  // Stage of each arrived pass: machine stages advance with the feed clock; the human oil check waits for a person.
  const stageOf = (p: Pass, i: number): number => {
    const machine = Math.min(2, Math.floor((progress - i) * 3));
    if (machine < 2) return machine;
    const g = gates[p.entry.id];
    if (!g) return 2;
    if (g.label === "lookalike") return 5;
    return 5;
  };

  const feed = [...arrived].map((p, i) => ({ p, i, stage: stageOf(p, i) })).reverse();
  const counts = STAGES.map((_, k) => feed.filter((f) => (k === 2 ? f.stage === 2 : f.stage === k)).length);
  const waiting = feed.filter((f) => f.stage === 2).length;

  const markers = arrived.filter((p) => p.entry.region === region);
  const base = basemapLayers({ land: shared.land, eez: shared.eez, graticule: advanced ? graticuleLines(vp) : [], palette: P, show: { eez: true, graticule: advanced }, region, zoom: vp?.zoom ?? 5, theme, basemap });
  const layers = [
    ...base.under,
    ...base.over,
    new ScatterplotLayer<Pass>({
      id: "console-pulse",
      data: markers.filter((p) => progress - passes.indexOf(p) < 1.2),
      getPosition: (p) => p.meta.slick.measures.centroid,
      getRadius: (p) => 10 + (progress - passes.indexOf(p)) * 30,
      radiusUnits: "pixels",
      stroked: true,
      filled: false,
      getLineColor: (p) => rgba(P.accent, Math.max(0, 1 - (progress - passes.indexOf(p)))),
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      updateTriggers: { getRadius: progress, getLineColor: [progress, theme] },
    }),
    new ScatterplotLayer<Pass>({
      id: "console-markers",
      data: markers,
      getPosition: (p) => p.meta.slick.measures.centroid,
      getRadius: 9,
      radiusUnits: "pixels",
      stroked: true,
      getFillColor: (p) => (gates[p.entry.id] ? rgba(P.teal) : rgba(P.sea)),
      getLineColor: (p) => (gates[p.entry.id] ? rgba(P.teal) : rgba(P.accent)),
      lineWidthUnits: "pixels",
      getLineWidth: 2,
      updateTriggers: { getFillColor: [gates, theme], getLineColor: [gates, theme] },
    }),
    new TextLayer<Pass>({
      id: "console-labels",
      data: markers,
      getPosition: (p) => p.meta.slick.measures.centroid,
      getText: (p) => PLACE[p.entry.id] ?? p.entry.id,
      getSize: 13,
      getColor: rgba(P.ink),
      fontFamily: FONT_SANS,
      fontWeight: 600,
      getPixelOffset: [15, 0],
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      outlineWidth: 4,
      outlineColor: rgba(P.sea),
      fontSettings: { sdf: true },
      characterSet: "auto",
      updateTriggers: { getColor: theme, outlineColor: theme },
    }),
  ];

  const nextStepFor = (stage: number) => (stage === 2 ? "oil" : canSeeShips(session.role) ? "verdict" : "drift");
  const verdictOf = useMemo(() => {
    const m = new Map<string, VerdictCode>();
    for (const p of passes) m.set(p.entry.id, deriveVerdict(p.ledger, p.meta, gates[p.entry.id]?.label ?? null).code);
    return m;
  }, [passes, gates]);

  return (
    <div className="console">
      <aside className="console-feed" aria-label="Satellite pass feed">
        <header className="console-head">
          <PageHeader
            icon={<Radar size={22} strokeWidth={1.8} />}
            title="Console"
            description={<>Signed in as {session.name}, {ROLE_TEXT[session.role].label.toLowerCase()}.</>}
          />
          <div className={`console-alert${waiting > 0 ? " on" : ""}`} role="status">
            {waiting > 0 ? `${waiting} ${waiting === 1 ? "slick waits" : "slicks wait"} for an oil check.` : "No slick is waiting for an oil check."}
          </div>
          <div className="pass-bar">
            <span className="pass-badge"><i aria-hidden="true" /> Satellite pass feed</span>
            <span className="num pass-clock" aria-live="off">{feedClock}</span>
            <span className="pass-ctrls">
              <Tip content={playing ? "Pause feed" : "Resume feed"}>
                <button type="button" className="icon-btn pass-play" aria-label={playing ? "Pause feed" : "Resume feed"} onClick={() => setPlaying((p) => !p)}>
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
              </Tip>
              <Tip content="Restart feed"><button type="button" className="icon-btn" aria-label="Restart feed" onClick={() => { setProgress(0); setPlaying(true); }}><RotateCcw size={15} /></button></Tip>
              <Tip content="Show all passes"><button type="button" className="icon-btn" aria-label="Show all passes" onClick={() => { setProgress(passes.length + 1); setPlaying(false); }}><SkipForward size={15} /></button></Tip>
            </span>
          </div>
          <div className="pass-progress" aria-hidden="true"><span style={{ width: `${passes.length ? Math.min(100, (progress / (passes.length + 1)) * 100) : 0}%` }} /></div>
        </header>
        <ol className="feed" aria-live="polite">
          {feed.map(({ p, i, stage }) => {
            const g = gates[p.entry.id];
            const sat = p.meta.satellite;
            return (
              <li key={p.entry.id} className={`feed-item${stage === 2 ? " waiting" : ""}${progress - i < 1 ? " fresh" : ""}`}>
                <div className="feed-top">
                  <span className="num t-label">{fmtUtc(p.entry.t_image)}</span>
                  {stage >= 5 && g && <VerdictChip code={verdictOf.get(p.entry.id)!} />}
                </div>
                <span className="place feed-place">{PLACE[p.entry.id]}</span>
                <span className="feed-product num">{sat ? sat.product_id : "No satellite product: outline only"}</span>
                <ol className="feed-stages" aria-label="Processing stages">
                  {STAGES.map((s, k) => (
                    <li key={s} className={k < stage ? "done" : k === stage ? (k === 2 ? "wait" : "now") : ""}>
                      {k === 2 && g ? (g.label === "lookalike" ? "Look-alike" : g.label === "uncertain" ? "Not sure" : "Oil confirmed") : s}
                    </li>
                  ))}
                </ol>
                <div className="feed-foot">
                  {stage >= 2 && (
                    <Link className={`btn ${stage === 2 ? "btn-primary" : "btn-secondary"}`} to={`/app/case/${p.entry.id}?step=${nextStepFor(stage)}`}>
                      {stage === 2 ? "Do the oil check" : "Open case"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
          {!feed.length && <li className="empty" style={{ margin: 16 }}>Waiting for the first pass…</li>}
        </ol>
      </aside>
      <section className="console-main">
        <div className="console-maphead">
          <Tabs<Region> label="Region" value={region} onChange={setRegion} options={[
            { value: "india", label: REGION_LABEL.india, badge: arrived.filter((p) => p.entry.region === "india").length },
            { value: "gulf_of_mexico", label: REGION_LABEL.gulf_of_mexico, badge: arrived.filter((p) => p.entry.region === "gulf_of_mexico").length },
          ]} />
        </div>
        <div className="console-map">
          <MapCanvas ref={mapRef} ariaLabel="Map of incoming slicks" layers={layers} fit={{ bounds: REGION_BOUNDS[region], key: `${region}:${fitN}`, padding: 32 }} onViewport={setVp}>
            {advanced && <ChartFrame vp={vp} bottomInset={30} />}
            <div className="map-tl"><BasemapSwitcher /></div>
            <div className="map-bl">
              <MapLegend groups={[{
                title: "Passes",
                items: [
                  { key: "new", swatch: <svg width="20" height="14" aria-hidden="true"><circle cx="10" cy="7" r="5" fill="var(--sea)" stroke="var(--accent)" strokeWidth="2" /></svg>, label: "Slick, waiting for review" },
                  { key: "done", swatch: <svg width="20" height="14" aria-hidden="true"><circle cx="10" cy="7" r="5" fill="var(--teal)" stroke="var(--teal)" strokeWidth="2" /></svg>, label: "Oil check answered" },
                  { key: "eez", swatch: <svg width="20" height="14" aria-hidden="true"><path d="M1 7H19" stroke="var(--ink-2)" strokeDasharray="4 2" /></svg>, label: "EEZ boundary" },
                ],
              }]} />
            </div>
            <div className="map-br">
              <MapControls
                onZoomIn={() => mapRef.current?.zoomBy(1)}
                onZoomOut={() => mapRef.current?.zoomBy(-1)}
                onFit={() => setFitN((n) => n + 1)}
                fitLabel={`Show all of ${REGION_LABEL[region]}`}
              />
            </div>
            <div className="map-statusbar">
              <span>{markers.length} of {passes.filter((p) => p.entry.region === region).length} passes in view</span>
              {advanced && <span className="status-zoom num">z {vp ? vp.zoom.toFixed(1) : "–"}</span>}
              {basemapDef(basemap).attribution && <span className="attribution">{basemapDef(basemap).attribution}</span>}
            </div>
          </MapCanvas>
        </div>
        <div className="pipeline" aria-label="Pipeline status">
          <ol className="pipeline-strip">
            {STAGES.map((s, k) => {
              const n = k === 5 ? feed.filter((f) => f.stage === 5).length : counts[k];
              const tone = k === 2 && n ? "warn" : k === 5 && n ? "teal" : "";
              return (
                <li key={s} className={tone}>
                  <b className="num">{n}</b>
                  <span>{k === 2 ? "Waiting for oil check" : k === 5 ? "Verdict ready" : s}</span>
                </li>
              );
            })}
          </ol>
          <Tip content={<>Machine stages run automatically. The oil check waits for a person; drift, attribution and the verdict follow it.{!canSeeShips(session.role) && " Your role sees oil checks and drift, not candidate ships."}</>}>
            <span className="pipe-note t-label" tabIndex={0}>How the stages work</span>
          </Tip>
        </div>
      </section>
    </div>
  );
}

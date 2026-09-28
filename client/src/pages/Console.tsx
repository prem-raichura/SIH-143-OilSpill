// Operations console: a replay of the archived Sentinel-1 passes behind the 12 cases, processed on a clock.
// Scene IDs and acquisition times are real (meta.json). Processing is replayed; the console says so.
import type { WebMercatorViewport } from "@deck.gl/core";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ROLE_TEXT } from "../auth/demoAccounts";
import { canSeeShips, useSession } from "../auth/session";
import { ProvenanceBadges, Segmented, VerdictChip } from "../components/ui";
import { fetchJson, useCasesIndex, useShared } from "../data/load";
import { PLACE, REGION_LABEL } from "../data/places";
import type { CaseIndexEntry, Ledger, Meta, VerdictCode } from "../data/types";
import { PALETTES, rgba } from "../design/palette";
import ChartFrame, { graticuleLines } from "../map/ChartFrame";
import { basemapLayers, FONT_SANS } from "../map/layers/basemap";
import { MapCanvas } from "../map/MapCanvas";
import { fmtUtc, parseUtc } from "../lib/time";
import { deriveVerdict } from "../lib/verdict";
import { useReview } from "../store/review";
import { useTheme } from "../store/theme";

type Region = "india" | "gulf_of_mexico";
const REGION_BOUNDS: Record<Region, [number, number, number, number]> = { india: [66, 6.5, 85, 22.5], gulf_of_mexico: [-98, 23, -86, 31] };

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
  const raf = useRef(0);

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

  // Replay clock
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
  const replayClock = current ? fmtUtc(current.entry.t_image) : "–";

  // Stage of each arrived pass: machine stages advance with the replay; the human oil check waits for a person.
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
  const layers = [
    ...basemapLayers({ land: shared.land, eez: shared.eez, graticule: graticuleLines(vp), palette: P, show: { eez: true, graticule: true }, region, zoom: vp?.zoom ?? 5, theme }),
    new ScatterplotLayer<Pass>({
      id: "console-pulse",
      data: markers.filter((p) => progress - passes.indexOf(p) < 1.2),
      getPosition: (p) => p.meta.slick.measures.centroid,
      getRadius: (p) => 10 + (progress - passes.indexOf(p)) * 30,
      radiusUnits: "pixels",
      stroked: true,
      filled: false,
      getLineColor: (p) => rgba(P.ink, Math.max(0, 1 - (progress - passes.indexOf(p)))),
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      updateTriggers: { getRadius: progress, getLineColor: [progress, theme] },
    }),
    new ScatterplotLayer<Pass>({
      id: "console-markers",
      data: markers,
      getPosition: (p) => p.meta.slick.measures.centroid,
      getRadius: 7,
      radiusUnits: "pixels",
      stroked: true,
      getFillColor: (p) => (gates[p.entry.id] ? rgba(P.ink) : rgba(P.sea)),
      getLineColor: rgba(P.ink),
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      updateTriggers: { getFillColor: [gates, theme], getLineColor: theme },
    }),
    new TextLayer<Pass>({
      id: "console-labels",
      data: markers,
      getPosition: (p) => p.meta.slick.measures.centroid,
      getText: (p) => p.entry.id,
      getSize: 12,
      getColor: rgba(P.ink),
      fontFamily: FONT_SANS,
      fontWeight: 600,
      getPixelOffset: [12, 0],
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      outlineWidth: 3,
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
          <div>
            <h1 className="t-page">Console</h1>
            <p className="muted" style={{ fontSize: 13 }}>
              Signed in as {session.name}, {ROLE_TEXT[session.role].label.toLowerCase()}. {waiting > 0 ? `${waiting} ${waiting === 1 ? "slick waits" : "slicks wait"} for an oil check.` : "No slick is waiting for an oil check."}
            </p>
          </div>
          <div className="replay-bar">
            <span className="replay-badge"><i aria-hidden="true" /> Replay of archived passes</span>
            <span className="num replay-clock" aria-live="off">{replayClock}</span>
            <span className="replay-ctrls">
              <button type="button" className="icon-btn" aria-label={playing ? "Pause replay" : "Play replay"} onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button type="button" className="icon-btn" aria-label="Restart replay" onClick={() => { setProgress(0); setPlaying(true); }}><RotateCcw size={15} /></button>
              <button type="button" className="icon-btn" aria-label="Show all passes now" onClick={() => { setProgress(passes.length + 1); setPlaying(false); }}><SkipForward size={15} /></button>
            </span>
          </div>
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
                <span className="feed-product num">{sat ? sat.product_id : "Simulated slick (synthetic scenario), no satellite product"}</span>
                <ol className="feed-stages" aria-label="Processing stages">
                  {STAGES.map((s, k) => (
                    <li key={s} className={k < stage ? "done" : k === stage ? (k === 2 ? "wait" : "now") : ""}>
                      {k === 2 && g ? (g.label === "lookalike" ? "Look-alike" : g.label === "uncertain" ? "Not sure" : "Oil confirmed") : s}
                    </li>
                  ))}
                </ol>
                <div className="feed-foot">
                  <ProvenanceBadges labels={p.entry.labels} />
                  {stage >= 2 && (
                    <Link className={`btn ${stage === 2 ? "btn-primary" : "btn-secondary"}`} to={`/app/case/${p.entry.id}?step=${nextStepFor(stage)}`}>
                      {stage === 2 ? "Do the oil check" : "Open case"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
          {!feed.length && <li className="muted" style={{ padding: 16 }}>Waiting for the first pass…</li>}
        </ol>
      </aside>
      <section className="console-main">
        <div className="console-map">
          <div className="view-switch" style={{ top: 12 }}>
            <Segmented<Region> label="Region" value={region} onChange={setRegion} options={[{ value: "india", label: REGION_LABEL.india }, { value: "gulf_of_mexico", label: REGION_LABEL.gulf_of_mexico }]} />
          </div>
          <MapCanvas ariaLabel="Map of incoming slicks" layers={layers} fit={{ bounds: REGION_BOUNDS[region], key: region, padding: 24 }} onViewport={setVp}>
            <ChartFrame vp={vp} />
          </MapCanvas>
        </div>
        <div className="pipeline" aria-label="Pipeline status">
          {STAGES.map((s, k) => (
            <div key={s} className={`pipe-stage${k === 2 && counts[2] ? " attention" : ""}`}>
              <span className="pipe-n num">{k === 5 ? feed.filter((f) => f.stage === 5).length : counts[k]}</span>
              <span className="pipe-label">{k === 2 ? "Waiting for oil check" : k === 5 ? "Verdict ready" : s}</span>
            </div>
          ))}
          <p className="pipe-note">
            Machine stages run automatically. The oil check waits for a person; drift, attribution and the verdict follow it.
            {!canSeeShips(session.role) && " Your role sees oil checks and drift, not candidate ships."}
          </p>
        </div>
      </section>
    </div>
  );
}

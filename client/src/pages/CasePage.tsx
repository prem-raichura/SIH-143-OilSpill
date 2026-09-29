import { Box, Check, ChevronLeft, Clock3, FileText, Lock, Map as MapIcon } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CaseMap from "../case/CaseMap";
import LayerRail from "../case/LayerRail";
import StepPanel, { stepAllowed } from "../case/StepPanel";
import TimelineDock from "../case/TimelineDock";
import { CaseCtx, useCaseDerived } from "../case/useCase";
import { ErrorNote, Loading, Segmented, Tip, VerdictChip } from "../components/ui";
import { useCaseBundle } from "../data/load";
import { PLACE } from "../data/places";
import { fmtUtc } from "../lib/time";
import { useClock } from "../store/clock";
import { useReview } from "../store/review";
import { STEPS, useWorkspace, type Step, type View } from "../store/workspace";

const OceanScene = lazy(() => import("../scene3d/OceanScene"));
/** Steps grouped into the three phases of an investigation (shown as labels in the stepper). */
const PHASE: Partial<Record<Step, string>> = { image: "Detect", drift: "Trace", ships: "Attribute" };
const SpaceTimeCube = lazy(() => import("../cube/SpaceTimeCube"));

export default function CasePage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const bundle = useCaseBundle(id);
  const hydrated = useReview((s) => s.hydrated);
  // Wait for saved oil-check decisions before applying the step from the URL (locked steps depend on them).
  const c = useCaseDerived(hydrated ? bundle.data : undefined);
  const ws = useWorkspace();
  const setRange = useClock((s) => s.setRange);

  useEffect(() => {
    if (!c) return;
    const fresh = ws.caseId !== c.bundle.entry.id;
    ws.enterCase(c.bundle.entry.id);
    setRange(c.range.min, c.range.max);
    if (fresh) useClock.getState().setH(0);
    const s = params.get("step") as Step | null;
    if (s && STEPS.some((x) => x.id === s) && stepAllowed(s, c).ok) ws.setStep(s);
  }, [c?.bundle.entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow a step change in the URL (links, back button).
  const urlStep = params.get("step") as Step | null;
  useEffect(() => {
    if (!c || ws.caseId !== c.bundle.entry.id || !urlStep || urlStep === ws.step) return;
    if (STEPS.some((x) => x.id === urlStep) && stepAllowed(urlStep, c).ok) ws.setStep(urlStep);
  }, [urlStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the step in the URL so views can be linked and reloaded.
  useEffect(() => {
    if (!c || ws.caseId !== c.bundle.entry.id) return;
    if (params.get("step") !== ws.step) setParams({ step: ws.step }, { replace: true });
  }, [ws.step, ws.caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving a case stops playback.
  useEffect(() => () => useClock.getState().pause(), []);

  if (bundle.error) return <div className="page-pad"><ErrorNote error={bundle.error} /></div>;
  if (!c) return <div className="page-pad"><Loading lines={6} /></div>;

  const { entry } = c.bundle;
  const railShown = ws.view === "map" && ws.railOpen;
  return (
    <CaseCtx.Provider value={c}>
      <div className="ws">
        <nav className="skip-links" aria-label="Skip links">
          <a href="#step-panel" onClick={(e) => { e.preventDefault(); if (!ws.panelOpen) ws.set({ panelOpen: true }); document.getElementById("step-panel")?.focus(); }}>Skip to step details</a>
          <a href="#case-map" onClick={(e) => { e.preventDefault(); (document.querySelector("#case-map canvas")?.parentElement as HTMLElement | null)?.focus(); }}>Skip to the map</a>
          <a href="#timeline" onClick={(e) => { e.preventDefault(); (document.querySelector("#timeline svg") as HTMLElement | null)?.focus(); }}>Skip to the timeline</a>
        </nav>
        <header className="ws-head">
          <Link to="/app/cases" className="back"><ChevronLeft size={15} /> Cases</Link>
          <div className="ws-title">
            <h1 className="place">{PLACE[entry.id]}</h1>
            <span className="id num">{entry.id}</span>
            <span className="when">{fmtUtc(entry.t_image)}</span>
          </div>
          <div className="ws-head-right">
            <Segmented<View>
              label="View"
              size="sm"
              value={ws.view}
              onChange={ws.setView}
              options={[
                { value: "map", label: <><MapIcon size={14} strokeWidth={1.8} /> Map</> },
                { value: "scene", label: <><Box size={14} strokeWidth={1.8} /> 3D scene</>, title: "Illustration built from the case data, not evidence" },
                { value: "cube", label: <><Clock3 size={14} strokeWidth={1.8} /> Space-time cube</>, title: "Time runs upward: the image sits on top" },
              ]}
            />
            {c.analyst ? (
              <span className="t-label">Analyst view: oil review only</span>
            ) : c.gate ? (
              <VerdictChip code={c.verdict.code} />
            ) : (
              <span className="t-label">Verdict after the oil check</span>
            )}
            {!c.analyst && <Link className="btn btn-accent-outline" to={`/app/case/${entry.id}/report`}><FileText size={14} /> Report</Link>}
          </div>
        </header>
        <nav className="stepper" aria-label="Investigation steps">
          {(() => {
            const visible = STEPS.filter((s) => !stepAllowed(s.id, c).hidden);
            const idx = visible.findIndex((x) => x.id === ws.step);
            return visible.map((s, i) => {
              const allowed = stepAllowed(s.id, c);
              const cur = ws.step === s.id;
              const done = i < idx;
              const btn = (
                <button key={s.id} type="button" className={`step-btn${done ? " done" : ""}${!allowed.ok ? " locked" : ""}`} aria-current={cur ? "step" : undefined}
                  disabled={!allowed.ok} onClick={() => ws.setStep(s.id)}>
                  <span className="n" aria-hidden={done ? true : undefined}>{done ? <Check size={12} strokeWidth={3} /> : !allowed.ok ? <Lock size={11} aria-label="Locked" /> : i + 1}</span>
                  <span className="lbl">{s.label}</span>
                </button>
              );
              return (
                <span key={s.id} className="step-item">
                  {PHASE[s.id] && <span className={`step-phase${i > 0 ? " sep" : ""}`}>{PHASE[s.id]}</span>}
                  {i > 0 && !PHASE[s.id] && <span className={`step-sep${done || cur ? " on" : ""}`} aria-hidden="true" />}
                  {allowed.ok ? btn : <Tip content={allowed.why}>{<span style={{ display: "inline-flex" }}>{btn}</span>}</Tip>}
                </span>
              );
            });
          })()}
        </nav>
        <div className={`ws-stage${ws.panelOpen ? " panel-open" : ""}${railShown ? " rail-open" : ""}`}>
          <section className="ws-view" id="case-map" aria-label={ws.view === "map" ? "Map" : ws.view === "scene" ? "3D scene" : "Space-time cube"}>
            {ws.view === "map" && <CaseMap />}
            {ws.view !== "map" && (
              <Suspense fallback={<div className="page-pad"><Loading lines={3} /></div>}>
                {ws.view === "scene" ? <OceanScene /> : <SpaceTimeCube />}
              </Suspense>
            )}
          </section>
          {railShown && <LayerRail />}
          <StepPanel />
        </div>
        {ws.step !== "oil" && <TimelineDock />}
      </div>
    </CaseCtx.Provider>
  );
}

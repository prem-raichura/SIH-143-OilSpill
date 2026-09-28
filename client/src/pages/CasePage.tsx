import { ChevronLeft, FileText, Lock } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CaseMap from "../case/CaseMap";
import LayerRail from "../case/LayerRail";
import StepPanel, { stepAllowed } from "../case/StepPanel";
import TimelineDock from "../case/TimelineDock";
import { CaseCtx, useCaseDerived } from "../case/useCase";
import { ErrorNote, Loading, ProvenanceBadges, Segmented, Tip, VerdictChip } from "../components/ui";
import { useCaseBundle } from "../data/load";
import { PLACE } from "../data/places";
import { fmtUtc } from "../lib/time";
import { useClock } from "../store/clock";
import { useReview } from "../store/review";
import { STEPS, useWorkspace, type Step, type View } from "../store/workspace";

const OceanScene = lazy(() => import("../scene3d/OceanScene"));
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
  return (
    <CaseCtx.Provider value={c}>
      <div className="ws">
        <nav className="skip-links" aria-label="Skip links">
          <a href="#step-panel" onClick={(e) => { e.preventDefault(); document.getElementById("step-panel")?.focus(); }}>Skip to step details</a>
          <a href="#case-map" onClick={(e) => { e.preventDefault(); (document.querySelector("#case-map canvas")?.parentElement as HTMLElement | null)?.focus(); }}>Skip to the map</a>
          <a href="#timeline" onClick={(e) => { e.preventDefault(); (document.querySelector("#timeline svg") as HTMLElement | null)?.focus(); }}>Skip to the timeline</a>
        </nav>
        <header className="ws-head">
          <Link to="/app/cases" className="back"><ChevronLeft size={15} /> Cases</Link>
          <div className="ws-title">
            <span className="id">{entry.id}</span>
            <span className="place">{PLACE[entry.id]}</span>
            <span className="when">{fmtUtc(entry.t_image)}</span>
          </div>
          <ProvenanceBadges labels={entry.labels} />
          <div className="ws-head-right">
            {c.analyst ? (
              <span className="t-label">Analyst view: oil review only</span>
            ) : c.gate ? (
              <VerdictChip code={c.verdict.code} />
            ) : (
              <span className="t-label">Verdict after the oil check</span>
            )}
            {!c.analyst && <Link className="btn btn-secondary" to={`/app/case/${entry.id}/report`}><FileText size={14} /> Report</Link>}
          </div>
        </header>
        <nav className="stepper" aria-label="Investigation steps">
          {STEPS.filter((s) => !stepAllowed(s.id, c).hidden).map((s, i) => {
            const allowed = stepAllowed(s.id, c);
            const cur = ws.step === s.id;
            const idx = STEPS.findIndex((x) => x.id === ws.step);
            const btn = (
              <button key={s.id} type="button" className={`step-btn${i < idx ? " done" : ""}`} aria-current={cur ? "step" : undefined}
                disabled={!allowed.ok} onClick={() => ws.setStep(s.id)}>
                <span className="n">{i + 1}</span>
                <span className="lbl">{s.label}</span>
                {!allowed.ok && <Lock size={12} aria-label="Locked" />}
              </button>
            );
            return (
              <span key={s.id} style={{ display: "contents" }}>
                {i > 0 && <span className="step-sep" aria-hidden="true" />}
                {allowed.ok ? btn : <Tip content={allowed.why}>{<span style={{ display: "inline-flex" }}>{btn}</span>}</Tip>}
              </span>
            );
          })}
        </nav>
        <div className={`ws-body${ws.railOpen ? "" : " rail-closed"}`}>
          <LayerRail />
          <section className="ws-center" id="case-map" aria-label="Map and 3D views">
            <div className="view-switch">
              <Segmented<View>
                label="View"
                value={ws.view}
                onChange={ws.setView}
                options={[
                  { value: "map", label: "Map" },
                  { value: "scene", label: "3D scene" },
                  { value: "cube", label: "Space-time" },
                ]}
              />
            </div>
            {ws.view === "map" && <CaseMap />}
            {ws.view !== "map" && (
              <Suspense fallback={<div className="page-pad"><Loading lines={3} /></div>}>
                {ws.view === "scene" ? <OceanScene /> : <SpaceTimeCube />}
              </Suspense>
            )}
          </section>
          <StepPanel />
        </div>
        {ws.step !== "oil" && <TimelineDock />}
      </div>
    </CaseCtx.Provider>
  );
}

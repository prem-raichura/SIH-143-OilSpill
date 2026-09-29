import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { ReactNode } from "react";
import { NARROW, useMedia } from "../lib/useMedia";
import { STEPS, useWorkspace, type Step } from "../store/workspace";
import { useCase, type CaseDerived } from "./useCase";
import ImageStep from "./steps/ImageStep";
import OilCheckStep from "./steps/OilCheckStep";
import SlickStep from "./steps/SlickStep";
import DriftStep from "./steps/DriftStep";
import ShipsStep from "./steps/ShipsStep";
import EvidenceStep from "./steps/EvidenceStep";
import VerdictStep from "./steps/VerdictStep";
import FollowUpStep from "./steps/FollowUpStep";

export function stepAllowed(step: Step, c: CaseDerived): { ok: boolean; why?: string; hidden?: boolean } {
  if (c.analyst && ["ships", "evidence", "verdict", "followup"].includes(step)) {
    return { ok: false, hidden: true, why: "Analysts review oil only and never see candidate ships" };
  }
  if (step === "verdict" && c.closedAtVerdict1) return { ok: true };
  const def = STEPS.find((s) => s.id === step)!;
  if (def.locked && !c.gate) return { ok: false, why: "Decide on the oil check first" };
  if (def.locked && c.closedAtVerdict1) return { ok: false, why: "Case closed at verdict 1 (look-alike)" };
  if (step === "followup" && ![3, 4].includes(c.verdict.code)) return { ok: false, why: "Follow-up runs only for a leading candidate or a shortlist" };
  return { ok: true };
}

export function PanelHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="panel-title">
      <h2 className="t-panel">{title}</h2>
      {children && <p>{children}</p>}
    </header>
  );
}

const BODY: Record<Step, () => ReactNode> = {
  image: () => <ImageStep />,
  oil: () => <OilCheckStep />,
  slick: () => <SlickStep />,
  drift: () => <DriftStep />,
  ships: () => <ShipsStep />,
  evidence: () => <EvidenceStep />,
  verdict: () => <VerdictStep />,
  followup: () => <FollowUpStep />,
};

/**
 * Step details. On wide screens a panel floating over the right of the map that can be hidden;
 * on narrow screens a bottom sheet that collapses to its title bar.
 */
export default function StepPanel() {
  const c = useCase();
  const { step, setStep, panelOpen, set } = useWorkspace();
  const narrow = useMedia(NARROW);
  const i = STEPS.findIndex((s) => s.id === step);
  const prev = STEPS[i - 1];
  let next = STEPS[i + 1];
  if (next && next.id === "followup" && !stepAllowed("followup", c).ok) next = undefined as never;
  const nextAllowed = next ? stepAllowed(next.id, c) : { ok: false };
  const visible = STEPS.filter((s) => !stepAllowed(s.id, c).hidden);
  const vi = visible.findIndex((s) => s.id === step);
  const title = (
    <span className="panel-bar-title">
      {vi >= 0 && <span className="num">Step {vi + 1} of {visible.length}</span>}
      <b>{STEPS[i].label}</b>
    </span>
  );
  const toggle = () => set({ panelOpen: !panelOpen });
  return (
    <>
      {!narrow && !panelOpen && (
        <button type="button" className="panel-reopen" onClick={toggle} aria-controls="step-panel" aria-expanded={false}>
          <PanelRightOpen size={16} aria-hidden="true" />
          {title}
        </button>
      )}
      <aside className={`panel${panelOpen ? " open" : ""}`} id="step-panel" tabIndex={-1} aria-label="Step details" hidden={!narrow && !panelOpen}>
        <button type="button" className="panel-bar" onClick={toggle} aria-expanded={panelOpen} aria-label={panelOpen ? "Hide step details" : "Show step details"}>
          {narrow && <span className="panel-grip" aria-hidden="true" />}
          {title}
          <span className="panel-bar-icon" aria-hidden="true">
            {narrow ? (panelOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />) : <PanelRightClose size={16} />}
          </span>
        </button>
        <div className="panel-scroll" key={step} hidden={!panelOpen}>
          {BODY[step]()}
        </div>
        <div className="panel-foot" hidden={!panelOpen}>
          {prev ? (
            <button type="button" className="btn btn-quiet" onClick={() => setStep(prev.id)}>
              <ChevronLeft size={15} /> {prev.label}
            </button>
          ) : <span />}
          {next && (
            <button type="button" className="btn btn-primary" disabled={!nextAllowed.ok} title={nextAllowed.why} onClick={() => setStep(next.id)}>
              Next: {next.label} <ChevronRight size={15} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

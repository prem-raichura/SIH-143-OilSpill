import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
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

export default function StepPanel() {
  const c = useCase();
  const { step, setStep } = useWorkspace();
  const i = STEPS.findIndex((s) => s.id === step);
  const prev = STEPS[i - 1];
  let next = STEPS[i + 1];
  if (next && next.id === "followup" && !stepAllowed("followup", c).ok) next = undefined as never;
  const nextAllowed = next ? stepAllowed(next.id, c) : { ok: false };
  return (
    <aside className="panel" id="step-panel" tabIndex={-1} aria-label="Step details">
      <div className="panel-scroll" key={step}>
        {BODY[step]()}
      </div>
      <div className="panel-foot">
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
  );
}

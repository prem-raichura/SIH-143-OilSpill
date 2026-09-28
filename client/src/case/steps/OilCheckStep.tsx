import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Section } from "../../components/ui";
import { fmtClock } from "../../lib/time";
import type { GateLabel } from "../../lib/verdict";
import { useReview } from "../../store/review";
import { useWorkspace } from "../../store/workspace";
import { PanelHead } from "../StepPanel";
import { useCase } from "../useCase";

const REASONS = ["Slick shape and edges", "Dark area with sharp edges", "Wind too low (calm sea)", "Natural film or algae", "Near-shore runoff", "Rain cell or current front", "Other"];

const LABELS: Record<GateLabel, { text: string; icon: typeof CheckCircle2 }> = {
  confirmed_oil: { text: "Confirm oil", icon: CheckCircle2 },
  lookalike: { text: "Mark as look-alike", icon: XCircle },
  uncertain: { text: "Not sure", icon: HelpCircle },
};

export default function OilCheckStep() {
  const c = useCase();
  const { setGate, clearGate, addFeedback, blindMode, setBlindMode } = useReview();
  const { toggleLayer, setStep } = useWorkspace();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [firstAnswer, setFirstAnswer] = useState<GateLabel | null>(null);
  const gate = c.gate;
  const blindActive = blindMode && !gate && !firstAnswer;

  // Blind review: the outline stays hidden until the first answer.
  useEffect(() => {
    toggleLayer("slick", !blindActive);
  }, [blindActive, toggleLayer]);

  const decide = (label: GateLabel) => {
    if (blindMode && !firstAnswer) {
      setFirstAnswer(label);
      return;
    }
    const { meta, entry } = c.bundle;
    const blind = blindMode;
    setGate({ caseId: entry.id, label, reason, note, at: new Date().toISOString(), blind, sawMaskFirst: !blind });
    addFeedback({
      incident_id: entry.id,
      image_id: meta.satellite?.product_id ?? `${entry.id}-simulated`,
      ai_prediction: "oil",
      ai_confidence: meta.slick.measures.cerulean_machine_confidence ?? null,
      human_label: label === "confirmed_oil" ? "CONFIRMED_OIL" : label === "lookalike" ? "LOOKALIKE" : "UNCERTAIN",
      corrected_mask: null,
      reason,
      notes: note + (firstAnswer && firstAnswer !== label ? ` (blind first answer: ${firstAnswer})` : ""),
      reviewer_saw_ai_mask: !blind || Boolean(firstAnswer),
      blind_review: blind,
      source: "case",
    });
    setFirstAnswer(null);
  };

  if (gate) {
    const L = LABELS[gate.label];
    return (
      <>
        <PanelHead title="Oil check">A person looked at the image and the detection only, before any ship data was shown.</PanelHead>
        <div className="oil-question" role="status">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <L.icon size={18} />
            <b>
              {gate.label === "confirmed_oil" ? "You confirmed oil" : gate.label === "lookalike" ? "You marked it as a look-alike" : "You marked it as not sure"} at {fmtClock(gate.at)}
            </b>
          </span>
          <span className="muted">Reason: {gate.reason}{gate.note ? `. ${gate.note}` : ""}</span>
          {gate.label === "lookalike" ? (
            <p className="note note-strong">The case stops at verdict 1 (not oil). Drift can still be viewed; ships and scores stay hidden.</p>
          ) : gate.label === "uncertain" ? (
            <p className="note note-strong">Ships are unlocked. The case is flagged as uncertain in the verdict and the report.</p>
          ) : (
            <p className="note note-strong">Ships are unlocked.</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {gate.label === "lookalike" ? (
              <button type="button" className="btn btn-primary" onClick={() => setStep("verdict")}>See verdict 1</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setStep("slick")}>Continue to the slick</button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => clearGate(c.bundle.entry.id)}>Change decision</button>
          </div>
        </div>
        <p className="note">Every decision is saved to the review log in this browser. Nothing retrains automatically.</p>
      </>
    );
  }

  return (
    <>
      <PanelHead title="Oil check">
        Does this dark patch look like oil? Ships and scores stay hidden until you decide, so the answer is not swayed by any suspect.
      </PanelHead>
      <div className="oil-question">
        {blindActive ? (
          <p className="note note-strong">Blind review: the detector outline is hidden. Judge the image first.</p>
        ) : firstAnswer ? (
          <p className="note note-strong">Your first answer: {LABELS[firstAnswer].text.toLowerCase()}. The detector outline is now shown. Confirm or change.</p>
        ) : null}
        <div className="oil-actions">
          {(Object.keys(LABELS) as GateLabel[]).map((k) => {
            const L = LABELS[k];
            return (
              <button key={k} type="button" className={`btn btn-lg ${k === "confirmed_oil" ? "btn-primary" : "btn-secondary"}`} onClick={() => decide(k)} style={{ justifyContent: "flex-start" }}>
                <L.icon size={17} /> {L.text}
              </button>
            );
          })}
        </div>
        <label className="field">
          <span className="t-label">Reason</span>
          <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="t-label">Note (optional)</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you saw" />
        </label>
      </div>
      <Section title="Review settings">
        <label className="check-row">
          <span />
          <span>Blind review (hide the detector outline until the first answer)</span>
          <input type="checkbox" checked={blindMode} onChange={(e) => setBlindMode(e.target.checked)} />
        </label>
        <p className="note">
          The stored analysis assumed "confirmed oil". Marking a look-alike here stops this case at verdict 1. Blind reviews measure how much
          reviewers lean on the detector.
        </p>
      </Section>
    </>
  );
}

import { Eye } from "lucide-react";
import { useState } from "react";
import { KV, Section } from "../../components/ui";
import { fmtUtc, fmtRel } from "../../lib/time";
import { useReview } from "../../store/review";
import { useWorkspace } from "../../store/workspace";
import { PanelHead } from "../StepPanel";
import { useCase } from "../useCase";

const SOURCE_NOTE: Record<string, string> = {
  "vessel without AIS": "The slick shape fits a moving ship, but no AIS ship fits. A ship with AIS switched off is the probable source type.",
  "platform or pipeline": "A known offshore platform lies next to the slick. A fixed installation is the probable source type.",
  undetermined: "No AIS ship fits and the shape gives no source-type indication.",
};

export default function VerdictStep() {
  const c = useCase();
  const ws = useWorkspace();
  const { setReview } = useReview();
  const review = useReview((s) => s.reviews[c.bundle.entry.id]);
  const [note, setNote] = useState(review?.note ?? "");
  const d = c.verdict;
  const v = c.bundle.ledger.verdict;
  const key = c.bundle.ledger.scenario_key;
  const revealed = ws.revealed[c.bundle.entry.id];
  const lead = d.code === 3 ? d.lead : undefined;

  const statement =
    d.code === 1 ? "Not oil (likely a look-alike)"
      : d.code === 2 ? "Insufficient data for attribution"
      : d.code === 3 ? `Leading candidate: ${lead?.name ?? v.name}`
      : d.code === 4 ? "Multiple plausible candidates"
      : "No consistent AIS vessel";

  return (
    <>
      <PanelHead title="Verdict" />
      <div className="verdict-box" role="status" aria-live="polite">
        <span className="t-label">Verdict {d.code} of 5</span>
        <p className="t-verdict">{statement}</p>
        {d.code === 3 && lead && (
          <p className="num">Best-fit release {fmtUtc(lead.best_fit_release_time)} ({fmtRel(-lead.best_fit_age_h)})</p>
        )}
        {d.code === 4 && <p>No ship named. The evidence does not separate the shortlisted ships.</p>}
        {d.code === 5 && <p>Probable source: <b>{v.probable_source}</b>. {SOURCE_NOTE[v.probable_source ?? "undetermined"] ?? ""}</p>}
        {d.code === 2 && <p>{v.reason}</p>}
        {d.code === 1 && <p>The oil check marked this slick as a look-alike, so no ship is examined.</p>}
        {c.gate?.label === "uncertain" && <p className="note note-strong">Flagged: the oil check answer was "not sure".</p>}
      </div>

      <Section title="Checked in order, first match wins">
        <ol className="check-list">
          {d.checks.map((ch) => (
            <li key={ch.order} className={ch.status}>
              <span className="o">{ch.order}</span>
              <span className="q">{ch.question}</span>
              <span className="s">{ch.status === "fired" ? "Verdict" : ch.status === "continue" ? "Continue" : ""}</span>
              <span className="d">{ch.detail}</span>
            </li>
          ))}
        </ol>
        <p className="note">Thresholds are tuned on the synthetic benchmark to a target wrongful-naming rate of 5 %.</p>
      </Section>

      {d.code === 4 && v.shortlist && (
        <Section title="Shortlist">
          <div className="list">
            {v.shortlist.map((s) => (
              <button key={s.mmsi} type="button" className="list-row" onClick={() => { ws.select(s.mmsi); ws.setStep("evidence"); }}>
                <span className="num t-label">{s.score.toFixed(2)}</span>
                <span className="name">{s.name}</span>
                <span className="num t-label">first in {Math.round(s.rank1_share * 100)} %</span>
              </button>
            ))}
          </div>
          {v.reason && <p className="note">{v.reason.charAt(0).toUpperCase() + v.reason.slice(1)}.</p>}
        </Section>
      )}
      {v.what_would_help && d.code !== 1 && (
        <Section title="What data would help">
          <ul className="plain-list">
            {v.what_would_help.map((w) => <li key={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</li>)}
          </ul>
        </Section>
      )}
      {d.code === 5 && c.bundle.ledger.infrastructure_context && (
        <Section title="Other source types (notes, not verdicts)">
          <KV rows={[
            [`Platforms within ${c.bundle.ledger.infrastructure_context.platforms_within_km} km`, String(c.bundle.ledger.infrastructure_context.count)],
            ["Nearest platform", `${Math.round(c.bundle.ledger.infrastructure_context.nearest_km)} km`],
          ]} />
        </Section>
      )}

      <Section title="Evidence quality">
        <KV rows={[
          ["AIS coverage", `${c.bundle.ledger.ais_coverage.score.toFixed(2)} from ${c.bundle.ledger.ais_coverage.vessels_used} ships`],
          ["Wind reliability", `${Math.round(c.bundle.meta.slick.measures.wind_reliability * 100)} %`],
          ["Edge truncated", c.bundle.meta.slick.measures.edge_truncated ? "yes" : "no"],
          ["AIS data", c.bundle.ledger.data.ais],
          ["Physics", c.bundle.ledger.data.physics],
        ]} />
        <p className="note">Kept separate from attribution confidence.</p>
      </Section>

      <Section title="Case review">
        {review && (
          <p className="note note-strong">
            You {review.decision === "accept" ? "accepted" : "disputed"} this verdict on {fmtUtc(review.at)}. The system verdict stays unchanged beside your review.
          </p>
        )}
        <label className="field">
          <span className="t-label">Notes</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you checked, what you disagree with" />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => setReview({ caseId: c.bundle.entry.id, decision: "accept", note, at: new Date().toISOString() })}>Accept verdict</button>
          <button type="button" className="btn btn-secondary" onClick={() => setReview({ caseId: c.bundle.entry.id, decision: "dispute", note, at: new Date().toISOString() })}>Dispute</button>
        </div>
      </Section>

      {key && (
        <Section title="Answer key (synthetic scenario)">
          {revealed ? (
            <div className="reveal">
              <KV rows={[
                ["Source in AIS", key.source_in_ais ? "yes" : "no"],
                ["Source ship", key.source_mmsi ? (c.byMmsi.get(key.source_mmsi)?.name ?? `MMSI ${key.source_mmsi}`) : "none"],
                ["Expected verdict", key.expected_verdict],
                ["Release time", key.release_time ? fmtUtc(key.release_time) : "–"],
              ]} />
              <p className="note note-strong">Outcome: {key.outcome}.</p>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => ws.set({ revealed: { ...ws.revealed, [c.bundle.entry.id]: true } })}>
              <Eye size={14} /> Reveal answer key
            </button>
          )}
          <p className="note">Hidden until you ask, so the demo is judged on the evidence first.</p>
        </Section>
      )}
      <p className="note">{c.bundle.ledger.disclaimer}</p>
    </>
  );
}

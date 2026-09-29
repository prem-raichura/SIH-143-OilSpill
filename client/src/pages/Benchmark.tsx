import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { CountBars, DotCIRows, TradeoffLines } from "../charts/charts";
import { ErrorNote, Loading, PageHeader, Tabs } from "../components/ui";
import { useBenchmark } from "../data/load";
import type { BenchmarkSetA, BenchmarkSetB } from "../data/types";
import { VERDICT_SHORT } from "../lib/verdict";

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0)} %`;

export default function Benchmark() {
  const { data: b, error, loading } = useBenchmark();
  const [split, setSplit] = useState<"held_out" | "tuning">("held_out");
  const [tables, setTables] = useState(false);
  if (error) return <div className="page-pad"><ErrorNote error={error} /></div>;
  if (loading || !b) return <div className="page-pad"><Loading /></div>;
  const A: BenchmarkSetA = b[split].set_A;
  const B: BenchmarkSetB = b[split].set_B;
  const cmp = b.comparison_methods_held_out;
  const verdictRows = (v: Record<string, number>) => (["1", "2", "3", "4", "5"] as const).map((k) => ({ label: `${k} ${VERDICT_SHORT[Number(k) as 1]}`, value: v[k] ?? 0 }));

  return (
    <div className="page-pad reading">
      <PageHeader icon={<BarChart3 size={22} strokeWidth={1.8} />} title="How often it names the wrong ship" />
      <p className="l-lead">
        On {b.held_out.set_B.n} held-out test scenarios where the source ship was not in AIS, the system named a ship{" "}
        {b.held_out.set_B.wrongful_naming[0]} times (95 % CI {pct(b.held_out.set_B.wrongful_naming[1][0])} to {pct(b.held_out.set_B.wrongful_naming[1][1])}).
      </p>
      <p className="muted" style={{ maxWidth: "68ch" }}>
        {b.design.scenarios_per_set as number} test scenarios per set, with degraded slick outlines, decoy ships and drift physics that differ
        from the pipeline's, so the test cannot simply agree with itself. Thresholds were tuned on even-numbered scenarios to a {Math.round(b.design.target_wrongful_naming * 100)} % wrongful-naming target and are reported on the
        odd-numbered, held-out half. Set A and Set B are never merged into one accuracy number.
      </p>
      <div className="bench-controls">
        <Tabs label="Split" variant="pill" value={split} onChange={setSplit} options={[{ value: "held_out", label: "Held out" }, { value: "tuning", label: "Tuning" }]} />
        <label className="check-row"><span /><span>Show tables</span><input type="checkbox" checked={tables} onChange={(e) => setTables(e.target.checked)} /></label>
      </div>

      <div className="bench-grid">
        <section className="l-card">
          <h2 className="t-section">Set A: source ship present in AIS (n = {A.n})</h2>
          <DotCIRows rows={[
            { label: "True source ranked first", k: A.top1[0], n: A.n, p: A.top1[0] / A.n, ci: A.top1[1] },
            { label: "True source in top three", k: A.top3[0], n: A.n, p: A.top3[0] / A.n, ci: A.top3[1] },
            { label: "A ship named (coverage)", k: A.coverage_verdict3[0], n: A.n, p: A.coverage_verdict3[0] / A.n, ci: A.coverage_verdict3[1] },
            { label: "Named ship is the source", k: A.leading_candidate_precision[0], n: A.leading_candidate_precision[1], p: A.leading_candidate_precision[0] / Math.max(1, A.leading_candidate_precision[1]), ci: A.leading_candidate_precision[2], strong: true },
          ]} />
          <p className="note">Source wrongly eliminated by the veto: {A.source_wrongly_eliminated} of {A.n}. The system is conservative by design: it names a ship rarely, and when it does it is right.</p>
          <h3 className="t-label">Verdicts</h3>
          <CountBars rows={verdictRows(A.verdicts)} total={A.n} />
        </section>
        <section className="l-card">
          <h2 className="t-section">Set B: source ship absent from AIS (n = {B.n})</h2>
          <DotCIRows rows={[
            { label: "Wrongful naming", k: B.wrongful_naming[0], n: B.n, p: B.wrongful_naming[0] / B.n, ci: B.wrongful_naming[1], strong: true },
            { label: "Correct refusal", k: B.correct_refusal[0], n: B.n, p: B.correct_refusal[0] / B.n, ci: B.correct_refusal[1] },
            { label: "Says vessel without AIS", k: B.vessel_without_ais_rate[0], n: B.n, p: B.vessel_without_ais_rate[0] / B.n, ci: B.vessel_without_ais_rate[1] },
          ]} />
          <h3 className="t-label">Verdicts</h3>
          <CountBars rows={verdictRows(B.verdicts)} total={B.n} />
        </section>
      </div>

      <section className="l-card">
        <h2 className="t-section">Against simpler methods (held out, same scenarios)</h2>
        <div className="bench-grid">
          <div>
            <h3 className="t-label">Wrongful naming, set B (lower is better)</h3>
            <DotCIRows rows={[
              { label: "Full system", k: b.held_out.set_B.wrongful_naming[0], n: 100, p: b.held_out.set_B.wrongful_naming[0] / 100, ci: b.held_out.set_B.wrongful_naming[1], strong: true },
              { label: "Forward match only", k: cmp.baseline_forward.set_B_wrongful_naming[0], n: 100, p: cmp.baseline_forward.set_B_wrongful_naming[0] / 100, ci: cmp.baseline_forward.set_B_wrongful_naming[1] },
              { label: "Proximity and timing only", k: cmp.baseline_proximity.set_B_wrongful_naming[0], n: 100, p: cmp.baseline_proximity.set_B_wrongful_naming[0] / 100, ci: cmp.baseline_proximity.set_B_wrongful_naming[1] },
            ]} />
          </div>
          <div>
            <h3 className="t-label">Precision when naming, set A (higher is better)</h3>
            <DotCIRows rows={[
              { label: "Full system", k: b.held_out.set_A.leading_candidate_precision[0], n: b.held_out.set_A.leading_candidate_precision[1], p: b.held_out.set_A.leading_candidate_precision[0] / Math.max(1, b.held_out.set_A.leading_candidate_precision[1]), ci: b.held_out.set_A.leading_candidate_precision[2], strong: true },
              { label: "Forward match only", k: cmp.baseline_forward.set_A_precision[0], n: cmp.baseline_forward.set_A_precision[1], p: cmp.baseline_forward.set_A_precision[0] / cmp.baseline_forward.set_A_precision[1], ci: cmp.baseline_forward.set_A_precision[2] },
              { label: "Proximity and timing only", k: cmp.baseline_proximity.set_A_precision[0], n: cmp.baseline_proximity.set_A_precision[1], p: cmp.baseline_proximity.set_A_precision[0] / cmp.baseline_proximity.set_A_precision[1], ci: cmp.baseline_proximity.set_A_precision[2] },
            ]} />
          </div>
        </div>
        <p className="note">Forward match only follows the Longépé / EMSA CleanSeaNet idea; proximity and timing follows SkyTruth Cerulean. This system combines both and adds a measured refusal.</p>
      </section>

      <section className="l-card">
        <h2 className="t-section">The trade-off behind the threshold (held out)</h2>
        <TradeoffLines points={b.tradeoff_curve_held_out.map((p) => ({ x: p.lead_gap, a: p.wrongful_naming, b: p.coverage, extra: p.precision }))} chosen={b.thresholds.lead_gap} />
        <p className="note">A lower threshold names more ships and gets more of them wrong. The chosen point keeps wrongful naming at zero on the held-out set.</p>
      </section>

      {tables && (
        <section className="l-card">
          <h2 className="t-section">Tables</h2>
          <table className="table">
            <thead><tr><th>Threshold</th><th className="r">Wrongful naming</th><th className="r">Coverage</th><th className="r">Precision</th></tr></thead>
            <tbody>
              {b.tradeoff_curve_held_out.map((p) => (
                <tr key={p.lead_gap}><td className="num">{p.lead_gap}</td><td className="r">{pct(p.wrongful_naming)}</td><td className="r">{pct(p.coverage)}</td><td className="r">{p.precision == null ? "–" : pct(p.precision)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="note">Results are test outcomes with 95 % intervals, never real-world probabilities.</p>
    </div>
  );
}

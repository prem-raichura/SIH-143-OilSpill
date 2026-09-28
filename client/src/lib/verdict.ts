// Mirrors Dataset/build/attribution.py decide(): five verdicts, checked in order, first match wins.
import type { Candidate, Ledger, Meta, VerdictCode } from "../data/types";

export type GateLabel = "confirmed_oil" | "lookalike" | "uncertain";

export interface VerdictCheck {
  order: VerdictCode;
  question: string;
  detail: string;
  status: "continue" | "fired" | "not_evaluated";
}

export interface DerivedVerdict {
  code: VerdictCode;
  checks: VerdictCheck[];
  plausible: Candidate[];
  lead?: Candidate;
  gap?: number;
  runnerScore?: number;
}

export function plausibleOf(ledger: Ledger): Candidate[] {
  const th = ledger.thresholds;
  return ledger.candidates.filter(
    (c) =>
      (c.fit >= th.plausible_fit && c.score >= th.plausible_score) ||
      (Boolean((c as Candidate & { sar_only?: boolean }).sar_only) && c.score >= th.plausible_score),
  );
}

const f2 = (x: number) => x.toFixed(2);

export function deriveVerdict(ledger: Ledger, meta: Pick<Meta, "slick">, gate: GateLabel | null = null): DerivedVerdict {
  const th = ledger.thresholds;
  const checks: VerdictCheck[] = [];
  const plausible = plausibleOf(ledger);
  const done = (code: VerdictCode, extra: Partial<DerivedVerdict> = {}): DerivedVerdict => {
    const questions: Record<VerdictCode, string> = {
      1: "Is it oil?",
      2: "Enough data to attribute?",
      3: "One clear leader?",
      4: "Several plausible ships?",
      5: "No consistent AIS vessel?",
    };
    for (let o = checks.length + 1; o <= 5; o++) {
      checks.push({ order: o as VerdictCode, question: questions[o as VerdictCode], detail: "Not evaluated", status: "not_evaluated" });
    }
    return { code, checks, plausible, ...extra };
  };

  // 1. Not oil
  const conf = meta.slick.measures.cerulean_machine_confidence ?? 1;
  if (gate === "lookalike") {
    checks.push({ order: 1, question: "Is it oil?", detail: "Marked as a look-alike at the oil check", status: "fired" });
    return done(1);
  }
  if (conf < 0.5) {
    checks.push({ order: 1, question: "Is it oil?", detail: `Detector confidence ${Math.round(conf * 100)} % is below 50 %`, status: "fired" });
    return done(1);
  }
  checks.push({
    order: 1,
    question: "Is it oil?",
    detail:
      gate === "confirmed_oil"
        ? "Confirmed at the oil check"
        : gate === "uncertain"
          ? "Marked not sure at the oil check; case flagged, analysis continues"
          : "Stored analysis assumes confirmed oil",
    status: "continue",
  });

  // 2. Insufficient data
  const cov = ledger.ais_coverage.score;
  if (cov == null || cov < th.coverage_min) {
    checks.push({
      order: 2,
      question: "Enough data to attribute?",
      detail: `AIS coverage ${cov == null ? "unknown" : f2(cov)} is below ${f2(th.coverage_min)}`,
      status: "fired",
    });
    return done(2);
  }
  checks.push({
    order: 2,
    question: "Enough data to attribute?",
    detail: `AIS coverage ${f2(cov)} ≥ ${f2(th.coverage_min)}; forcing available`,
    status: "continue",
  });

  // 3. Leading candidate
  if (plausible.length) {
    const lead = plausible[0];
    const runnerScore = Math.max(th.none_score, ...ledger.candidates.filter((c) => c !== lead).map((c) => c.score));
    const gap = lead.score - runnerScore;
    const okGap = gap >= th.lead_gap;
    const okStab = lead.rank1_share >= th.lead_stability;
    const detail = `Score gap ${f2(gap)} ${okGap ? "≥" : "<"} ${f2(th.lead_gap)}, rank stability ${f2(lead.rank1_share)} ${okStab ? "≥" : "<"} ${f2(th.lead_stability)}`;
    if (okGap && okStab) {
      checks.push({ order: 3, question: "One clear leader?", detail, status: "fired" });
      return done(3, { lead, gap, runnerScore });
    }
    checks.push({ order: 3, question: "One clear leader?", detail, status: "continue" });
    checks.push({
      order: 4,
      question: "Several plausible ships?",
      detail: `${plausible.length} plausible ${plausible.length === 1 ? "ship" : "ships"} that the evidence cannot separate`,
      status: "fired",
    });
    return done(4, { lead, gap, runnerScore });
  }
  checks.push({ order: 3, question: "One clear leader?", detail: "No plausible ship", status: "continue" });
  checks.push({ order: 4, question: "Several plausible ships?", detail: "No plausible ship", status: "continue" });
  checks.push({
    order: 5,
    question: "No consistent AIS vessel?",
    detail: `No ship fits and AIS coverage is adequate (${f2(cov)})`,
    status: "fired",
  });
  return done(5);
}

export const VERDICT_SHORT: Record<VerdictCode, string> = {
  1: "Not oil",
  2: "Insufficient data",
  3: "Leading candidate",
  4: "Multiple plausible",
  5: "No consistent AIS vessel",
};

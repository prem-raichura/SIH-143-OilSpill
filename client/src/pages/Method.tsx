const STEPS = [
  ["Detect", "UNet++ segmentation on Sentinel-1 VV, LightGBM look-alike check with wind reliability"],
  ["Oil check", "A person confirms oil, marks a look-alike or is not sure; ships stay hidden until then"],
  ["Measure", "Area, length, width, shape indicators, taper and a weak age prior"],
  ["Drift back", "10-member ensemble, 500 particles each, to a release corridor over the age prior"],
  ["Drift forward", "OpenDrift OpenOil forecast to 72 h with weathering"],
  ["Screen ships", "Reachability veto (the only hard rule), drift-corrected screening with sigma, behaviour rules"],
  ["Confirm", "Forward OpenDrift release along the top candidates' tracks, scored by Fraction Skill Score"],
  ["Verdict", "Evidence ledger, rank stability over 50 runs, five ordered verdicts including refusal"],
];

export default function Method() {
  const W = 1040;
  const box = 118;
  const gap = (W - STEPS.length * box) / (STEPS.length - 1);
  return (
    <div className="page-pad reading method">
      <h1 className="t-page">Method</h1>
      <p className="l-lead">Deep learning finds oil pixels. Physics moves the oil. Transparent rules and weights decide what the evidence says about ships, and when it says nothing.</p>
      <svg className="pipeline-svg" viewBox={`0 0 ${W} 150`} role="img" aria-label="Pipeline: detect, oil check, measure, drift back, drift forward, screen ships, confirm, verdict">
        {STEPS.map(([t], i) => {
          const x = i * (box + gap);
          const human = i === 1;
          return (
            <g key={t}>
              <rect x={x} y={30} width={box} height={56} rx={6} fill={human ? "var(--ink)" : "var(--panel)"} stroke="var(--line-strong)" />
              <text x={x + box / 2} y={63} textAnchor="middle" style={{ fill: human ? "var(--on-ink)" : "var(--ink)", fontWeight: 620, fontSize: 13 }}>{t}</text>
              <text x={x + 8} y={22} style={{ fill: "var(--ink-2)", fontSize: 11 }}>{i + 1}</text>
              {i < STEPS.length - 1 && <path d={`M${x + box + 4} 58 H${x + box + gap - 6} m-6 -5 l6 5 -6 5`} fill="none" stroke="var(--ink-2)" />}
            </g>
          );
        })}
        <path d={`M${3 * (box + gap) + box / 2} 90 v18 H${4 * (box + gap) + box / 2} v-18`} fill="none" stroke="var(--past)" strokeDasharray="3 3" />
        <text x={3.5 * (box + gap) + box / 2} y={126} textAnchor="middle" style={{ fill: "var(--ink-2)", fontSize: 11 }}>one physics formula for every drift</text>
      </svg>
      <dl className="data-list">
        {STEPS.map(([t, d]) => (
          <div key={t}><dt>{t}</dt><dd>{d}</dd></div>
        ))}
      </dl>
      <section className="l-card">
        <h2 className="t-section">The physics, once</h2>
        <div className="formula">V<sub>oil</sub> = V<sub>current</sub> + V<sub>tide</sub> + V<sub>Stokes</sub> + α · V<sub>wind 10 m</sub></div>
        <p className="muted">α = 2 % when Stokes drift comes separately (ensemble 1–3 %); 3–3.5 % with no separate Stokes term. CMEMS SMOC gives circulation, tide and Stokes as separate parts, so nothing is counted twice.</p>
      </section>
      <section className="l-card">
        <h2 className="t-section">Five verdicts, first match wins</h2>
        <ol className="plain-list">
          <li><b>Not oil</b>: the oil check or the detector says look-alike.</li>
          <li><b>Insufficient data</b>: no usable forcing, or AIS coverage near the corridor below threshold.</li>
          <li><b>Leading candidate</b>: one ship clears both the score gap (over the runner-up or "none") and the rank-stability threshold.</li>
          <li><b>Multiple plausible</b>: plausible ships that the evidence cannot separate, with what data would help.</li>
          <li><b>No consistent AIS vessel</b>: nothing fits and coverage is adequate, with a probable source type.</li>
        </ol>
      </section>
      <section className="l-card">
        <h2 className="t-section">What we build on</h2>
        <p className="muted">Forward simulation along AIS tracks compared with the slick (Longépé et al. 2015, used in EMSA CleanSeaNet); backward drift; UNet-family detectors; AIS proximity and timing scoring (SkyTruth Cerulean). Our claim is the combination and the measurement: a strict veto, sigma-aware screening, forward confirmation, a data-quality-weighted ledger with reasons for every other ship, and a measured refusal rate.</p>
      </section>
      <section className="l-card">
        <h2 className="t-section">Limits</h2>
        <ul className="plain-list">
          <li>There is no public ground truth for "which ship spilled". Attribution numbers come from a synthetic benchmark only.</li>
          <li>Free raw AIS for Indian waters is not available, so Indian ship traffic is synthetic, as the problem statement permits.</li>
          <li>Radar cannot measure oil thickness: no volume estimate.</li>
          <li>This static build replays precomputed results; the models and drift runs are done offline.</li>
        </ul>
      </section>
    </div>
  );
}

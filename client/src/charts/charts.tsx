// Small hand-drawn SVG charts. Text stays in ink tokens; color marks carry identity.
import { useState, type ReactNode } from "react";

/** Horizontal scale with a highlighted band and a marker (wind reliability). */
export function BandMeter({ value, min, max, band, unit, label }: { value: number; min: number; max: number; band: [number, number]; unit: string; label: string }) {
  const W = 320, H = 46, P = 8;
  const x = (v: number) => P + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * (W - 2 * P);
  const ticks = [];
  for (let t = min; t <= max; t += (max - min) / 4) ticks.push(t);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${value} ${unit}, reliable between ${band[0]} and ${band[1]} ${unit}`}>
      <rect x={P} y={12} width={W - 2 * P} height={8} rx={4} fill="var(--line)" />
      <rect x={x(band[0])} y={12} width={x(band[1]) - x(band[0])} height={8} rx={4} fill="var(--ink-2)" opacity={0.55} />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={38} textAnchor="middle">{Math.round(t)}</text>
      ))}
      <path d={`M${x(value)} 24 l-6 -14 h12 z`} fill="var(--ink)" transform={`translate(0 -2)`} />
      <text x={x(value)} y={8} textAnchor="middle" style={{ fill: "var(--ink)", fontWeight: 600 }}>{value} {unit}</text>
    </svg>
  );
}

/** Interval on an hours axis (age prior). */
export function RangeBar({ lo, hi, max, color = "var(--past)", label, marker }: { lo: number; hi: number; max: number; color?: string; label: string; marker?: { at: number; text: string } }) {
  const W = 320, H = 44, P = 8;
  const x = (v: number) => P + (Math.min(max, Math.max(0, v)) / max) * (W - 2 * P);
  const ticks = [0, 12, 24, 36, 48, 60, 72].filter((t) => t <= max);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${lo} to ${hi} hours`}>
      <line x1={P} x2={W - P} y1={16} y2={16} stroke="var(--line-strong)" />
      <rect x={x(lo)} y={10} width={Math.max(2, x(hi) - x(lo))} height={12} rx={3} fill={color} opacity={0.35} stroke={color} />
      {marker && <line x1={x(marker.at)} x2={x(marker.at)} y1={6} y2={26} stroke="var(--ink)" strokeWidth={2} />}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={38} textAnchor="middle">{t} h</text>
      ))}
    </svg>
  );
}

/** Descending horizontal bars (candidate funnel). */
export function Funnel({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const ramp = ["#86b6ef", "#5598e7", "#3987e5", "#256abf", "#1c5cab"];
  return (
    <div className="funnel" role="list">
      {rows.map((r, i) => (
        <div key={r.label} className="funnel-row" role="listitem">
          <span className="funnel-label">{r.label}</span>
          <span className="funnel-bar">
            <span style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: ramp[Math.min(i, ramp.length - 1)] }} />
          </span>
          <span className="funnel-val num">{r.value.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

/** Diverging bars around zero (evidence ledger contributions). */
export function DivergingBar({ value, max }: { value: number; max: number }) {
  const W = 120, H = 12;
  const mid = W / 2;
  const w = (Math.min(Math.abs(value), max) / max) * (mid - 2);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ flex: "none" }}>
      <line x1={mid} x2={mid} y1={0} y2={H} stroke="var(--line-strong)" />
      <rect x={value >= 0 ? mid : mid - w} y={2} width={Math.max(1, w)} height={H - 4} rx={2} fill={value >= 0 ? "var(--for)" : "var(--against)"} />
    </svg>
  );
}

/** Strip of member values on 0..1 with a mean tick (FSS members). */
export function StripDots({ values, mean, label }: { values: number[]; mean: number; label: string }) {
  const W = 320, H = 34, P = 10;
  const x = (v: number) => P + Math.max(0, Math.min(1, v)) * (W - 2 * P);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: members ${values.map((v) => v.toFixed(2)).join(", ")}, mean ${mean.toFixed(2)}`}>
      <line x1={P} x2={W - P} y1={12} y2={12} stroke="var(--line-strong)" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <text key={t} x={x(t)} y={30} textAnchor="middle">{t}</text>
      ))}
      {values.map((v, i) => (
        <circle key={i} cx={x(v)} cy={12} r={5} fill="var(--ship-short)" stroke="var(--panel)" strokeWidth={2} opacity={0.9} />
      ))}
      <line x1={x(mean)} x2={x(mean)} y1={3} y2={21} stroke="var(--ink)" strokeWidth={2} />
    </svg>
  );
}

/** Stacked area of fractions over hours (oil mass budget). */
export function StackedArea({ series, hours }: { series: { label: string; values: number[]; color: string }[]; hours: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340, H = 150, PL = 30, PR = 8, PT = 8, PB = 22;
  const n = hours.length;
  const x = (i: number) => PL + (i / Math.max(1, n - 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - v) * (H - PT - PB);
  let acc = new Array(n).fill(0);
  const areas = series.map((s) => {
    const lo = acc.slice();
    const hi = acc.map((a, i) => a + (s.values[i] ?? 0));
    acc = hi;
    const top = hi.map((v, i) => `${x(i)},${y(v)}`).join(" L");
    const bot = lo.map((v, i) => `${x(i)},${y(v)}`).reverse().join(" L");
    return { s, d: `M${top} L${bot} Z`, hi };
  });
  return (
    <div style={{ position: "relative" }}>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Oil mass budget over the forecast"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PL) / (W - PL - PR)) * (n - 1));
          setHover(i >= 0 && i < n ? i : null);
        }}
        onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={PL - 4} y={y(t) + 4} textAnchor="end">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {areas.map((a) => (
          <path key={a.s.label} d={a.d} fill={a.s.color} stroke="var(--panel)" strokeWidth={1.5} />
        ))}
        {[0, 24, 48, 72].map((t) => {
          const i = hours.indexOf(t) >= 0 ? hours.indexOf(t) : Math.min(n - 1, t);
          return <text key={t} x={x(i)} y={H - 6} textAnchor="middle">+{t} h</text>;
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--ink)" />}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>+{hours[hover]} h</b>
          {series.map((s) => (
            <div key={s.label}><i style={{ background: s.color }} /> {s.label} {Math.round((s.values[hover] ?? 0) * 100)}%</div>
          ))}
        </div>
      )}
      <div className="legend">
        {series.map((s) => (
          <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Small compass showing one bearing. */
export function Compass({ bearing, label }: { bearing: number; label: string }) {
  return (
    <svg width="44" height="44" viewBox="-22 -22 44 44" role="img" aria-label={`${label}: ${Math.round(bearing)} degrees`}>
      <circle r="19" fill="none" stroke="var(--line-strong)" />
      <text y="-9" textAnchor="middle" fontSize="8" fill="var(--ink-2)">N</text>
      <g transform={`rotate(${bearing})`}>
        <path d="M0 -16 L4 2 L0 -2 L-4 2 Z" fill="var(--ink)" />
      </g>
    </svg>
  );
}

/** Dot + 95 % CI whisker on a 0..100 % axis, one row per metric. */
export function DotCIRows({ rows, target }: { rows: { label: ReactNode; k?: number; n?: number; p: number; ci: [number, number]; strong?: boolean }[]; target?: { at: number; label: string } }) {
  const W = 460, rowH = 30, PL = 170, PR = 60, PT = 18; // rendered at most ~560 px wide (see .dotci)
  const H = PT + rows.length * rowH + 8;
  const x = (v: number) => PL + v * (W - PL - PR);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Metrics with 95 % confidence intervals">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={PT - 4} y2={H - 6} stroke="var(--grid)" />
          <text x={x(t)} y={10} textAnchor="middle">{t * 100}%</text>
        </g>
      ))}
      {target && (
        <g>
          <line x1={x(target.at)} x2={x(target.at)} y1={PT - 4} y2={H - 6} stroke="var(--ink-2)" strokeDasharray="3 3" />
        </g>
      )}
      {rows.map((r, i) => {
        const y = PT + i * rowH + rowH / 2;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill={hover === i ? "var(--panel-2)" : "transparent"} />
            <text x={0} y={y + 4} style={{ fill: "var(--ink)", fontSize: 12, fontWeight: r.strong ? 620 : 440 }}>{r.label}</text>
            <line x1={x(r.ci[0])} x2={x(r.ci[1])} y1={y} y2={y} stroke={r.strong ? "var(--ink)" : "var(--ink-2)"} strokeWidth={2} strokeLinecap="round" />
            <line x1={x(r.ci[0])} x2={x(r.ci[0])} y1={y - 5} y2={y + 5} stroke={r.strong ? "var(--ink)" : "var(--ink-2)"} strokeWidth={2} />
            <line x1={x(r.ci[1])} x2={x(r.ci[1])} y1={y - 5} y2={y + 5} stroke={r.strong ? "var(--ink)" : "var(--ink-2)"} strokeWidth={2} />
            <circle cx={x(r.p)} cy={y} r={5.5} fill={r.strong ? "var(--ink)" : "var(--ink-2)"} stroke="var(--panel)" strokeWidth={2} />
            <text x={W - PR + 8} y={y + 4} style={{ fill: "var(--ink)", fontWeight: 600 }}>
              {Math.round(r.p * 100)}%
            </text>
            {hover === i && (
              <text x={x(r.p)} y={y - 9} textAnchor="middle" style={{ fill: "var(--ink)" }}>
                {r.k != null && r.n != null ? `${r.k}/${r.n}, ` : ""}CI {Math.round(r.ci[0] * 1000) / 10}–{Math.round(r.ci[1] * 1000) / 10}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Trade-off curve: two % series against the lead-gap threshold on one axis, operating point marked. */
export function TradeoffLines({ points, chosen }: { points: { x: number; a: number; b: number; extra?: number | null }[]; chosen: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 260, PL = 44, PR = 110, PT = 14, PB = 34;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const x = (v: number) => PL + ((v - x0) / (x1 - x0 || 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - v) * (H - PT - PB);
  const line = (k: "a" | "b") => points.map((p, i) => `${i ? "L" : "M"}${x(p.x)},${y(p[k])}`).join(" ");
  const last = points[points.length - 1];
  // Keep the two end labels apart when the lines end close together.
  let ya = y(last.a) + 4;
  let yb = y(last.b) + 4;
  if (Math.abs(ya - yb) < 14) {
    if (ya >= yb) { ya = yb + 14; } else { yb = ya + 14; }
    if (Math.max(ya, yb) > H - PB + 4) { ya -= 14; yb -= 14; }
  }
  return (
    <div style={{ position: "relative", maxWidth: 760 }}>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Wrongful naming and coverage against the lead-gap threshold"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          points.forEach((p, i) => { if (Math.abs(x(p.x) - px) < Math.abs(x(points[best].x) - px)) best = i; });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={PL - 6} y={y(t) + 4} textAnchor="end">{t * 100}%</text>
          </g>
        ))}
        {points.filter((_, i) => i % 2 === 0).map((p) => (
          <text key={p.x} x={x(p.x)} y={H - 12} textAnchor="middle">{p.x}</text>
        ))}
        <text x={(W - PR + PL) / 2} y={H} textAnchor="middle">Lead-gap threshold (score units)</text>
        <line x1={x(chosen)} x2={x(chosen)} y1={PT} y2={H - PB} stroke="var(--ink)" strokeDasharray="4 3" />
        <text x={x(chosen) + 4} y={PT + 10} style={{ fill: "var(--ink)", fontWeight: 600 }}>Chosen {chosen}</text>
        <path d={line("b")} fill="none" stroke="var(--ship-short)" strokeWidth={2} />
        <path d={line("a")} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <text x={W - PR + 6} y={ya} style={{ fill: "var(--ink)", fontWeight: 600 }}>Wrongful naming</text>
        <text x={W - PR + 6} y={yb} style={{ fill: "var(--ink)", fontWeight: 600 }}>Coverage</text>
        {hover != null && (
          <g>
            <line x1={x(points[hover].x)} x2={x(points[hover].x)} y1={PT} y2={H - PB} stroke="var(--ink-2)" />
            <circle cx={x(points[hover].x)} cy={y(points[hover].a)} r={4} fill="var(--ink)" />
            <circle cx={x(points[hover].x)} cy={y(points[hover].b)} r={4} fill="var(--ship-short)" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(points[hover].x) / W) * 100}%` }}>
          <b>Threshold {points[hover].x}</b>
          <div>Wrongful naming {Math.round(points[hover].a * 100)}%</div>
          <div>Coverage {Math.round(points[hover].b * 100)}%</div>
          {points[hover].extra != null && <div>Precision when naming {Math.round((points[hover].extra as number) * 100)}%</div>}
        </div>
      )}
      <div className="legend">
        <span><i style={{ background: "var(--ink)" }} />Wrongful naming (set B)</span>
        <span><i style={{ background: "var(--ship-short)" }} />Coverage: cases named (set A)</span>
      </div>
    </div>
  );
}

/** Simple horizontal bars for small category counts (verdict distribution). */
export function CountBars({ rows, total }: { rows: { label: string; value: number }[]; total: number }) {
  return (
    <div className="funnel" role="list">
      {rows.map((r) => (
        <div key={r.label} className="funnel-row" role="listitem">
          <span className="funnel-label">{r.label}</span>
          <span className="funnel-bar"><span style={{ width: `${(r.value / Math.max(1, total)) * 100}%`, background: "var(--ink-2)" }} /></span>
          <span className="funnel-val num">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

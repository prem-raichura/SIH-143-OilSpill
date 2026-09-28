// Chart-style graduated border with latitude/longitude labels, drawn over the map.
import type { WebMercatorViewport } from "@deck.gl/core";
import { fmtLat, fmtLon } from "../lib/geo";

const STEPS = [0.1, 1 / 6, 0.25, 0.5, 1, 2, 5, 10];

function pickStep(span: number, target: number) {
  return STEPS.find((s) => span / s <= target) ?? 10;
}

export default function ChartFrame({ vp }: { vp: WebMercatorViewport | null }) {
  if (!vp) return null;
  const { width, height } = vp;
  const [w, n] = vp.unproject([0, 0]);
  const [e, s] = vp.unproject([width, height]);
  const B = 6; // border thickness
  const lonStep = pickStep(e - w, 8);
  const latStep = pickStep(n - s, 6);
  const fine = (st: number) => st / (st >= 1 ? 4 : 3);
  const lonFine = fine(lonStep);
  const latFine = fine(latStep);

  const lonBars: { x0: number; x1: number; dark: boolean }[] = [];
  for (let x = Math.floor(w / lonFine) * lonFine; x < e; x += lonFine) {
    const x0 = Math.max(0, vp.project([x, s])[0]);
    const x1 = Math.min(width, vp.project([x + lonFine, s])[0]);
    lonBars.push({ x0, x1, dark: Math.round(x / lonFine) % 2 === 0 });
  }
  const latBars: { y0: number; y1: number; dark: boolean }[] = [];
  for (let y = Math.floor(s / latFine) * latFine; y < n; y += latFine) {
    const y0 = Math.min(height, vp.project([w, y])[1]);
    const y1 = Math.max(0, vp.project([w, y + latFine])[1]);
    latBars.push({ y0, y1, dark: Math.round(y / latFine) % 2 === 0 });
  }
  const lonLabels: { x: number; t: string }[] = [];
  for (let x = Math.ceil(w / lonStep) * lonStep; x <= e; x += lonStep) {
    const px = vp.project([x, s])[0];
    if (px > 40 && px < width - 40) lonLabels.push({ x: px, t: fmtLon(x).replace(/\.0′/, "′") });
  }
  const latLabels: { y: number; t: string }[] = [];
  for (let y = Math.ceil(s / latStep) * latStep; y <= n; y += latStep) {
    const py = vp.project([w, y])[1];
    if (py > 30 && py < height - 30) latLabels.push({ y: py, t: fmtLat(y).replace(/\.0′/, "′") });
  }

  return (
    <svg className="chart-frame" width={width} height={height} aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
      <g>
        {lonBars.map((b, i) => (
          <g key={`lb${i}`}>
            <rect x={b.x0} y={0} width={Math.max(0, b.x1 - b.x0)} height={B} fill={b.dark ? "var(--ink-2)" : "var(--panel)"} />
            <rect x={b.x0} y={height - B} width={Math.max(0, b.x1 - b.x0)} height={B} fill={b.dark ? "var(--ink-2)" : "var(--panel)"} />
          </g>
        ))}
        {latBars.map((b, i) => (
          <g key={`la${i}`}>
            <rect x={0} y={b.y1} width={B} height={Math.max(0, b.y0 - b.y1)} fill={b.dark ? "var(--ink-2)" : "var(--panel)"} />
            <rect x={width - B} y={b.y1} width={B} height={Math.max(0, b.y0 - b.y1)} fill={b.dark ? "var(--ink-2)" : "var(--panel)"} />
          </g>
        ))}
        <rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="none" stroke="var(--line-strong)" />
        <rect x={B + 0.5} y={B + 0.5} width={width - 2 * B - 1} height={height - 2 * B - 1} fill="none" stroke="var(--line-strong)" />
      </g>
      <g className="frame-labels">
        {lonLabels.map((l) => (
          <text key={`x${l.t}`} x={l.x} y={B + 13} textAnchor="middle">{l.t}</text>
        ))}
        {latLabels.map((l) => (
          <text key={`y${l.t}`} x={B + 5} y={l.y + 4}>{l.t}</text>
        ))}
      </g>
    </svg>
  );
}

/** Graticule lines at the same step as the labels. */
export function graticuleLines(vp: WebMercatorViewport | null): [number, number][][] {
  if (!vp) return [];
  const [w, n] = vp.unproject([0, 0]);
  const [e, s] = vp.unproject([vp.width, vp.height]);
  const lonStep = pickStep(e - w, 8);
  const latStep = pickStep(n - s, 6);
  const lines: [number, number][][] = [];
  for (let x = Math.ceil(w / lonStep) * lonStep; x <= e; x += lonStep) lines.push([[x, s - 1], [x, n + 1]]);
  for (let y = Math.ceil(s / latStep) * latStep; y <= n; y += latStep) lines.push([[w - 1, y], [e + 1, y]]);
  return lines;
}

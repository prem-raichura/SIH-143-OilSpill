import { ChevronsDown, ChevronsUp, Pause, Play, SkipBack, SkipForward, Target } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Tip } from "../components/ui";
import { parseUtc, fmtRel, fmtUtc, hoursFrom } from "../lib/time";
import { useClock } from "../store/clock";
import { useWorkspace } from "../store/workspace";
import { useCase } from "./useCase";
import { ROLE_ORDER } from "../lib/vessels";

const PAD = 14;

export default function TimelineDock() {
  const c = useCase();
  const clock = useClock();
  const ws = useWorkspace();
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  const [lanesOpen, setLanesOpen] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width || 600);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { min, max } = c.range;
  const x = (h: number) => PAD + ((h - min) / (max - min)) * (W - 2 * PAD);
  const hAt = (px: number) => min + ((px - PAD) / (W - 2 * PAD)) * (max - min);

  const lanes = useMemo(() => {
    if (!c.shipsUnlocked) return [];
    const pick = c.vessels.filter((v) => c.trackIdx.has(v.mmsi) && v.role !== "background");
    pick.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
    return pick.slice(0, 8);
  }, [c]);

  const selected = ws.selectedMmsi ? c.byMmsi.get(ws.selectedMmsi) : undefined;
  const ap = c.bundle.meta.slick.measures.age_prior_h;
  const tImage = c.bundle.meta.t_image;
  const laneH = 12;
  const axisY = 44;
  const lanesTop = 70;
  const H = lanesOpen && lanes.length ? lanesTop + lanes.length * (laneH + 4) + 4 : 68;

  const drag = useRef(false);
  const setFromEvent = (e: PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    clock.setH(Math.round(hAt(e.clientX - r.left) * 4) / 4);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") clock.step(e.shiftKey ? -6 : -1);
    else if (e.key === "ArrowRight") clock.step(e.shiftKey ? 6 : 1);
    else if (e.key === " ") clock.toggle();
    else if (e.key === "Home") clock.setH(0);
    else return;
    e.preventDefault();
  };

  const labelEvery = W < 520 ? 24 : 12;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / 6) * 6; t <= max; t += 6) ticks.push(t);
  const release = selected?.candidate?.confirmation?.release_window;
  const absMs = parseUtc(tImage) + clock.h * 3_600_000;

  return (
    <div className="dock" id="timeline" aria-label="Timeline">
      <div className="dock-ctrls">
        <Tip content="Back 1 hour (Left arrow)"><button type="button" className="icon-btn" aria-label="Back one hour" onClick={() => clock.step(-1)}><SkipBack size={16} /></button></Tip>
        <Tip content={clock.playing ? "Pause (Space)" : "Play (Space)"}>
          <button type="button" className="icon-btn" aria-label={clock.playing ? "Pause" : "Play"} onClick={() => clock.toggle()} style={{ width: 38, height: 38, background: "var(--accent)", color: "var(--on-accent)", borderRadius: "50%", boxShadow: "var(--shadow-sm)" }}>
            {clock.playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </Tip>
        <Tip content="Forward 1 hour (Right arrow)"><button type="button" className="icon-btn" aria-label="Forward one hour" onClick={() => clock.step(1)}><SkipForward size={16} /></button></Tip>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Playback speed" style={{ marginLeft: 6 }}>
          {[1, 3, 6].map((s) => (
            <button key={s} type="button" role="radio" aria-checked={Math.abs(clock.speed - s) < 0.01} onClick={() => clock.setSpeed(s)}>{s} h/s</button>
          ))}
        </div>
        <Tip content="Go to image time (Home)"><button type="button" className="icon-btn" aria-label="Go to image time" onClick={() => clock.setH(0)}><Target size={16} /></button></Tip>
        <Tip content={c.shipsUnlocked ? (lanesOpen ? "Hide ships on timeline" : "Show ships on timeline") : "Ships stay hidden until the oil check is answered"}>
          <button type="button" className="icon-btn" aria-pressed={lanesOpen} aria-label="Ships on timeline" disabled={!c.shipsUnlocked} onClick={() => setLanesOpen((o) => !o)}>
            {lanesOpen ? <ChevronsDown size={16} /> : <ChevronsUp size={16} />}
          </button>
        </Tip>
      </div>

      <div className="tl" ref={ref} style={{ height: H }}>
        <svg
          role="slider"
          tabIndex={0}
          aria-label="Time relative to the satellite image"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={Math.round(clock.h * 10) / 10}
          aria-valuetext={fmtRel(clock.h)}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            drag.current = true;
            (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
            clock.pause();
            setFromEvent(e);
          }}
          onPointerMove={(e) => drag.current && setFromEvent(e)}
          onPointerUp={() => (drag.current = false)}
          viewBox={`0 0 ${W} ${H}`}
        >
          {/* past / future tint */}
          <rect x={x(min)} y={axisY - 10} width={x(0) - x(min)} height={20} fill="var(--past)" opacity={0.14} rx={4} />
          <rect x={x(0)} y={axisY - 10} width={x(max) - x(0)} height={20} fill="var(--future)" opacity={0.14} rx={4} />
          <line x1={x(min)} x2={x(max)} y1={axisY} y2={axisY} stroke="var(--line-strong)" />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={axisY - (t % 12 === 0 ? 6 : 3)} y2={axisY + (t % 12 === 0 ? 6 : 3)} stroke="var(--ink-2)" />
              {t % labelEvery === 0 && t !== 0 && (
                <text x={x(t)} y={axisY + 19} textAnchor="middle" fontSize="11" fill="var(--ink-2)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t > 0 ? `+${t} h` : `−${-t} h`}
                </text>
              )}
            </g>
          ))}
          <text x={x(min) + 2} y={axisY - 15} fontSize="11" fill="var(--past)" fontWeight={560}>{W < 520 ? "Past" : "Where it came from"}</text>
          <text x={x(max) - 2} y={axisY - 15} fontSize="11" fill="var(--future)" fontWeight={560} textAnchor="end">{W < 520 ? "Future" : "Where it goes"}</text>

          {/* age prior bracket */}
          <g>
            <path d={`M${x(-ap.max)} ${axisY - 4} V${axisY - 9} H${x(-ap.min)} V${axisY - 4}`} fill="none" stroke="var(--past)" strokeWidth={1.5} />
            <title>{`Age prior ${ap.min}–${ap.max} h (weak)`}</title>
          </g>
          {/* forecast horizons */}
          {[24, 48, 72].filter((t) => t <= max).map((t) => (
            <circle key={t} cx={x(t)} cy={axisY} r={3} fill="var(--future)" />
          ))}
          {/* selected ship: release window and best-fit release */}
          {c.shipsUnlocked && release && (
            <rect x={x(hoursFrom(tImage, release[0]))} y={axisY - 3} width={Math.max(3, x(hoursFrom(tImage, release[1])) - x(hoursFrom(tImage, release[0])))} height={6} fill="var(--ship-short)" opacity={0.8}>
              <title>Release window of the selected ship</title>
            </rect>
          )}
          {c.shipsUnlocked && selected?.candidate && (
            <g transform={`translate(${x(-selected.candidate.best_fit_age_h)} ${axisY})`}>
              <circle r={6} fill="var(--panel)" stroke="var(--past)" strokeWidth={2} />
              <text y={3.5} textAnchor="middle" fontSize="8" fontWeight={700} fill="var(--ink)">R</text>
              <title>{`Best-fit release of ${selected.name}: ${fmtRel(-selected.candidate.best_fit_age_h)}`}</title>
            </g>
          )}
          {/* image marker */}
          <line x1={x(0)} x2={x(0)} y1={axisY - 12} y2={axisY + 12} stroke="var(--ink)" strokeWidth={2} />
          <text x={x(0)} y={axisY + 19} textAnchor="middle" fontSize="11" fontWeight={650} fill="var(--ink)">Image</text>

          {/* swimlanes */}
          {lanesOpen &&
            lanes.map((v, i) => {
              const ti = c.trackIdx.get(v.mmsi)!;
              const y = lanesTop + i * (laneH + 4);
              const color = `var(--ship-${v.role === "leading" ? "lead" : v.role === "shortlist" ? "short" : v.role === "screened" ? "screen" : "elim"})`;
              const segs: [number, number][] = [];
              let s0 = ti.tH[0];
              for (const g of ti.gaps) {
                segs.push([s0, g.h0]);
                s0 = g.h1;
              }
              segs.push([s0, ti.tH[ti.tH.length - 1]]);
              return (
                <g key={v.mmsi} onPointerDown={(e) => { e.stopPropagation(); ws.select(v.mmsi); }} style={{ cursor: "pointer" }}>
                  <text x={PAD} y={y + laneH - 2} fontSize="10.5" fill="var(--ink-2)">{v.name}</text>
                  {segs.map(([a, b], k) => (
                    <rect key={k} x={x(Math.max(min, a))} y={y + 2} width={Math.max(1, x(Math.min(max, b)) - x(Math.max(min, a)))} height={laneH - 4} rx={2}
                      fill={color} opacity={ws.selectedMmsi === v.mmsi ? 1 : 0.75} />
                  ))}
                  {ti.gaps.map((g, k) => (
                    <line key={`g${k}`} x1={x(g.h0)} x2={x(g.h1)} y1={y + laneH / 2} y2={y + laneH / 2} stroke={color} strokeDasharray="1 3" />
                  ))}
                </g>
              );
            })}

          {/* scrubber */}
          <line x1={x(clock.h)} x2={x(clock.h)} y1={2} y2={H - 2} stroke="var(--accent)" strokeWidth={1.5} />
          <circle cx={x(clock.h)} cy={axisY} r={8} fill="var(--accent)" stroke="var(--panel)" strokeWidth={2.5} />
        </svg>
      </div>

      <div className="dock-readout" aria-live="polite">
        <b>{fmtUtc(absMs)}</b>
        <span className="muted">{fmtRel(clock.h)}</span>
      </div>
    </div>
  );
}

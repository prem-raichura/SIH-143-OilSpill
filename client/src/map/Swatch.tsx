// Small legend glyphs for map layers, shared by the layers panel and the map legend.
import { useId } from "react";
import type { LayerDef } from "../store/workspace";

export function Swatch({ kind }: { kind: LayerDef["swatch"] }) {
  const s = { width: 20, height: 14, className: "sw" } as const;
  // Gradient and pattern ids must be unique: the same swatch can appear in the layers panel and the legend.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  switch (kind) {
    case "sar":
      return <svg {...s}><defs><linearGradient id={`g-sar-${uid}`}><stop offset="0" stopColor="#222" /><stop offset="1" stopColor="#bbb" /></linearGradient></defs><rect width="20" height="14" rx="2" fill={`url(#g-sar-${uid})`} /></svg>;
    case "targets":
      return <svg {...s}><path d="M10 2l5 5-5 5-5-5z" fill="none" stroke="var(--ink)" strokeWidth="1.5" /></svg>;
    case "slick":
      return <svg {...s}><path d="M2 10c4-6 10-7 16-6-3 4-9 8-16 6z" fill="rgba(0,0,0,.45)" stroke="var(--ink)" strokeWidth="1.5" /></svg>;
    case "measure":
      return <svg {...s}><path d="M2 12L18 2" stroke="var(--ink)" strokeDasharray="3 2" /><path d="M8 5l4 5" stroke="var(--ink)" /></svg>;
    case "past-dot":
      return <svg {...s}>{[3, 7, 11, 15, 5, 9, 13].map((x, i) => <circle key={i} cx={x + 1} cy={i < 4 ? 5 : 10} r="1.4" fill="var(--past)" />)}</svg>;
    case "past-line":
      return <svg {...s}><path d="M2 11C7 9 10 5 18 3" stroke="var(--past)" strokeWidth="2" fill="none" /><path d="M2 9C7 7 11 4 18 5" stroke="var(--past)" strokeOpacity=".4" fill="none" /><circle cx="10" cy="6.5" r="1.8" fill="var(--past)" /></svg>;
    case "past-iso":
      return <svg {...s}><ellipse cx="10" cy="7" rx="8" ry="5" fill="none" stroke="var(--past)" strokeOpacity=".7" /><ellipse cx="10" cy="7" rx="4" ry="2.5" fill="none" stroke="var(--past)" strokeOpacity=".7" /></svg>;
    case "past-hatch":
      return <svg {...s}><defs><pattern id={`p-h-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--past)" strokeWidth="1.3" /></pattern></defs><rect x="1" y="1" width="18" height="12" rx="2" fill={`url(#p-h-${uid})`} stroke="var(--past)" strokeWidth="1.3" /></svg>;
    case "past-dash":
      return <svg {...s}><rect x="1.5" y="1.5" width="17" height="11" rx="2" fill="none" stroke="var(--past)" strokeDasharray="3 2" /></svg>;
    case "future-dot":
      return <svg {...s}>{[3, 7, 11, 15, 5, 9, 13].map((x, i) => <circle key={i} cx={x + 1} cy={i < 4 ? 5 : 10} r="1.4" fill="var(--future)" />)}</svg>;
    case "future-line":
      return <svg {...s}><path d="M2 3C8 5 11 9 18 11" stroke="var(--future)" strokeWidth="2" fill="none" /><circle cx="10" cy="7" r="1.8" fill="var(--future)" /></svg>;
    case "future-cone":
      return <svg {...s}><path d="M2 7L18 1V13Z" fill="var(--future)" fillOpacity=".18" stroke="var(--future)" /><path d="M2 7L11 4V10Z" fill="var(--future)" fillOpacity=".25" /></svg>;
    case "ship-line":
      return <svg {...s}><path d="M1 11L19 3" stroke="var(--ship-lead)" strokeWidth="2.5" /><path d="M1 13L19 7" stroke="var(--ship-short)" strokeWidth="1.5" /></svg>;
    case "ship-elim":
      return <svg {...s}><path d="M1 10L19 4" stroke="var(--ship-elim)" strokeWidth="1.3" strokeDasharray="3 2" /></svg>;
    case "ship-bg":
      return <svg {...s}><path d="M1 10L19 4" stroke="var(--ship-bg)" strokeWidth="1" /></svg>;
    case "ship-head":
      return <svg {...s}><path d="M10 1c3 2 3.5 4 3.5 6v6h-7V7c0-2 .5-4 3.5-6z" fill="var(--ship-short)" transform="rotate(35 10 7)" /></svg>;
    case "gap":
      return <svg {...s}><path d="M1 7H19" stroke="var(--ship-short)" strokeWidth="2" strokeDasharray="1 3" strokeLinecap="round" /></svg>;
    case "reach":
      return <svg {...s}><ellipse cx="10" cy="7" rx="8.5" ry="5" fill="var(--ink-2)" fillOpacity=".08" stroke="var(--ink-2)" strokeDasharray="3 2" /></svg>;
    case "release":
      return <svg {...s}><circle cx="10" cy="7" r="5" fill="none" stroke="var(--past)" strokeWidth="1.8" /><circle cx="10" cy="7" r="1.8" fill="var(--ship-short)" /></svg>;
    case "drifted":
      return <svg {...s}><path d="M1 10L19 4" stroke="var(--ship-lead)" strokeWidth="1.8" strokeDasharray="4 2" /></svg>;
    case "current":
      return <svg {...s}><path d="M3 11L15 4" stroke="var(--ink)" strokeOpacity=".7" strokeWidth="1.3" /><path d="M17 3l-5 .5 2.5 3z" fill="var(--ink)" fillOpacity=".7" /></svg>;
    case "wind":
      return <svg {...s}><path d="M4 12L15 2M15 2l3 3M12.5 4.5l3 3" stroke="var(--ink-2)" strokeWidth="1.3" fill="none" /></svg>;
    case "eez":
      return <svg {...s}><path d="M1 7H19" stroke="var(--ink-2)" strokeDasharray="4 2" /></svg>;
    case "grid":
      return <svg {...s}><path d="M7 1V13M13 1V13M1 7H19" stroke="var(--line-strong)" /></svg>;
    case "port":
      return <svg {...s}><path d="M10 3v9M6 5h8M4 8c1 4 11 4 12 0" stroke="var(--ink-2)" strokeWidth="1.3" fill="none" /></svg>;
    case "platform":
      return <svg {...s}><rect x="5" y="2" width="10" height="10" fill="none" stroke="var(--ink-2)" strokeWidth="1.3" /><circle cx="10" cy="7" r="1.6" fill="var(--ink-2)" /></svg>;
  }
}

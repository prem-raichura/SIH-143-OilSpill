import * as Popover from "@radix-ui/react-popover";
import { Layers, Lock, PanelLeftClose, PanelLeftOpen, RotateCcw, SlidersHorizontal, ZoomIn } from "lucide-react";
import { Tip } from "../components/ui";
import { LAYER_FIT, LAYERS, useWorkspace, type LayerDef } from "../store/workspace";
import { useCase } from "./useCase";

function Swatch({ kind }: { kind: LayerDef["swatch"] }) {
  const s = { width: 20, height: 14, className: "sw" } as const;
  switch (kind) {
    case "sar":
      return <svg {...s}><defs><linearGradient id="g-sar"><stop offset="0" stopColor="#222" /><stop offset="1" stopColor="#bbb" /></linearGradient></defs><rect width="20" height="14" rx="2" fill="url(#g-sar)" /></svg>;
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
      return <svg {...s}><defs><pattern id="p-h" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--past)" strokeWidth="1.3" /></pattern></defs><rect x="1" y="1" width="18" height="12" rx="2" fill="url(#p-h)" stroke="var(--past)" strokeWidth="1.3" /></svg>;
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
    case "online":
      return <svg {...s}><rect x="1" y="1" width="18" height="12" rx="2" fill="#bcd6e6" /><path d="M1 9c4-3 7 1 11-2s5-1 7 0v4H1z" fill="#e6dcc0" /></svg>;
    case "platform":
      return <svg {...s}><rect x="5" y="2" width="10" height="10" fill="none" stroke="var(--ink-2)" strokeWidth="1.3" /><circle cx="10" cy="7" r="1.6" fill="var(--ink-2)" /></svg>;
  }
}

export default function LayerRail() {
  const c = useCase();
  const { layers, toggleLayer, resetLayers, railOpen, set, opacity, setOpacity, requestFit, sarOpacity, setSarOpacity, selectedMmsi } = useWorkspace();
  if (!railOpen) {
    return (
      <aside className="rail" aria-label="Layers (collapsed)">
        <div style={{ display: "grid", justifyItems: "center", paddingTop: 8, gap: 6 }}>
          <Tip content="Show layers" side="right">
            <button type="button" className="icon-btn" aria-label="Show layers" onClick={() => set({ railOpen: true })}>
              <PanelLeftOpen size={16} />
            </button>
          </Tip>
          <Layers size={16} className="faint" aria-hidden="true" />
        </div>
      </aside>
    );
  }
  const groups = [...new Set(LAYERS.map((l) => l.group))];
  const hasSar = Boolean(c.bundle.meta.satellite);
  return (
    <aside className="rail" aria-label="Map layers">
      <div className="rail-head">
        <span className="t-section">Layers</span>
        <span>
          <Tip content="Back to this step's layers"><button type="button" className="icon-btn" aria-label="Reset layers" onClick={resetLayers}><RotateCcw size={15} /></button></Tip>
          <Tip content="Hide layers"><button type="button" className="icon-btn" aria-label="Hide layers" onClick={() => set({ railOpen: false })}><PanelLeftClose size={15} /></button></Tip>
        </span>
      </div>
      {groups.map((g) => (
        <div className="rail-group" key={g}>
          <h4>{g}</h4>
          {LAYERS.filter((l) => l.group === g).map((l) => {
            const lockedShips = l.ships && !c.shipsUnlocked;
            const unavailable = (l.id === "sar" || l.id === "targets") && !hasSar;
            const disabled = lockedShips || unavailable;
            const onNow = layers[l.id] && !disabled;
            return (
              <label key={l.id} className={`layer-row${onNow ? "" : " off"}${disabled ? " locked" : ""}`}
                title={lockedShips ? "Ships stay hidden until the oil check is answered" : unavailable ? "No satellite image for this simulated case" : undefined}>
                <Swatch kind={l.swatch} />
                <span>{l.label}</span>
                {!disabled ? (
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button type="button" className="layer-opts" aria-label={`Options for ${l.label}`} title="Opacity and zoom">
                        <SlidersHorizontal size={13} />
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content className="menu-pop layer-pop" side="right" align="start" sideOffset={8}>
                        <b style={{ fontSize: 13 }}>{l.label}</b>
                        <label className="field">
                          <span className="t-label">Opacity {Math.round((l.id === "sar" ? sarOpacity : opacity[l.id] ?? 1) * 100)} %</span>
                          <input
                            type="range" min={0.1} max={1} step={0.05}
                            value={l.id === "sar" ? sarOpacity : opacity[l.id] ?? 1}
                            onChange={(e) => (l.id === "sar" ? setSarOpacity(Number(e.target.value)) : setOpacity(l.id, Number(e.target.value)))}
                          />
                        </label>
                        {LAYER_FIT[l.id] && (
                          <Popover.Close asChild>
                            <button type="button" className="btn btn-secondary" disabled={LAYER_FIT[l.id] === "selected" && !selectedMmsi}
                              onClick={() => { toggleLayer(l.id, true); requestFit(LAYER_FIT[l.id]!); }}>
                              <ZoomIn size={14} /> Zoom to layer
                            </button>
                          </Popover.Close>
                        )}
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                ) : <span />}
                {lockedShips ? (
                  <Lock size={13} className="faint" aria-label="Locked" />
                ) : (
                  <input type="checkbox" checked={onNow} disabled={disabled} onChange={() => toggleLayer(l.id)} />
                )}
              </label>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

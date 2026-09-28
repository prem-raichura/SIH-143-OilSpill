import * as Popover from "@radix-ui/react-popover";
import * as Switch from "@radix-ui/react-switch";
import { ChevronDown, Layers, Lock, PanelLeftClose, PanelLeftOpen, RotateCcw, SlidersHorizontal, ZoomIn } from "lucide-react";
import { Tip } from "../components/ui";
import { Swatch } from "../map/Swatch";
import { LAYER_FIT, LAYERS, useWorkspace } from "../store/workspace";
import { useCase } from "./useCase";

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
        <span className="rail-title"><Layers size={16} strokeWidth={1.8} aria-hidden="true" /> Layers</span>
        <span className="rail-head-btns">
          <Tip content="Back to this step's layers"><button type="button" className="icon-btn" aria-label="Reset layers to this step" onClick={resetLayers}><RotateCcw size={15} /></button></Tip>
          <Tip content="Hide layers"><button type="button" className="icon-btn" aria-label="Hide layers" onClick={() => set({ railOpen: false })}><PanelLeftClose size={15} /></button></Tip>
        </span>
      </div>
      {groups.map((g) => {
        const defs = LAYERS.filter((l) => l.group === g);
        const state = defs.map((l) => {
          const lockedShips = Boolean(l.ships && !c.shipsUnlocked);
          const unavailable = (l.id === "sar" || l.id === "targets") && !hasSar;
          const disabled = lockedShips || unavailable;
          return { l, lockedShips, unavailable, disabled, onNow: layers[l.id] && !disabled };
        });
        const nOn = state.filter((x) => x.onNow).length;
        return (
          <details className="rail-group" key={g} open>
            <summary>
              <ChevronDown size={14} className="rail-caret" aria-hidden="true" />
              <span>{g}</span>
              <span className={`rail-count num${nOn ? " on" : ""}`}>{nOn}/{defs.length}</span>
            </summary>
            {state.map(({ l, lockedShips, unavailable, disabled, onNow }) => (
              <div key={l.id} className={`layer-row${onNow ? " on" : " off"}${disabled ? " locked" : ""}`}
                title={lockedShips ? "Ships stay hidden until the oil check is answered" : unavailable ? "No satellite image for this simulated case" : undefined}>
                <Swatch kind={l.swatch} />
                <label htmlFor={`layer-${l.id}`}>{l.label}</label>
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
                  <Switch.Root id={`layer-${l.id}`} className="switch" checked={onNow} disabled={disabled} onCheckedChange={() => toggleLayer(l.id)} aria-label={l.label}>
                    <Switch.Thumb className="switch-thumb" />
                  </Switch.Root>
                )}
              </div>
            ))}
          </details>
        );
      })}
    </aside>
  );
}

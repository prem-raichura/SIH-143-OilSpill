import * as Popover from "@radix-ui/react-popover";
import * as Switch from "@radix-ui/react-switch";
import { Ellipsis, Maximize, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Tip } from "../components/ui";
import { NARROW, useMedia } from "../lib/useMedia";
import { useMapPrefs } from "../store/mapPrefs";

export interface MapTool {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  /** Shown instead of the label as the tooltip when the tool is disabled. */
  disabledReason?: string;
}

/**
 * Map buttons in the bottom-right corner: zoom, fit and a "More tools" menu.
 * Expert tools live in the menu; with "Show advanced tools" on they also sit next to the zoom buttons.
 */
export default function MapControls({
  onZoomIn,
  onZoomOut,
  onFit,
  fitLabel = "Fit to view",
  tools = [],
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  fitLabel?: string;
  tools?: MapTool[];
}) {
  const { advanced, setAdvanced } = useMapPrefs();
  // Short maps on phones and tablets keep the expert tools in the menu only.
  const narrow = useMedia(NARROW);
  return (
    <div className="map-ctrls">
      {advanced && !narrow && tools.length > 0 && (
        <div className="ctrl-group" aria-label="Advanced map tools" role="group">
          {tools.map((t) => (
            <Tip key={t.key} content={t.disabled && t.disabledReason ? t.disabledReason : t.label} side="left">
              <button type="button" className="icon-btn" aria-label={t.label} aria-pressed={t.pressed} disabled={t.disabled} onClick={t.onClick}>
                {t.icon}
              </button>
            </Tip>
          ))}
        </div>
      )}
      <div className="ctrl-group" role="group" aria-label="Map view">
        <Tip content="Zoom in" side="left">
          <button type="button" className="icon-btn" aria-label="Zoom in" onClick={onZoomIn}><Plus size={18} /></button>
        </Tip>
        <Tip content="Zoom out" side="left">
          <button type="button" className="icon-btn" aria-label="Zoom out" onClick={onZoomOut}><Minus size={18} /></button>
        </Tip>
        <Tip content={fitLabel} side="left">
          <button type="button" className="icon-btn" aria-label={fitLabel} onClick={onFit}><Maximize size={16} /></button>
        </Tip>
        <Popover.Root>
          <Tip content="More tools" side="left">
            <Popover.Trigger asChild>
              <button type="button" className="icon-btn" aria-label="More map tools"><Ellipsis size={18} /></button>
            </Popover.Trigger>
          </Tip>
          <Popover.Portal>
            <Popover.Content className="menu-pop tools-pop" side="left" align="end" sideOffset={8} collisionPadding={8}>
              {tools.length > 0 && (
                <div className="tools-list" role="group" aria-label="Map tools">
                  {tools.map((t) => (
                    <Popover.Close asChild key={t.key}>
                      <button type="button" className="tools-row" aria-pressed={t.pressed} disabled={t.disabled} title={t.disabled ? t.disabledReason : undefined} onClick={t.onClick}>
                        <span className="tools-icon" aria-hidden="true">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    </Popover.Close>
                  ))}
                </div>
              )}
              <label className="tools-switch">
                <span>
                  <b>Show advanced tools</b>
                  <span className="t-label">Grid, coordinates and minimap, for GIS users.</span>
                </span>
                <Switch.Root className="switch" checked={advanced} onCheckedChange={setAdvanced} aria-label="Show advanced tools">
                  <Switch.Thumb className="switch-thumb" />
                </Switch.Root>
              </label>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}

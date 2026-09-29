import * as Popover from "@radix-ui/react-popover";
import { Check } from "lucide-react";
import { useMapPrefs } from "../store/mapPrefs";
import { BASEMAPS, basemapDef } from "./layers/basemap";

/** Basemap picker shown in the top-left corner of every map. */
export default function BasemapSwitcher() {
  const { basemap, setBasemap } = useMapPrefs();
  const cur = basemapDef(basemap);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="map-chip basemap-btn" aria-label={`Basemap: ${cur.label}. Change basemap`}>
          <span className="bm-thumb" style={{ background: `linear-gradient(135deg, ${cur.preview[0]} 55%, ${cur.preview[1]} 55%)` }} aria-hidden="true" />
          <span>{cur.label}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="menu-pop basemap-pop" align="start" sideOffset={6}>
          <b className="basemap-title">Basemap</b>
          <div className="basemap-grid" role="radiogroup" aria-label="Basemap">
            {BASEMAPS.map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={b.id === basemap} className="basemap-opt" onClick={() => setBasemap(b.id)}>
                <span className="bm-preview" style={{ background: `linear-gradient(135deg, ${b.preview[0]} 58%, ${b.preview[1]} 58%)` }} aria-hidden="true">
                  {b.id === basemap && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="bm-label">{b.label}</span>
                <span className="bm-hint">{b.hint}</span>
              </button>
            ))}
          </div>
          <p className="t-label">Web basemaps need an internet connection. The chart works without one.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

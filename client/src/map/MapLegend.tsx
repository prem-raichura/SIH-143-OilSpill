import { ChevronDown, ListTree } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface LegendItem {
  key: string;
  swatch: ReactNode;
  label: ReactNode;
}
export interface LegendGroup {
  title: string;
  items: LegendItem[];
}

/** Collapsible legend card in the bottom-left of a map. */
export default function MapLegend({ groups, defaultOpen }: { groups: LegendGroup[]; defaultOpen?: boolean }) {
  const narrow = typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches;
  const [open, setOpen] = useState(defaultOpen ?? !narrow);
  const shown = groups.filter((g) => g.items.length);
  return (
    <section className={`map-legend${open ? " open" : ""}`} aria-label="Legend">
      <button type="button" className="legend-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ListTree size={14} strokeWidth={1.8} aria-hidden="true" />
        <span>Legend</span>
        <ChevronDown size={14} className="legend-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="legend-body">
          {!shown.length && <p className="t-label">No layers are on.</p>}
          {shown.map((g) => (
            <div key={g.title} className="legend-group">
              <h4>{g.title}</h4>
              <ul>
                {g.items.map((it) => (
                  <li key={it.key}>
                    <span className="legend-sw">{it.swatch}</span>
                    <span>{it.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

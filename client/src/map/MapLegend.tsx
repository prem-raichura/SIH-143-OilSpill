import { ChevronDown, ListTree } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Collapse } from "../components/motion";
import { useMedia } from "../lib/useMedia";

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
  // Open on larger screens, collapsed on phones; follows the screen size unless a default is given.
  const small = useMedia("(max-width: 640px)");
  const [open, setOpen] = useState(defaultOpen ?? !small);
  useEffect(() => {
    if (defaultOpen == null) setOpen(!small);
  }, [small, defaultOpen]);
  const shown = groups.filter((g) => g.items.length);
  return (
    <section className={`map-legend${open ? " open" : ""}`} aria-label="Legend">
      <button type="button" className="legend-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ListTree size={14} strokeWidth={1.8} aria-hidden="true" />
        <span>Legend</span>
        <ChevronDown size={14} className="legend-caret" aria-hidden="true" />
      </button>
      <Collapse open={open} className="legend-collapse">
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
      </Collapse>
    </section>
  );
}

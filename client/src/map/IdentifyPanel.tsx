import { Info, LocateFixed, X } from "lucide-react";
import { useEffect } from "react";
import type { LonLat } from "../data/types";
import { fmtLonLat } from "../lib/geo";

export interface Identified {
  title: string;
  subtitle?: string;
  rows: [string, string][];
  at: LonLat | null;
}

/** Attribute panel for the feature clicked on the map (GIS "identify"). */
export default function IdentifyPanel({ item, onClose, onZoom, decimal }: { item: Identified; onClose: () => void; onZoom?: () => void; decimal: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <section className="identify" aria-label={`Details: ${item.title}`}>
      <header>
        <span className="identify-icon" aria-hidden="true"><Info size={15} strokeWidth={2} /></span>
        <div className="identify-title">
          <b>{item.title}</b>
          {item.subtitle && <span className="muted">{item.subtitle}</span>}
        </div>
        <button type="button" className="icon-btn" aria-label="Close details" onClick={onClose}><X size={15} /></button>
      </header>
      <dl className="kv">
        {item.rows.map(([k, v], i) => (
          <div key={i} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {item.at && (
          <>
            <dt>Clicked at</dt>
            <dd>{fmtLonLat(item.at, decimal)}</dd>
          </>
        )}
      </dl>
      {onZoom && (
        <button type="button" className="btn btn-secondary" onClick={onZoom}>
          <LocateFixed size={14} /> Zoom to
        </button>
      )}
    </section>
  );
}

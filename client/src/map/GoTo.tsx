import { MapPin, Search, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { LonLat } from "../data/types";
import { parseLatLon } from "../lib/geo";

/** "Go to" box: type a latitude and longitude, the map flies there and drops a pin. */
export default function GoTo({ onGo, onClear, active }: { onGo: (p: LonLat) => void; onClear: () => void; active: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseLatLon(text);
    if (!p) return setError(true);
    setError(false);
    onGo(p);
  };
  return (
    <form className={`map-chip goto${error ? " invalid" : ""}`} onSubmit={submit} role="search" aria-label="Go to a position">
      <Search size={14} strokeWidth={1.8} aria-hidden="true" />
      <input
        value={text}
        onChange={(e) => { setText(e.target.value); setError(false); }}
        placeholder="Go to lat, lon"
        aria-label="Latitude and longitude, for example 18.95, 72.83"
        aria-invalid={error}
        title={error ? "Could not read that position. Try 18.95, 72.83 or 18°57′N 72°50′E" : "For example 18.95, 72.83 or 18°57′N 72°50′E"}
      />
      {active ? (
        <button type="button" className="goto-btn" aria-label="Remove the pin" onClick={() => { setText(""); onClear(); }}><X size={14} /></button>
      ) : (
        <button type="submit" className="goto-btn" aria-label="Go"><MapPin size={14} /></button>
      )}
    </form>
  );
}

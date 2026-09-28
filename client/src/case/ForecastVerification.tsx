// Forecast verification (plan F-45): the operator records what was observed; the app computes the result.
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Section, SyntheticBadge } from "../components/ui";
import type { Feature, LonLat, PolygonGeometry } from "../data/types";
import { destination, distanceKm, fmtKm, fmtLonLat, inGeometry } from "../lib/geo";
import { fmtUtc, hoursFrom, isoAt } from "../lib/time";
import { useReview, type ForecastObservation } from "../store/review";
import type { CaseDerived } from "./useCase";

type Result = { label: string; detail: string; tone: "good" | "bad" | "neutral" };

function evaluate(c: CaseDerived, o: ForecastObservation): Result {
  const h = hoursFrom(c.bundle.meta.t_image, o.observedAt);
  if (h <= 0 || h > c.bundle.meta.forecast.hours) return { label: "Unknown", detail: "Observation is outside the 72 h forecast window.", tone: "neutral" };
  const env = (c.bundle.forecast.features as Feature<PolygonGeometry, { kind: string; hours?: number }>[])
    .filter((f) => f.properties.kind === "forecast_envelope")
    .sort((a, b) => (a.properties.hours ?? 0) - (b.properties.hours ?? 0));
  // The first envelope at or after the observation time (envelopes are cumulative bounds of the forecast spread).
  const e = env.find((f) => (f.properties.hours ?? 0) >= h) ?? env[env.length - 1];
  const inside = e ? inGeometry(o.lonlat, e.geometry) : false;
  const i = c.fwd ? Math.min(c.fwd.mean.length - 1, Math.round(h)) : -1;
  const d = i >= 0 && c.fwd ? distanceKm(o.lonlat, c.fwd.mean[i]) : NaN;
  const dTxt = isFinite(d) ? `${fmtKm(d)} from the forecast centre at +${Math.round(h)} h` : "";
  if (o.oilSeen) {
    return inside
      ? { label: "Observed inside", detail: `Inside the +${e.properties.hours} h envelope; ${dTxt}.`, tone: "good" }
      : { label: "Observed outside", detail: `Outside the +${e?.properties.hours} h envelope; ${dTxt}.`, tone: "bad" };
  }
  return inside
    ? { label: "Forecast expected oil here", detail: `Searched ${o.searchedRadiusKm} km around the point, none found, but the +${e.properties.hours} h envelope covers it.`, tone: "bad" }
    : { label: "Consistent (none expected)", detail: `Searched, none found, and the forecast did not expect oil here; ${dTxt}.`, tone: "good" };
}

export default function ForecastVerification({ c }: { c: CaseDerived }) {
  const all = useReview((s) => s.observations);
  const add = useReview((s) => s.addObservation);
  const remove = useReview((s) => s.removeObservation);
  const obs = useMemo(() => all.filter((o) => o.caseId === c.bundle.entry.id), [all, c.bundle.entry.id]);
  const [form, setForm] = useState({ source: "aircraft" as ForecastObservation["source"], when: "", lat: "", lon: "", oilSeen: true, radius: 5, note: "" });
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const lat = Number(form.lat);
    const lon = Number(form.lon);
    if (!form.when) return setErr("Enter the observation time in UTC.");
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return setErr("Enter latitude and longitude in decimal degrees, for example 8.62 and 76.10.");
    setErr(null);
    add({ caseId: c.bundle.entry.id, source: form.source, observedAt: new Date(`${form.when}Z`).toISOString(), lonlat: [lon, lat], oilSeen: form.oilSeen, searchedRadiusKm: form.radius, note: form.note, synthetic: false });
    setForm((f) => ({ ...f, note: "" }));
  };

  const example = () => {
    if (!c.fwd) return;
    const i = Math.min(c.fwd.mean.length - 1, 24);
    const p: LonLat = destination(c.fwd.mean[i], 90, 0.3);
    add({ caseId: c.bundle.entry.id, source: "aircraft", observedAt: isoAt(c.bundle.meta.t_image, 24), lonlat: p, oilSeen: true, searchedRadiusKm: 10, note: "Synthetic example: a patrol aircraft reports oil next to the forecast centre.", synthetic: true });
  };

  return (
    <Section title="Check the forecast against observations">
      <p className="muted" style={{ fontSize: 13 }}>
        Record what was seen, not a yes or no. The app works out whether the oil was inside the forecast envelope at that time.
      </p>
      {obs.map((o) => {
        const r = evaluate(c, o);
        return (
          <div key={o.id} className={`obs obs-${r.tone}`}>
            <header>
              <b>{r.label}</b>
              {o.synthetic && <SyntheticBadge>Synthetic example</SyntheticBadge>}
              <button type="button" className="icon-btn" aria-label="Remove observation" onClick={() => remove(o.id)}><Trash2 size={14} /></button>
            </header>
            <span className="t-label num">{o.source}, {fmtUtc(o.observedAt)}, {fmtLonLat(o.lonlat)}, {o.oilSeen ? "oil seen" : "searched, none found"}</span>
            <span style={{ fontSize: 12.5 }}>{r.detail}</span>
            {o.note && <span className="muted" style={{ fontSize: 12.5 }}>{o.note}</span>}
          </div>
        );
      })}
      <div className="obs-form">
        <label className="field"><span className="t-label">Source</span>
          <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as ForecastObservation["source"] })}>
            <option value="satellite">Satellite image</option><option value="aircraft">Aircraft</option><option value="vessel">Vessel</option><option value="shoreline">Shoreline report</option>
          </select>
        </label>
        <label className="field"><span className="t-label">Observed at (UTC)</span><input className="input" type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} /></label>
        <label className="field"><span className="t-label">Latitude</span><input className="input" inputMode="decimal" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="8.62" /></label>
        <label className="field"><span className="t-label">Longitude</span><input className="input" inputMode="decimal" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} placeholder="76.10" /></label>
        <label className="check-row" style={{ gridColumn: "1 / -1" }}><span /><span>Oil seen (untick for "searched, none found")</span><input type="checkbox" checked={form.oilSeen} onChange={(e) => setForm({ ...form, oilSeen: e.target.checked })} /></label>
        <label className="field"><span className="t-label">Area searched, radius km</span><input className="input" type="number" min={0.5} step={0.5} value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })} /></label>
        <label className="field"><span className="t-label">Note</span><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      </div>
      {err && <p className="error-note" role="alert">{err}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={submit}>Add observation</button>
        <button type="button" className="btn btn-secondary" onClick={example} disabled={!c.fwd}>Add labelled synthetic example</button>
      </div>
      <p className="note">"Searched, none found" is kept apart from "not searched". Performance is only reported in aggregate with case counts. Any model change is done offline, by people.</p>
    </Section>
  );
}

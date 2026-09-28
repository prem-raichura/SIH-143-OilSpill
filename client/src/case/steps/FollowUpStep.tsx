import { useMemo, useState } from "react";
import { KV, Section, Segmented } from "../../components/ui";
import { HullGlyph } from "../../components/HullGlyph";
import { distanceKm, fmtKm } from "../../lib/geo";
import { fmtUtc, hoursFrom } from "../../lib/time";
import { hullKind } from "../../lib/vessels";
import { useClock } from "../../store/clock";
import { useReview } from "../../store/review";
import { useShared } from "../../data/load";
import type { LonLat } from "../../data/types";
import { behaviourEvents } from "../../lib/behaviour";
import { useWorkspace } from "../../store/workspace";
import { PanelHead } from "../StepPanel";
import { useCase } from "../useCase";

const EVENT_LABEL: Record<string, string> = {
  port_entry: "Port entry",
  loitering: "Loitering",
  ais_gap: "AIS gap",
  corridor_reentry: "Back near the slick area",
  speed_change: "Speed change",
};

export default function FollowUpStep() {
  const c = useCase();
  const ws = useWorkspace();
  const runTo = useClock((s) => s.runTo);
  const setH = useClock((s) => s.setH);
  const { addSighting } = useReview();
  const allSightings = useReview((s) => s.sightings);
  const sightings = useMemo(() => allSightings.filter((x) => x.caseId === c.bundle.entry.id), [allSightings, c.bundle.entry.id]);
  const [where, setWhere] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const win = ws.followWindowH;
  const tImage = c.bundle.meta.t_image;
  const ports = useShared(c.bundle.meta.region).ports;
  const portPts = useMemo(() => (ports?.features ?? []).map((f) => (f.geometry as { coordinates: LonLat }).coordinates), [ports]);

  const rows = useMemo(
    () =>
      c.bundle.monitoring.vessels.map((m) => {
        const v = c.byMmsi.get(m.mmsi);
        const ti = c.trackIdx.get(m.mmsi);
        let km = 0;
        let fixes = 0;
        if (ti) {
          let prev: [number, number] | null = null;
          ti.tH.forEach((h, i) => {
            if (h < 0 || h > win) return;
            fixes++;
            if (prev) km += distanceKm(prev, ti.coords[i]);
            prev = ti.coords[i];
          });
        }
        let events = m.events.filter((e) => {
          const h = hoursFrom(tImage, e.t);
          return h >= 0 && h <= win;
        });
        // No precomputed events: derive them from the shipped track with the same rules (marked as derived).
        if (!events.length && ti && fixes > 1) {
          events = behaviourEvents({ ti, tImage, windowH: win, ports: portPts, slick: c.slickRings.flat() });
        }
        return { m, v, km, fixes, events };
      }),
    [c, win, tImage, portPts],
  );

  return (
    <>
      <PanelHead title="Follow-up">
        Every shortlisted ship is followed for the same window after the image. This is context only: scores and the verdict do not change.
      </PanelHead>
      <Segmented
        label="Follow-up window"
        value={win}
        onChange={(w) => ws.set({ followWindowH: w })}
        options={[6, 12, 24, 48, 72].map((w) => ({ value: w, label: `${w} h`, disabled: w > 24, title: w > 24 ? "The shipped AIS covers 24 h after the image" : undefined }))}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={() => runTo(0, win, 5)}>Play the window</button>
        <button type="button" className="btn btn-secondary" onClick={() => setH(0)}>Back to image time</button>
      </div>
      <Section title={`Ships followed (${rows.length})`}>
        {rows.length === 0 && <p className="muted">No shortlist, so no ships are followed.</p>}
        {rows.map(({ m, v, km, fixes, events }) => (
          <div key={m.mmsi} className="follow-card">
            <header>
              {v && <HullGlyph kind={hullKind(v.vesselType)} role={v.role} />}
              <b>{v?.name ?? `MMSI ${m.mmsi}`}</b>
              <button type="button" className="btn btn-quiet" onClick={() => ws.select(m.mmsi)}>Show</button>
            </header>
            <KV rows={[["AIS fixes in window", String(fixes || (win >= 24 ? m.fixes : 0))], ["Distance travelled", fmtKm(km)]]} />
            {fixes === 0 && m.fixes === 0 && <p className="note">No AIS after the image for this ship. Worth tasking the next Sentinel-1 pass.</p>}
            {events.length > 0 ? (
              <ol className="event-list">
                {events.map((e, i) => (
                  <li key={i}>
                    <span className="num t-label">{fmtUtc(e.t, false)}</span>
                    <span><b>{EVENT_LABEL[e.type] ?? e.type}</b> {e.text}{e.derived ? " (derived from the shipped track)" : ""}</span>
                  </li>
                ))}
              </ol>
            ) : fixes > 0 ? (
              <p className="note">No events: steady course and speed in this window.</p>
            ) : null}
          </div>
        ))}
        <p className="note">Port calls, loitering and course changes are ordinary for most ships. Watching only the suspect would make them look like confirmation, so all shortlisted ships get the same window.</p>
      </Section>
      <Section title="New oil sighting">
        <p className="muted" style={{ fontSize: 13 }}>Only a new, independent oil observation can change attribution. It opens a linked incident that needs a full re-run of the offline pipeline.</p>
        <label className="field"><span className="t-label">Observed at (UTC)</span><input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
        <label className="field"><span className="t-label">Where (place or coordinates)</span><input className="input" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. 8°50′N 76°05′E" /></label>
        <label className="field"><span className="t-label">Note</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Source: aircraft, vessel, next satellite pass" /></label>
        <button type="button" className="btn btn-primary" disabled={!when || !where} onClick={() => {
          const s = addSighting({ caseId: c.bundle.entry.id, observedAt: when, where, note });
          setWhere(""); setWhen(""); setNote("");
          void s;
        }}>Log sighting</button>
        {sightings.map((s) => (
          <p key={s.id} className="note note-strong">Logged as linked incident {s.linkedId} ({s.where}, {s.observedAt.replace("T", " ")} UTC). A full offline re-run is needed; the original verdict stays.</p>
        ))}
      </Section>
    </>
  );
}

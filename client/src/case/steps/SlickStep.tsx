import { BandMeter, Compass, RangeBar } from "../../charts/charts";
import { KV, Section } from "../../components/ui";
import { fmtKmNm, fmtLonLat } from "../../lib/geo";
import { PanelHead } from "../StepPanel";
import { useCase } from "../useCase";

export default function SlickStep() {
  const c = useCase();
  const m = c.bundle.meta.slick.measures;
  const ap = m.age_prior_h;
  return (
    <>
      <PanelHead title="Slick">
        Size and shape of the slick, and a weak first guess of its age. The age sets how far back the drift and the ship search go.
      </PanelHead>
      <Section title="Measurements">
        <KV
          rows={[
            ["Area", `${m.area_km2.toFixed(1)} km²`],
            ["Length", fmtKmNm(m.length_km)],
            ["Mean width", `${m.mean_width_km.toFixed(2)} km`],
            ["Perimeter", `${m.perimeter_km.toFixed(1)} km`],
            ["Elongation (length / width)", m.elongation.toFixed(1)],
            ["Compactness (4πA/P²)", m.compactness.toFixed(3)],
            ["Parts", String(m.components)],
            ["Orientation", `${Math.round(m.orientation_deg)}°`],
            ["Centroid", fmtLonLat(m.centroid)],
          ]}
        />
        <p className="note">No oil volume: radar cannot measure thickness.</p>
      </Section>
      <Section title="Shape indicator">
        <p>{m.shape_indicator.charAt(0).toUpperCase() + m.shape_indicator.slice(1)}.</p>
        <p className="note">An indicator from hand-set thresholds, not a classification.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {m.taper === "clear" && m.fresh_end_bearing_deg != null && <Compass bearing={m.fresh_end_bearing_deg} label="Fresh end bearing" />}
          <span>
            Taper: <b>{m.taper}</b>
            {m.taper === "clear" && m.fresh_end_bearing_deg != null ? `; the fresh (narrow) end points ${Math.round(m.fresh_end_bearing_deg)}°` : "; direction of travel not read from the shape"}
          </span>
        </div>
        {m.edge_truncated && <p className="note note-strong">The slick touches the image edge, land or no-data. Length and taper checks are switched off.</p>}
      </Section>
      <Section title="Wind at the slick">
        <BandMeter value={m.wind_speed_ms} min={0} max={20} band={[3, 10]} unit="m/s" label="Wind speed (ERA5)" />
        <p className="note">
          Radar detection is most reliable between 3 and 10 m/s. Reliability weight here: {Math.round(m.wind_reliability * 100)} %. ERA5 is
          coarse (about 25 km), so it is a weight, never a decision.
        </p>
      </Section>
      <Section title="Age prior (weak)">
        <RangeBar lo={ap.min} hi={ap.max} max={72} label="Age prior" />
        <p className="note">
          {ap.min} to {ap.max} hours, from spreading, edge sharpness, wind history and how long slicks stay visible.
          {ap.spreading_min_h != null && ap.spreading_min_h > 0.5 ? ` Its width rules out ages under ${ap.spreading_min_h.toFixed(1)} h.` : ""} The
          release time is only pinned down later, by the best-fitting ship track.
        </p>
      </Section>
    </>
  );
}

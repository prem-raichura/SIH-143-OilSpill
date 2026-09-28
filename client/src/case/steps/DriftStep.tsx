import { Play } from "lucide-react";
import { useEffect } from "react";
import { StackedArea } from "../../charts/charts";
import { KV, Section, Tabs } from "../../components/ui";
import type { MassBudget } from "../../data/types";
import { bearingDeg, distanceKm, fmtKm } from "../../lib/geo";
import { useClock } from "../../store/clock";
import { useWorkspace } from "../../store/workspace";
import { PanelHead } from "../StepPanel";
import ForecastVerification from "../ForecastVerification";
import { useCase } from "../useCase";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function DriftStep() {
  const c = useCase();
  const { driftTab, setDriftTab, playedDrift, set, toggleLayer, layers } = useWorkspace();
  const runTo = useClock((s) => s.runTo);
  const setH = useClock((s) => s.setH);
  const id = c.bundle.entry.id;
  const ap = c.bundle.meta.slick.measures.age_prior_h;
  const phys = c.bundle.meta.physics;
  const fc = c.bundle.meta.forecast;

  // The one orchestrated moment: the backward reconstruction plays once per case.
  useEffect(() => {
    if (!c.drift || playedDrift[id]) return;
    set({ playedDrift: { ...playedDrift, [id]: true } });
    if (reducedMotion()) setH(-ap.max);
    else runTo(0, -Math.min(48, ap.max), 4);
  }, [c.drift]); // eslint-disable-line react-hooks/exhaustive-deps

  const fwdCentroidAt = (hh: number) => {
    if (!c.fwd) return null;
    const i = c.fwd.hours.indexOf(hh);
    return i >= 0 ? c.fwd.mean[i] : c.fwd.mean[c.fwd.mean.length - 1];
  };
  const origin = c.bundle.meta.slick.measures.centroid;
  const mb = (c.bundle.forecast.properties as { mass_budget_fraction?: MassBudget } | undefined)?.mass_budget_fraction;

  return (
    <>
      <PanelHead title="Drift">Where the oil came from, where it goes next, and the ocean and wind that move it.</PanelHead>
      <Tabs
        label="Drift view"
        value={driftTab}
        onChange={setDriftTab}
        options={[
          { value: "back", label: "Came from" },
          { value: "fwd", label: "Goes to" },
          { value: "forcing", label: "Ocean and wind" },
        ]}
      />
      {!c.drift && <p className="muted">Loading drift particles…</p>}
      {driftTab === "back" && (
        <>
          <p>
            Particles run backward from the slick through currents, tides, waves and 2 % of the wind. The hatched band is the{" "}
            <b>release corridor</b>: where the oil could have been released during its age prior ({ap.min}–{ap.max} h).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => runTo(0, -Math.min(72, ap.max), 5)}>
              <Play size={14} /> Play backward
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setH(0)}>Back to image time</button>
          </div>
          <Section title="Backward ensemble">
            <KV
              rows={[
                ["Members", `${phys.backward_members} (perturbed current, wind, α)`],
                ["Particles", `${phys.backward_particles} per member`],
                ["Time step", `${phys.time_step_s / 60} min`],
                ...(c.back
                  ? ([[
                      `Route length to −${Math.min(48, ap.max)} h`,
                      fmtKm(distanceKm(c.back.mean[0], c.back.mean[Math.min(c.back.mean.length - 1, Math.min(48, ap.max))])),
                    ], [
                      `Spread at −${Math.min(48, ap.max)} h`,
                      `${c.back.spreadKm[Math.min(c.back.spreadKm.length - 1, Math.min(48, ap.max))].toFixed(1)} km (RMS)`,
                    ]] as [string, string][])
                  : []),
              ]}
            />
            <label className="check-row">
              <span /> <span>Show the 10 ensemble member routes</span>
              <input type="checkbox" checked={layers.backRoute} onChange={() => toggleLayer("backRoute")} />
            </label>
            <label className="check-row">
              <span /> <span>Show hours-before contours</span>
              <input type="checkbox" checked={layers.isochrones} onChange={() => toggleLayer("isochrones")} />
            </label>
          </Section>
          <p className="note">
            Backtracking alone does not give the release time. It gives where the oil was at each past hour. The release time is found only
            when a ship track fits (Evidence step).
          </p>
        </>
      )}
      {driftTab === "fwd" && (
        <>
          <p>OpenDrift OpenOil runs 72 h forward from the slick, with weathering. The cone widens with uncertainty.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => runTo(0, Math.min(72, c.range.max), 5)}>
              <Play size={14} /> Play forecast
            </button>
          </div>
          <Section title="Forecast">
            <table className="table">
              <thead>
                <tr><th>Horizon</th><th className="r">Centroid moved</th><th className="r">Toward</th></tr>
              </thead>
              <tbody>
                {[24, 48, 72].map((hh) => {
                  const p = fwdCentroidAt(hh);
                  return (
                    <tr key={hh}>
                      <td>+{hh} h</td>
                      <td className="r">{p ? fmtKm(distanceKm(origin, p)) : "–"}</td>
                      <td className="r">{p ? `${Math.round(bearingDeg(origin, p))}°` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className={fc.coastal_impact ? "note note-strong" : "note"}>
              {fc.coastal_impact
                ? `Coastal alert: ${fc.stranded_elements} forecast elements reach the coast within ${fc.hours} h.`
                : `No oil reaches the coast within ${fc.hours} h in this forecast.`}
            </p>
            <KV rows={[["Model", fc.model], ["Oil type", fc.oil_type.toLowerCase()]]} />
          </Section>
          {mb && (
            <Section title="Where the oil mass goes">
              <StackedArea
                hours={mb.mass_oil.map((_, i) => i)}
                series={[
                  { label: "On the surface", values: mb.mass_oil, color: "var(--future)" },
                  { label: "Evaporated", values: mb.mass_evaporated, color: "color-mix(in srgb, var(--future) 45%, var(--panel))" },
                  { label: "Dispersed", values: mb.mass_dispersed, color: "var(--ink-2)" },
                ]}
              />
            </Section>
          )}
          <p className="note">INCOIS OOSA already forecasts oil drift for India. This forecast keeps the pipeline self-contained; our addition is attribution.</p>
          <ForecastVerification c={c} />
        </>
      )}
      {driftTab === "forcing" && (
        <>
          <div className="formula" aria-label="Surface oil velocity formula">
            V<sub>oil</sub> = V<sub>current</sub> + V<sub>tide</sub> + V<sub>Stokes</sub> + α · V<sub>wind 10 m</sub>
          </div>
          <p>
            One formula is used everywhere: backward runs, ship screening, forward confirmation, the forecast and the benchmark generator (which
            deliberately uses different physics).
          </p>
          <KV
            rows={[
              ["α (wind factor)", `${Math.round(phys.alpha * 100)} % (ensemble ${Math.round(phys.alpha_range[0] * 100)}–${Math.round(phys.alpha_range[1] * 100)} %)`],
              ["Currents and tide", phys.current_source],
              ["Stokes drift", phys.stokes_source ?? "not separate"],
              ["Wind", phys.wind_source],
              ["Current error per member", phys.current_error_sd_ms != null ? `${phys.current_error_sd_ms} m/s` : "–"],
              ["Diffusion", phys.diffusion_m2s != null ? `${phys.diffusion_m2s} m²/s` : "–"],
            ]}
          />
          {phys.tides_missing && <p className="note note-strong">Tides missing: fallback currents; wider uncertainty on the shelf.</p>}
          <Section title="Data sources">
            <KV rows={Object.entries(c.bundle.meta.forcing).map(([k, v]) => [k.replace(/_/g, " "), <span style={{ fontSize: 11.5 }}>{v}</span>])} />
          </Section>
          <label className="check-row">
            <span /> <span>Show currents</span>
            <input type="checkbox" checked={layers.currents} onChange={() => toggleLayer("currents")} />
          </label>
          <label className="check-row">
            <span /> <span>Show wind barbs</span>
            <input type="checkbox" checked={layers.wind} onChange={() => toggleLayer("wind")} />
          </label>
        </>
      )}
    </>
  );
}

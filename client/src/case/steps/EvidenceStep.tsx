import { Box, Route } from "lucide-react";
import { useEffect } from "react";
import { DivergingBar, StripDots } from "../../charts/charts";
import { Band, KV, Meter, Section } from "../../components/ui";
import { HullGlyph } from "../../components/HullGlyph";
import { fmtKm } from "../../lib/geo";
import { fmtClock, fmtRel, hoursFrom } from "../../lib/time";
import { HULL_LABEL, hullKind, ROLE_LABEL } from "../../lib/vessels";
import { useClock } from "../../store/clock";
import { useWorkspace } from "../../store/workspace";
import { PanelHead } from "../StepPanel";
import { useCase } from "../useCase";

const ITEM_LABEL: Record<string, string> = {
  spatial_fit: "Spatial fit",
  release_time_in_prior: "Release time inside the age prior",
  length_consistency: "Length consistency",
  direction_consistency: "Direction consistency",
  direct_association: "Radar-confirmed presence",
  ais_gap_near_corridor: "AIS gap near the corridor",
  gap_explained_by_sar: "AIS gap explained by a radar detection",
  slowdown: "Slowdown near the corridor",
  loitering: "Loitering near the corridor",
  course_change: "Unusual course change",
  absence_continuous_far: "Continuous AIS away from the corridor",
  spoofing: "AIS consistency flags",
  vessel_type: "Vessel type (weak prior)",
};

export default function EvidenceStep() {
  const c = useCase();
  const ws = useWorkspace();
  const setH = useClock((s) => s.setH);
  const fallback = c.vessels.find((v) => v.role === "leading") ?? c.vessels.find((v) => v.candidate);
  const v = (ws.selectedMmsi && c.byMmsi.get(ws.selectedMmsi)) || fallback;
  const mmsi = v?.mmsi;
  const age = v?.candidate?.best_fit_age_h;
  useEffect(() => {
    if (mmsi == null) return;
    if (!ws.selectedMmsi) ws.select(mmsi);
    if (age != null) setH(-age);
  }, [mmsi]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return <PanelHead title="Evidence">No candidate ships in this case.</PanelHead>;
  const cand = v.candidate;
  const maxAbs = Math.max(1, ...(cand?.items ?? []).map((i) => Math.abs(i.contribution)));
  const others = c.vessels.filter((o) => o.mmsi !== v.mmsi && (o.candidate || o.eliminated)).slice(0, 12);

  return (
    <>
      <PanelHead title="Evidence">Why this ship is or is not consistent with the slick. Pick any ship on the map or in the list.</PanelHead>
      <header className="vessel-head">
        <HullGlyph kind={hullKind(v.vesselType)} role={v.role} size={28} />
        <div>
          <h3 className="t-section" style={{ fontSize: 17 }}>{v.name}</h3>
          <div className="muted num" style={{ fontSize: 12.5 }}>
            MMSI {v.mmsi}, {HULL_LABEL[hullKind(v.vesselType)].toLowerCase()}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <span className="chip">{ROLE_LABEL[v.role]}</span>
            {cand && <Band band={cand.band} />}
          </div>
        </div>
      </header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary" onClick={() => ws.toggleLayer("driftCorrected")} aria-pressed={ws.layers.driftCorrected}>
          <Route size={14} /> Drift-corrected track
        </button>
        {cand && (
          <button type="button" className="btn btn-secondary" onClick={() => setH(-cand.best_fit_age_h)}>
            Go to best-fit release
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => ws.setView("scene")}>
          <Box size={14} /> View in 3D (hypothesis)
        </button>
      </div>
      {ws.layers.driftCorrected && (
        <p className="note">
          Dashed line: each AIS position before the image, moved with the ocean and wind to the image time (fast screening approximation, α 3 %
          because the forcing arrows carry no separate Stokes drift). The blue haze is the 1-sigma spread. If the line lands on the slick, the
          ship's past track is consistent with it.
        </p>
      )}

      {v.eliminated && (
        <Section title="Reachability veto">
          <p className="note note-strong">{v.eliminated.why_not}</p>
          <KV
            rows={[
              ["Continuous AIS", v.eliminated.continuous ? "yes" : "no"],
              ["Longest gap", `${v.eliminated.max_gap_h.toFixed(1)} h`],
              ["Spoofing flags", v.eliminated.spoofing ? "yes" : "none"],
              ["Closest approach", `${fmtKm(v.eliminated.closest_dist_km)} at ${v.eliminated.closest_age_h} h before the image`],
            ]}
          />
          <p className="note">The only hard rule. It applies only when AIS is continuous, clean, and the ship could not reach the corridor even at 25 kn.</p>
        </Section>
      )}

      {cand ? (
        <>
          <Section title="Investigation ledger" aside={<span className="num t-label">Score {cand.score.toFixed(2)}</span>}>
            <div role="list">
              {cand.items.map((it) => (
                <div key={it.key} className="evidence-row" role="listitem">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 580 }}>{it.contribution >= 0 ? "For" : "Against"}: {ITEM_LABEL[it.key] ?? it.key}</span>
                    <DivergingBar value={it.contribution} max={maxAbs} />
                  </div>
                  <span className="txt">{it.text.charAt(0).toUpperCase() + it.text.slice(1)}</span>
                  <span className="calc">
                    weight {it.weight} × value {it.value.toFixed(2)} × reliability {it.reliability.toFixed(2)} = {it.contribution >= 0 ? "+" : "−"}
                    {Math.abs(it.contribution).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              {cand.confirmation
                ? "Forward confirmation replaces the screening overlay in the spatial fit, so the fit is counted once."
                : "Only the fast screening fit is available for this ship."}{" "}
              Bands are calibrated scores, never real-world probabilities.
            </p>
          </Section>

          {cand.screening && (
            <Section title="Screening (all ships)">
              <KV
                rows={[
                  ["Drift-corrected distance to slick", fmtKm(cand.screening.d_km)],
                  ["Uncertainty (1 sigma)", fmtKm(cand.screening.sigma_km)],
                  ["Log-likelihood", cand.screening.log_likelihood.toFixed(2)],
                  ...(cand.best_fit_release_time ? ([["Best-fit release", `${fmtClock(cand.best_fit_release_time)} (${fmtRel(-cand.best_fit_age_h)})`]] as [string, string][]) : []),
                ]}
              />
            </Section>
          )}

          {cand.confirmation && (
            <Section title="Forward confirmation (top candidates)">
              <StripDots values={cand.confirmation.fss_members} mean={cand.confirmation.fss} label="Fraction Skill Score of 5 members" />
              <KV
                rows={[
                  ["Fraction Skill Score", cand.confirmation.fss.toFixed(2)],
                  ["Centroid distance", `${fmtKm(cand.confirmation.centroid_km)} (${cand.confirmation.centroid_over_sigma.toFixed(2)} sigma)`],
                  ["Orientation difference", cand.confirmation.orientation_diff_deg != null ? `${Math.round(cand.confirmation.orientation_diff_deg)}°` : "not used (blob)"],
                  ["Release window", `${fmtClock(cand.confirmation.release_window[0])} to ${fmtClock(cand.confirmation.release_window[1])}`],
                  ["Scales", cand.confirmation.scales_km.map((s) => `${s} km`).join(", ")],
                ]}
              />
              <p className="note">OpenDrift releases oil along this ship's real track and compares the modelled slick with the observed one.</p>
            </Section>
          )}

          <Section title="Rank stability">
            <p>
              First in <b>{Math.round(cand.rank1_share * 50)}</b> of 50 perturbed runs <Meter value={cand.rank1_share} label="Rank-first share" />
            </p>
            <p className="note">Runs vary the slick outline and the ocean and wind forcing. A stability measure, not a probability.</p>
          </Section>

          <Section title="Other checks">
            <KV
              rows={[
                ...(cand.shape ? ([["Length", cand.shape.length], ["Direction", cand.shape.direction]] as [string, string][]) : []),
                ...(cand.reachability
                  ? ([["Reachable", cand.reachability.reachable ? "yes" : "no"], ["Longest AIS gap", `${cand.reachability.max_gap_h.toFixed(1)} h`]] as [string, string][])
                  : []),
                ["Radar match", cand.sar ? `${cand.sar.status} (radius ${Math.round(cand.sar.radius_km)} km)` : "none nearby"],
                ...(cand.best_fit_release_time ? ([["Release time vs image", `${hoursFrom(c.bundle.meta.t_image, cand.best_fit_release_time).toFixed(1)} h`]] as [string, string][]) : []),
              ]}
            />
          </Section>
        </>
      ) : (
        !v.eliminated && <p className="muted">This ship was not scored: it is background traffic outside the candidate list.</p>
      )}

      <Section title="Why not the others">
        <div className="list">
          {others.map((o) => (
            <button key={o.mmsi} type="button" className="list-row" onClick={() => ws.select(o.mmsi)}>
              <HullGlyph kind={hullKind(o.vesselType)} role={o.role} />
              <span className="name">{o.name}</span>
              <span className="num t-label">{o.candidate ? o.candidate.score.toFixed(2) : "veto"}</span>
              <span className="sub">{(o.whyNot ?? ROLE_LABEL[o.role]).replace(/^x /, "").replace(/; ([x+]) /g, "; ")}</span>
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

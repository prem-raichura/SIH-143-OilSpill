import { ChevronLeft, Printer } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../auth/session";
import { useCaseDerived, type CaseDerived } from "../case/useCase";
import { ErrorNote, Loading } from "../components/ui";
import { useCaseBundle, useLand, type LandFC } from "../data/load";
import { PLACE } from "../data/places";
import type { Feature, LonLat, PolygonGeometry } from "../data/types";
import { fmtKm, fmtKmNm, fmtLonLat, geometryRings } from "../lib/geo";
import { aspectHeight, boundsOf, fitProjector, landPath, scaleBar } from "../map/svgChart";
import { fmtRel, fmtUtc } from "../lib/time";
import { ROLE_LABEL } from "../lib/vessels";
import { useReview } from "../store/review";

type MapMode = "overview" | "back" | "forward" | "ships";

function MiniMap({ c, title, mode = "overview", land }: { c: CaseDerived; title: string; mode?: MapMode; land?: LandFC }) {
  const cone = (c.bundle.forecast.features as Feature<PolygonGeometry, { kind: string }>[]).filter((f) => f.properties.kind === "forecast_envelope");
  const keyShips = c.vessels.filter((v) => v.track && (v.role === "leading" || v.role === "shortlist" || (mode === "ships" && v.role === "screened")));
  const elim = mode === "ships" ? c.vessels.filter((v) => v.track && v.role === "eliminated") : [];
  const show = {
    cone: mode === "overview" || mode === "forward",
    corridor: mode !== "forward",
    back: mode === "overview" || mode === "back",
    ages: mode === "back",
    fwd: mode === "forward",
    ships: mode === "overview" || mode === "ships",
  };
  const clip = (v: (typeof keyShips)[number]) => v.track!.geometry.coordinates.filter((_, i) => Math.abs(v.track!.properties.t_offset_s[i]) < 60 * 3600);
  const all: LonLat[] = [...c.slickRings.flat()];
  if (show.corridor && c.release) all.push(...geometryRings(c.release.geometry).flat());
  if (show.cone) all.push(...cone.flatMap((f) => geometryRings(f.geometry).flat()));
  if (show.fwd && c.fwd) all.push(...c.fwd.mean);
  if (show.back && c.back) all.push(...c.back.mean.slice(0, 49));
  if (mode === "ships") for (const v of keyShips) all.push(...clip(v));
  const bounds = boundsOf(all) ?? c.bounds.corridor;
  const W = 640;
  const H = Math.round(aspectHeight(bounds, W, 320, 520));
  const proj = fitProjector(bounds, W, H);
  const d = proj.path;
  const coast = landPath(land, proj);
  const bar = scaleBar(proj, 130);
  const captions: Record<MapMode, string> = {
    overview: "Black: slick. Magenta: backward route and release corridor. Amber: forecast 24, 48, 72 h. Blue: shortlisted ship tracks, rings at best-fit release.",
    back: "Black: slick at the image. Magenta: release corridor, contours of where the oil was 1 to 72 h earlier, and the ensemble-mean backward route.",
    forward: "Black: slick at the image. Amber: forecast envelopes at 24, 48 and 72 h and the mean forecast route.",
    ships: "Blue: leading, shortlisted and screened ship tracks (darker = stronger). Grey dashed: ships eliminated by reachability. Magenta: release corridor.",
  };
  return (
    <figure className="report-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <rect width={W} height={H} fill="#D9E9F4" />
        {coast && <path d={coast} fill="#EFEBE0" fillRule="evenodd" stroke="#B7AE92" strokeWidth={0.8} />}
        {show.cone && cone.map((f, i) => geometryRings(f.geometry).map((r, j) => <path key={`${i}-${j}`} d={d(r, true)} fill="#B86E00" fillOpacity={0.12} stroke="#B86E00" strokeWidth={1} />))}
        {show.corridor && c.release && geometryRings(c.release.geometry).map((r, i) => <path key={i} d={d(r, true)} fill="#C2407E" fillOpacity={0.12} stroke="#C2407E" strokeWidth={1.2} />)}
        {show.ages && c.ages.map((f, i) => geometryRings(f.geometry).map((r, j) => <path key={`a${i}-${j}`} d={d(r, true)} fill="none" stroke="#C2407E" strokeOpacity={0.45} strokeWidth={0.8} />))}
        {show.back && c.back && <path d={d(c.back.mean.slice(0, 49))} fill="none" stroke="#C2407E" strokeWidth={2} />}
        {show.fwd && c.fwd && <path d={d(c.fwd.mean)} fill="none" stroke="#B86E00" strokeWidth={2} />}
        {elim.map((v) => <path key={`e${v.mmsi}`} d={d(clip(v))} fill="none" stroke="#8A9AA3" strokeWidth={1} strokeDasharray="4 3" />)}
        {show.ships && keyShips.map((v) => (
          <path key={v.mmsi} d={d(clip(v))} fill="none" stroke={v.role === "leading" ? "#184F95" : v.role === "shortlist" ? "#2A78D6" : "#86B6EF"} strokeWidth={v.role === "leading" ? 2.5 : 1.6} />
        ))}
        {c.slickRings.map((r, i) => <path key={i} d={d(r, true)} fill="#1D1712" fillOpacity={0.5} stroke="#0F2233" strokeWidth={1.3} />)}
        {show.ships && keyShips.filter((v) => v.candidate && v.role !== "screened").map((v) => {
          const [x, y] = proj.xy(v.candidate!.best_fit_position);
          return <circle key={`r${v.mmsi}`} cx={x} cy={y} r={5} fill="#fff" stroke="#C2407E" strokeWidth={2} />;
        })}
        <g transform={`translate(${W - 30} 16)`} aria-hidden="true">
          <path d="M0 22 L7 0 L14 22 L7 17 Z" fill="#0F2233" />
          <text x={7} y={36} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0F2233">N</text>
        </g>
        <g transform={`translate(14 ${H - 16})`} aria-hidden="true">
          <rect x={-6} y={-18} width={bar.px + 52} height={26} rx={4} fill="#FFFFFF" fillOpacity={0.8} />
          <path d={`M0 -6 V0 H${bar.px.toFixed(1)} V-6`} fill="none" stroke="#0F2233" strokeWidth={1.5} />
          <text x={bar.px + 6} y={0} fontSize={11} fill="#0F2233">{bar.km} km</text>
        </g>
        <rect width={W} height={H} fill="none" stroke="#C9D3DD" />
      </svg>
      <figcaption>{title}. {captions[mode]}</figcaption>
    </figure>
  );
}

export default function Report() {
  const { id } = useParams();
  const bundle = useCaseBundle(id);
  const c = useCaseDerived(bundle.data);
  const land = useLand(bundle.data?.meta.region ?? null);
  const session = useSession((s) => s.session);
  const review = useReview((s) => (id ? s.reviews[id] : undefined));
  const allSightings = useReview((s) => s.sightings);
  const sightings = useMemo(() => allSightings.filter((x) => x.caseId === id), [allSightings, id]);

  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "day");
    document.title = `Report ${id}`;
    return () => {
      document.documentElement.setAttribute("data-theme", prev ?? "night");
      document.title = "OILENS";
    };
  }, [id]);

  if (bundle.error) return <div className="page-pad"><ErrorNote error={bundle.error} /></div>;
  if (!c) return <div className="page-pad"><Loading lines={6} /></div>;
  const { meta, ledger, entry } = c.bundle;
  const m = meta.slick.measures;
  const v = c.verdict;
  const lead = v.lead;
  const key = c.vessels.filter((x) => x.role === "leading" || x.role === "shortlist");
  const statement = v.code === 1 ? "Not oil (likely a look-alike)" : v.code === 2 ? "Insufficient data for attribution" : v.code === 3 ? `Leading candidate: ${lead?.name}` : v.code === 4 ? "Multiple plausible candidates" : "No consistent AIS vessel";

  return (
    <div className="report-page">
      <div className="report-bar no-print">
        <Link to={`/app/case/${entry.id}?step=verdict`} className="btn btn-quiet"><ChevronLeft size={15} /> Back to the case</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print or save as PDF</button>
      </div>
      <article className="report">
        <header className="report-head">
          <span className="t-label">OILENS investigation report</span>
          <h1 className="t-page">{entry.id}: <span className="place">{PLACE[entry.id]}</span></h1>
          <p className="num">Image {fmtUtc(entry.t_image)}. Generated {fmtUtc(Date.now())}{session ? ` by ${session.name} (${session.role})` : ""}.</p>
        </header>

        <section>
          <h2>1. Summary</h2>
          <p className="t-verdict" style={{ fontSize: 26, lineHeight: "32px" }}>Verdict {v.code}: {statement}</p>
          {v.code === 3 && lead && <p>Best-fit release {fmtUtc(lead.best_fit_release_time)} ({fmtRel(-lead.best_fit_age_h)}). Score gap {v.gap?.toFixed(2)}, first in {Math.round(lead.rank1_share * 100)} % of 50 perturbed runs.</p>}
          {v.code === 5 && <p>Probable source: {ledger.verdict.probable_source}. {ledger.verdict.reason}</p>}
          {ledger.verdict.reason && v.code !== 5 && <p className="muted">{ledger.verdict.reason}</p>}
          <ol className="check-list">
            {v.checks.map((ch) => (
              <li key={ch.order} className={ch.status}>
                <span className="o">{ch.order}</span><span className="q">{ch.question}</span><span className="s">{ch.status === "fired" ? "Verdict" : ch.status === "continue" ? "Continue" : ""}</span><span className="d">{ch.detail}</span>
              </li>
            ))}
          </ol>
          <MiniMap c={c} land={land} title={`${entry.id} overview`} />
        </section>

        <section className="page-break">
          <h2>2. Satellite evidence and the slick</h2>
          <table className="table">
            <tbody>
              <tr><td>Sentinel-1 product</td><td className="num" style={{ wordBreak: "break-all" }}>{meta.satellite?.product_id ?? "None: no satellite image for this case"}</td></tr>
              {meta.satellite && <tr><td>Acquisition</td><td>{fmtUtc(meta.satellite.acquisition_start)} to {fmtUtc(meta.satellite.acquisition_end)}, {meta.satellite.polarisation}</td></tr>}
              <tr><td>Outline source</td><td>{meta.slick.source}{m.cerulean_machine_confidence != null ? `, detector confidence ${Math.round(m.cerulean_machine_confidence * 100)} %` : ""}</td></tr>
              <tr><td>Area, length, width</td><td>{m.area_km2.toFixed(1)} km², {fmtKmNm(m.length_km)}, {m.mean_width_km.toFixed(2)} km</td></tr>
              <tr><td>Shape</td><td>Elongation {m.elongation.toFixed(1)}, compactness {m.compactness.toFixed(3)}, {m.components} parts, orientation {Math.round(m.orientation_deg)}°. {m.shape_indicator}.</td></tr>
              <tr><td>Centroid</td><td>{fmtLonLat(m.centroid)}</td></tr>
              <tr><td>Wind at slick</td><td>{m.wind_speed_ms} m/s, reliability {Math.round(m.wind_reliability * 100)} %</td></tr>
              <tr><td>Age prior (weak)</td><td>{m.age_prior_h.min} to {m.age_prior_h.max} h</td></tr>
              <tr><td>Edge truncated</td><td>{m.edge_truncated ? "yes (length and taper checks off)" : "no"}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>3. Drift</h2>
          <p>Backward ensemble of {meta.physics.backward_members} members × {meta.physics.backward_particles} particles over the age prior gives the release corridor. OpenDrift OpenOil forecast to {meta.forecast.hours} h: {meta.forecast.coastal_impact ? `${meta.forecast.stranded_elements} elements reach the coast` : "no oil reaches the coast"}.</p>
          <p className="muted">{meta.physics.formula}; α {Math.round(meta.physics.alpha * 100)} % ({meta.physics.current_source}; {meta.physics.wind_source}).</p>
          <div className="report-maps">
            <MiniMap c={c} land={land} mode="back" title="Where the oil came from" />
            <MiniMap c={c} land={land} mode="forward" title="Where the oil goes" />
          </div>
        </section>

        <section className="page-break">
          <h2>4. Ships</h2>
          <MiniMap c={c} land={land} mode="ships" title="Ships near the release corridor" />
          <p>{ledger.counts.vessels_in_window} ships in the search window; {ledger.counts.eliminated} eliminated by reachability; {ledger.counts.screened} screened; {ledger.counts.confirmed} confirmed with forward drift. AIS coverage {ledger.ais_coverage.score.toFixed(2)} (threshold {ledger.ais_coverage.threshold}).</p>
          {key.map((x) => x.candidate && (
            <div key={x.mmsi} className="report-ship">
              <h3>{x.name} <span className="muted">MMSI {x.mmsi}, {ROLE_LABEL[x.role].toLowerCase()}, score {x.candidate.score.toFixed(2)}, {x.candidate.band} band</span></h3>
              <table className="table">
                <thead><tr><th>Evidence</th><th className="r">Weight × value × reliability</th><th className="r">Contribution</th></tr></thead>
                <tbody>
                  {x.candidate.items.map((it) => (
                    <tr key={it.key}><td>{it.text}</td><td className="r">{it.weight} × {it.value.toFixed(2)} × {it.reliability.toFixed(2)}</td><td className="r">{it.contribution >= 0 ? "+" : "−"}{Math.abs(it.contribution).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <h3>Why not the others</h3>
          <ul className="plain-list">
            {ledger.why_not.slice(0, 8).map((w) => <li key={w.mmsi}><b>{w.name}</b>: {w.text.replace(/^x /, "").replace(/; ([x+]) /g, "; ")}</li>)}
            {ledger.eliminated.slice(0, 5).map((e) => <li key={`e${e.mmsi}`}><b>{e.name}</b>: {e.why_not}</li>)}
          </ul>
        </section>

        <section>
          <h2>5. Human assessment</h2>
          <table className="table">
            <tbody>
              <tr><td>Oil check</td><td>{c.gate ? `${c.gate.label.replace("_", " ")} at ${fmtUtc(c.gate.at)}; reason: ${c.gate.reason}${c.gate.note ? `; ${c.gate.note}` : ""}${c.gate.blind ? " (blind review)" : ""}` : "Not answered; the analysis assumes confirmed oil"}</td></tr>
              <tr><td>Case review</td><td>{review ? `${review.decision === "accept" ? "Accepted" : "Disputed"} on ${fmtUtc(review.at)}${review.note ? `: ${review.note}` : ""}. The system verdict is unchanged.` : "No case review yet"}</td></tr>
              <tr><td>New sightings</td><td>{sightings.length ? sightings.map((s) => `${s.linkedId} (${s.where}, ${s.observedAt})`).join("; ") : "None"}</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>6. Follow-up (context only)</h2>
          <p className="muted">Every shortlisted ship was followed for the same window. Post-incident behaviour never changes the score or the verdict.</p>
          <ul className="plain-list">
            {c.bundle.monitoring.vessels.map((mv) => (
              <li key={mv.mmsi}><b>{c.byMmsi.get(mv.mmsi)?.name ?? mv.mmsi}</b>: {mv.fixes} AIS fixes in 24 h; {mv.events.length ? mv.events.map((e) => `${e.type.replace("_", " ")} (${fmtUtc(e.t, false)})`).join(", ") : "no events"}.</li>
            ))}
            {!c.bundle.monitoring.vessels.length && <li>No shortlist, no follow-up.</li>}
          </ul>
        </section>

        <section className="page-break">
          <h2>7. Uncertainty, data quality and provenance</h2>
          <table className="table">
            <tbody>
              {ledger.data.ais && <tr><td>AIS</td><td>{ledger.data.ais}</td></tr>}
              <tr><td>Physics</td><td>{ledger.data.physics}; current error {meta.physics.current_error_sd_ms ?? "–"} m/s per member; diffusion {meta.physics.diffusion_m2s ?? "–"} m²/s</td></tr>
              {Object.entries(meta.forcing).map(([k2, v2]) => <tr key={k2}><td>{k2.replace(/_/g, " ")}</td><td>{v2}</td></tr>)}
              <tr><td>Thresholds</td><td className="num">plausible fit {ledger.thresholds.plausible_fit}, lead gap {ledger.thresholds.lead_gap}, lead stability {ledger.thresholds.lead_stability}, coverage {ledger.thresholds.coverage_min}, none score {ledger.thresholds.none_score}</td></tr>
              <tr><td>Nearest platform</td><td>{fmtKm(ledger.infrastructure_context.nearest_km)}</td></tr>
            </tbody>
          </table>
          <p className="note note-strong">Scores are calibrated bands, never real-world probabilities. Satellite images have been accepted as evidence in court only alongside supporting evidence.</p>
        </section>
      </article>
    </div>
  );
}

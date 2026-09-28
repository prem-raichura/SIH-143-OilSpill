// Describes whatever was picked on the case map: used for the hover tooltip (title and first rows)
// and for the identify panel (all rows).
import type { PickingInfo } from "@deck.gl/core";
import { fmtKm } from "../lib/geo";
import { fmtSignedH } from "../lib/time";
import { HULL_LABEL, hullKind, ROLE_LABEL } from "../lib/vessels";
import type { WorkspaceState } from "../store/workspace";
import type { CaseDerived } from "./useCase";

export interface PickInfo {
  title: string;
  subtitle?: string;
  rows: [string, string][];
  /** The ship this pick belongs to, if any. */
  mmsi: number | null;
  /** Camera fit that shows this feature best. */
  fit?: WorkspaceState["fitRequest"]["kind"];
}

const deg = (v: number) => `${Math.round(v)}°`;
const dirTo = (v: [number, number]) => (Math.round((Math.atan2(v[0], v[1]) * 180) / Math.PI + 360) % 360);
const dirFrom = (v: [number, number]) => (Math.round((Math.atan2(-v[0], -v[1]) * 180) / Math.PI + 360) % 360);

export function describePick(info: PickingInfo, c: CaseDerived, h: number): PickInfo | null {
  const id = info.layer?.id ?? "";
  const o = info.object as Record<string, unknown> | undefined;

  if (o && (id.startsWith("tracks") || id.startsWith("heads") || id === "gaps" || id === "reach-fill")) {
    const mmsi = (o.mmsi as number) ?? ((o.v as { mmsi: number })?.mmsi ?? null);
    const v = mmsi != null ? c.byMmsi.get(mmsi) : undefined;
    if (!v) return null;
    const st = c.trackIdx.has(v.mmsi) ? (o.st as { sog: number | null } | undefined) : undefined;
    const rows: [string, string][] = [["MMSI", String(v.mmsi)], ["Type", HULL_LABEL[hullKind(v.vesselType)]]];
    if (st?.sog != null) rows.push([`Speed at ${fmtSignedH(h)}`, `${st.sog.toFixed(1)} kn`]);
    if (id === "gaps") rows.push(["AIS gap", `${(o.gap as { hours: number }).hours.toFixed(1)} h`]);
    if (id === "reach-fill") rows.push(["Reachable area", `At 25 kn during a ${(o.hours as number).toFixed(1)} h gap`]);
    if (v.candidate) {
      rows.push(["Score", `${v.candidate.score.toFixed(2)}, ${v.candidate.band} band`]);
      rows.push(["Best-fit release", fmtSignedH(-v.candidate.best_fit_age_h)]);
    }
    rows.push(["AIS", v.synthetic ? "Synthetic" : "Real"]);
    return { title: v.name, subtitle: ROLE_LABEL[v.role], rows, mmsi: v.mmsi, fit: "selected" };
  }
  if (o && id === "cone") {
    return { title: `Forecast +${(o.properties as { hours: number }).hours} h`, subtitle: "Where the oil is expected to be (OpenOil)", rows: [], mmsi: null, fit: "drift" };
  }
  if (o && id === "isochrones") {
    return { title: fmtSignedH(-(o.age as number)), subtitle: `Where the oil was ${o.age as number} h before the image`, rows: [], mmsi: null, fit: "corridor" };
  }
  if (id === "corridor") {
    const ap = c.bundle.meta.slick.measures.age_prior_h;
    return {
      title: "Release corridor",
      subtitle: "Where and when the oil could have been released, over the age prior",
      rows: [["Age prior", `${ap.min}–${ap.max} h`]],
      mmsi: null,
      fit: "corridor",
    };
  }
  if (id === "expanded") {
    return { title: "Expanded corridor", subtitle: "Used only by the reachability veto (outer ensemble + 5 km)", rows: [], mmsi: null, fit: "corridor" };
  }
  if (id === "slick") {
    const m = c.bundle.meta.slick.measures;
    return {
      title: "Slick",
      subtitle: m.simulated ? "Simulated slick" : `Outline from ${c.bundle.meta.slick.source}`,
      rows: [
        ["Area", `${m.area_km2.toFixed(1)} km²`],
        ["Length", fmtKm(m.length_km)],
        ["Mean width", fmtKm(m.mean_width_km, 2)],
        ["Orientation", deg(m.orientation_deg)],
        ["Perimeter", fmtKm(m.perimeter_km)],
        ["Shape", m.shape_indicator],
        ["Wind at image", `${m.wind_speed_ms.toFixed(1)} m/s`],
      ],
      mmsi: null,
      fit: "slick",
    };
  }
  if (o && id === "targets") {
    const p = o.props as { peak_db: number; approx_length_m: number; platform: boolean; area_px?: number };
    return {
      title: p.platform ? "Bright point at a known platform" : "Bright point (simple CFAR)",
      subtitle: "Not validated",
      rows: [["Peak", `${p.peak_db} dB`], ["Approx. length", `${p.approx_length_m} m`], ...(p.area_px != null ? [["Area", `${p.area_px} px`] as [string, string]] : [])],
      mmsi: null,
      fit: "sar",
    };
  }
  if (o && id === "platforms") {
    const pp = (o.properties as { name?: string | null; operator?: string | null }) ?? {};
    return {
      title: pp.name || "Offshore platform",
      subtitle: "Public infrastructure layer",
      rows: pp.operator ? [["Operator", pp.operator]] : [],
      mmsi: null,
    };
  }
  if (o && id === "ports") {
    const pp = (o.properties as Record<string, string | number>) ?? {};
    const rows: [string, string][] = [];
    if (pp["Country Code"]) rows.push(["Country", String(pp["Country Code"])]);
    if (pp["Harbor Size"]) rows.push(["Harbour size", String(pp["Harbor Size"])]);
    if (pp["Harbor Type"]) rows.push(["Harbour type", String(pp["Harbor Type"])]);
    if (pp["World Port Index Number"]) rows.push(["WPI number", String(pp["World Port Index Number"])]);
    return { title: String(pp["Main Port Name"] ?? "Port"), subtitle: "World Port Index", rows, mmsi: null };
  }
  if (o && id === "release") {
    const v = c.byMmsi.get(o.mmsi as number);
    return { title: o.text as string, subtitle: `${v?.name ?? "Ship"}: where its track best fits the slick`, rows: [], mmsi: (o.mmsi as number) ?? null, fit: "corridor" };
  }
  if (o && id === "currents") {
    const v = o.v as [number, number];
    return { title: "Current", subtitle: "Ocean current (CMEMS)", rows: [["Speed", `${Math.hypot(v[0], v[1]).toFixed(2)} m/s`], ["Toward", `${dirTo(v)}°`]], mmsi: null, fit: "drift" };
  }
  if (o && id === "wind") {
    const v = o.v as [number, number];
    return { title: "Wind (ERA5)", subtitle: "10 m wind", rows: [["Speed", `${Math.hypot(v[0], v[1]).toFixed(1)} m/s`], ["From", `${dirFrom(v)}°`]], mmsi: null, fit: "drift" };
  }
  if (o && id === "observations") {
    return {
      title: (o.oilSeen as boolean) ? "Oil observed" : "Searched, none found",
      subtitle: "Forecast verification record (Drift, Goes to)",
      rows: [],
      mmsi: null,
      fit: "drift",
    };
  }
  if (id === "back-route") {
    return { title: "Backward route", subtitle: "Ensemble mean of where the oil was, hour by hour", rows: [], mmsi: null, fit: "corridor" };
  }
  if (id === "fwd-route") {
    return { title: "Forecast route", subtitle: "Mean position of the forecast oil, hour by hour", rows: [], mmsi: null, fit: "drift" };
  }
  return null;
}

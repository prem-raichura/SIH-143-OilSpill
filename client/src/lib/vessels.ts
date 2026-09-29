// Joins AIS tracks with the ledger. The ledger is the source of truth for roles.
import type { Candidate, Eliminated, Ledger, Monitoring, TrackFeature } from "../data/types";

export type Role = "leading" | "shortlist" | "screened" | "eliminated" | "background";

export const ROLE_LABEL: Record<Role, string> = {
  leading: "Leading candidate",
  shortlist: "Plausible (shortlist)",
  screened: "Screened, not supported",
  eliminated: "Eliminated by reachability",
  background: "Background traffic",
};

export const ROLE_ORDER: Role[] = ["leading", "shortlist", "screened", "eliminated", "background"];

export interface Vessel {
  mmsi: number;
  name: string;
  vesselType: number | null;
  synthetic: boolean;
  role: Role;
  track?: TrackFeature;
  candidate?: Candidate;
  candidateRank?: number;
  eliminated?: Eliminated;
  whyNot?: string;
}

export function buildVessels(ledger: Ledger, tracks: TrackFeature[], monitoring: Monitoring | null): Vessel[] {
  const v = ledger.verdict;
  const lead = v.code === 3 && v.mmsi ? v.mmsi : null;
  const shortlist = new Set<number>([
    ...(v.shortlist ?? []).map((s) => s.mmsi),
    ...(v.code === 4 ? (monitoring?.vessels ?? []).map((m) => m.mmsi) : []),
  ]);
  const cands = new Map(ledger.candidates.map((c, i) => [c.mmsi, { c, i }]));
  const elim = new Map(ledger.eliminated.map((e) => [e.mmsi, e]));
  const whyNot = new Map(ledger.why_not.map((w) => [w.mmsi, w.text]));

  const out = new Map<number, Vessel>();
  const roleOf = (mmsi: number, fileRole?: string): Role => {
    if (lead === mmsi) return "leading";
    if (shortlist.has(mmsi)) return "shortlist";
    if (cands.has(mmsi)) return "screened";
    if (elim.has(mmsi) || fileRole === "eliminated") return "eliminated";
    return "background";
  };
  for (const t of tracks) {
    const p = t.properties;
    const c = cands.get(p.mmsi);
    out.set(p.mmsi, {
      mmsi: p.mmsi,
      name: p.name && p.name !== "nan" ? p.name : `MMSI ${p.mmsi}`,
      vesselType: p.vessel_type,
      synthetic: p.synthetic,
      role: roleOf(p.mmsi, p.role),
      track: t,
      candidate: c?.c,
      candidateRank: c ? c.i + 1 : undefined,
      eliminated: elim.get(p.mmsi),
      whyNot: elim.get(p.mmsi)?.why_not ?? whyNot.get(p.mmsi),
    });
  }
  // Candidates or eliminated ships with no drawable track still belong in the lists.
  for (const [mmsi, { c, i }] of cands) {
    if (!out.has(mmsi)) {
      out.set(mmsi, {
        mmsi, name: c.name, vesselType: c.vessel_type, synthetic: c.synthetic, role: roleOf(mmsi),
        candidate: c, candidateRank: i + 1, whyNot: whyNot.get(mmsi),
      });
    }
  }
  for (const [mmsi, e] of elim) {
    if (!out.has(mmsi)) {
      out.set(mmsi, { mmsi, name: e.name, vesselType: null, synthetic: false, role: "eliminated", eliminated: e, whyNot: e.why_not });
    }
  }
  return [...out.values()].sort((a, b) => {
    const r = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    if (r) return r;
    return (b.candidate?.score ?? -99) - (a.candidate?.score ?? -99);
  });
}

export type HullKind = "tanker" | "cargo" | "passenger" | "fishing" | "tug" | "other";

export function hullKind(vesselType: number | null | undefined): HullKind {
  const t = vesselType ?? 0;
  if (t >= 80 && t <= 89) return "tanker";
  if (t >= 70 && t <= 79) return "cargo";
  if (t >= 60 && t <= 69) return "passenger";
  if (t === 30) return "fishing";
  if (t === 31 || t === 32 || t === 52) return "tug";
  return "other";
}

export const HULL_LABEL: Record<HullKind, string> = {
  tanker: "Tanker",
  cargo: "Cargo",
  passenger: "Passenger",
  fishing: "Fishing",
  tug: "Tug or tow",
  other: "Other or unknown",
};

/** Typical length in metres by hull kind (AIS length is not in the case data). */
export const HULL_LENGTH_M: Record<HullKind, number> = {
  tanker: 240,
  cargo: 190,
  passenger: 160,
  fishing: 30,
  tug: 32,
  other: 90,
};

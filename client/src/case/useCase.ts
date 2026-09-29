import { createContext, useContext, useMemo } from "react";
import type { CaseBundle } from "../data/load";
import { useDriftFrames } from "../data/load";
import type { Bounds, DriftFrames, LonLat, PolygonGeometry, Feature } from "../data/types";
import { boundsOf, geometryRings, padBounds, unionBounds } from "../lib/geo";
import { buildForcing, type ForcingField } from "../lib/forcing";
import { backwardRoute, forwardRoute, type OilRoute } from "../lib/oilroutes";
import { hoursFrom } from "../lib/time";
import { indexTrack, type TrackIndex } from "../lib/tracks";
import { deriveVerdict, type DerivedVerdict } from "../lib/verdict";
import { buildVessels, type Vessel } from "../lib/vessels";
import { useReview, type GateDecision } from "../store/review";
import { canSeeShips, useSession } from "../auth/session";

export interface CaseDerived {
  bundle: CaseBundle;
  vessels: Vessel[];
  byMmsi: Map<number, Vessel>;
  trackIdx: Map<number, TrackIndex>;
  forcing: ForcingField;
  drift: DriftFrames | undefined;
  back: OilRoute | undefined;
  fwd: OilRoute | undefined;
  gate: GateDecision | undefined;
  shipsUnlocked: boolean;
  analyst: boolean;
  closedAtVerdict1: boolean;
  verdict: DerivedVerdict;
  slickRings: LonLat[][];
  release: Feature<PolygonGeometry> | undefined;
  expanded: Feature<PolygonGeometry> | undefined;
  ages: Feature<PolygonGeometry>[];
  bounds: { sar: Bounds | null; slick: Bounds; corridor: Bounds; drift: Bounds; ships: Bounds; all: Bounds };
  range: { min: number; max: number };
  centroid: LonLat;
  simulated: boolean;
}

const EMPTY: LonLat[] = [];

function featureBounds(fs: Feature<PolygonGeometry>[]): Bounds | null {
  return boundsOf(fs.flatMap((f) => geometryRings(f.geometry).flat()));
}

export function useCaseDerived(bundle: CaseBundle | undefined): CaseDerived | undefined {
  const drift = useDriftFrames(bundle?.entry, Boolean(bundle)).data;
  const gate = useReview((s) => (bundle ? s.gate[bundle.entry.id] : undefined));
  const role = useSession((s) => s.session?.role);

  const base = useMemo(() => {
    if (!bundle) return undefined;
    const { meta, ledger, monitoring, tracks, corridor, slick, forcing: fa } = bundle;
    const vessels = buildVessels(ledger, tracks, monitoring);
    const byMmsi = new Map(vessels.map((v) => [v.mmsi, v]));
    const trackIdx = new Map<number, TrackIndex>();
    for (const t of tracks) if (t.geometry.coordinates.length >= 2) trackIdx.set(t.properties.mmsi, indexTrack(t));
    const forcing = buildForcing(fa, meta.t_image);
    const slickRings = slick.features.flatMap((f) => geometryRings(f.geometry));
    const release = corridor.features.find((f) => (f.properties as { kind: string }).kind === "release_corridor");
    const expanded = corridor.features.find((f) => (f.properties as { kind: string }).kind === "expanded_corridor_for_veto");
    const ages = corridor.features.filter((f) => (f.properties as { kind: string }).kind === "age");
    const slickB = boundsOf(slickRings.flat()) ?? [meta.centroid[0] - 0.2, meta.centroid[1] - 0.2, meta.centroid[0] + 0.2, meta.centroid[1] + 0.2];
    const corridorB = unionBounds(release ? featureBounds([release]) : null, slickB)!;
    const coneB = featureBounds(bundle.forecast.features.filter((f) => f.geometry.type !== "Point") as Feature<PolygonGeometry>[]);
    const important = vessels.filter((v) => v.role !== "background" && v.track);
    const shipsB =
      boundsOf(important.flatMap((v) => v.track!.geometry.coordinates.filter((_, i) => Math.abs(v.track!.properties.t_offset_s[i]) < 48 * 3600))) ??
      corridorB;
    const sarB = meta.satellite?.bounds ?? null;
    const window = meta.window.map((w) => hoursFrom(meta.t_image, w));
    return {
      vessels, byMmsi, trackIdx, forcing, slickRings, release, expanded, ages,
      bounds: {
        sar: sarB,
        slick: padBounds(slickB, 0.35),
        corridor: padBounds(corridorB, 0.1),
        drift: padBounds(unionBounds(corridorB, coneB)!, 0.08),
        ships: padBounds(unionBounds(shipsB, corridorB)!, 0.05),
        all: padBounds(unionBounds(shipsB, corridorB, coneB, sarB)!, 0.05),
      },
      range: { min: Math.max(-72, window[0]), max: Math.min(72, window[1]) },
      centroid: meta.slick.measures.centroid,
      simulated: Boolean(meta.slick.measures.simulated) || !meta.satellite,
    };
  }, [bundle]);

  const routes = useMemo(() => {
    if (!drift) return { back: undefined, fwd: undefined };
    return {
      back: backwardRoute(drift.backward.frames, bundle?.meta.physics.backward_members ?? 10),
      fwd: forwardRoute(drift.forward.frames),
    };
  }, [drift, bundle]);

  return useMemo(() => {
    if (!bundle || !base) return undefined;
    const label = gate?.label ?? null;
    const verdict = deriveVerdict(bundle.ledger, bundle.meta, label);
    return {
      bundle,
      ...base,
      drift,
      back: routes.back,
      fwd: routes.fwd,
      gate,
      // Analysts review oil only: they never see candidate ships (bias control).
      shipsUnlocked: Boolean(gate) && gate!.label !== "lookalike" && canSeeShips(role),
      analyst: !canSeeShips(role),
      closedAtVerdict1: gate?.label === "lookalike",
      verdict,
      slickRings: base.slickRings.length ? base.slickRings : [EMPTY],
    };
  }, [bundle, base, drift, routes, gate, role]);
}

export const CaseCtx = createContext<CaseDerived | null>(null);

export function useCase(): CaseDerived {
  const c = useContext(CaseCtx);
  if (!c) throw new Error("useCase must be used inside a case page");
  return c;
}

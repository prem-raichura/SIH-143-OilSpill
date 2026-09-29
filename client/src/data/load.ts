import { useEffect, useState } from "react";
import type {
  Benchmark, CaseIndexEntry, CasesIndex, DriftFrames, FeatureCollection, ForcingArrows, Gallery, Ledger,
  Meta, Monitoring, PolygonGeometry, TrackFeature,
} from "./types";

export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

const cache = new Map<string, Promise<unknown>>();
const settled = new Map<string, unknown>();

export class DataError extends Error {
  constructor(public path: string, message: string) {
    super(message);
  }
}

export function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(dataUrl(path))
      .then(async (r) => {
        if (!r.ok) throw new DataError(path, `Couldn't load data/${path} (HTTP ${r.status}). Check the file exists, then reload.`);
        return (await r.json()) as T;
      })
      .then((v) => {
        settled.set(path, v);
        return v;
      });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/** Fetch JSON (cached). Pass null to skip. */
export function useJson<T>(path: string | null): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>(() => ({
    data: path ? (settled.get(path) as T | undefined) : undefined,
    error: undefined,
    loading: Boolean(path && !settled.has(path)),
  }));
  useEffect(() => {
    if (!path) {
      setState({ data: undefined, error: undefined, loading: false });
      return;
    }
    if (settled.has(path)) {
      setState({ data: settled.get(path) as T, error: undefined, loading: false });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fetchJson<T>(path).then(
      (data) => live && setState({ data, error: undefined, loading: false }),
      (error: Error) => live && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return state;
}

export const useCasesIndex = () => useJson<CasesIndex>("cases.json");
export const useBenchmark = () => useJson<Benchmark>("shared/benchmark.json");
export const useGallery = () => useJson<Gallery>("shared/gallery/gallery.json");

export type LandFC = FeatureCollection<PolygonGeometry, Record<string, unknown>>;

/** Coastline polygons only (for static charts that do not need the other shared layers). */
export const useLand = (region: "india" | "gulf_of_mexico" | null) => useJson<LandFC>(region ? `shared/land_${region}.geojson` : null).data;

export function useShared(region: "india" | "gulf_of_mexico" | null) {
  const land = useJson<LandFC>(region ? `shared/land_${region}.geojson` : null);
  const eez = useJson<LandFC>("shared/eez.geojson");
  const ports = useJson<FeatureCollection>("shared/ports.geojson");
  const platforms = useJson<FeatureCollection>("shared/platforms.geojson");
  return { land: land.data, eez: eez.data, ports: ports.data, platforms: platforms.data };
}

export interface CaseBundle {
  entry: CaseIndexEntry;
  meta: Meta;
  ledger: Ledger;
  monitoring: Monitoring;
  slick: FeatureCollection<PolygonGeometry>;
  corridor: FeatureCollection<PolygonGeometry>;
  forecast: FeatureCollection;
  tracks: TrackFeature[];
  targets: FeatureCollection | null;
  forcing: ForcingArrows;
}

const bundles = new Map<string, Promise<CaseBundle>>();

export function loadCase(entry: CaseIndexEntry): Promise<CaseBundle> {
  let p = bundles.get(entry.id);
  if (!p) {
    const base = entry.path;
    p = Promise.all([
      fetchJson<Meta>(`${base}meta.json`),
      fetchJson<Ledger>(`${base}ledger.json`),
      fetchJson<Monitoring>(`${base}monitoring.json`),
      fetchJson<FeatureCollection<PolygonGeometry>>(`${base}slick.geojson`),
      fetchJson<FeatureCollection<PolygonGeometry>>(`${base}corridor.geojson`),
      fetchJson<FeatureCollection>(`${base}forecast.geojson`),
      fetchJson<FeatureCollection>(`${base}ais_tracks.geojson`),
      entry.has_sar_image ? fetchJson<FeatureCollection>(`${base}sar_targets.geojson`) : Promise.resolve(null),
      fetchJson<ForcingArrows>(`${base}forcing_arrows.json`),
    ]).then(([meta, ledger, monitoring, slick, corridor, forecast, tracks, targets, forcing]) => ({
      entry, meta, ledger, monitoring, slick, corridor, forecast,
      tracks: tracks.features as unknown as TrackFeature[],
      targets, forcing,
    }));
    p.catch(() => bundles.delete(entry.id));
    bundles.set(entry.id, p);
  }
  return p;
}

export function useCaseBundle(caseId: string | undefined): AsyncState<CaseBundle> {
  const index = useCasesIndex();
  const [state, setState] = useState<AsyncState<CaseBundle>>({ data: undefined, error: undefined, loading: true });
  useEffect(() => {
    if (!index.data || !caseId) return;
    const entry = index.data.cases.find((c) => c.id === caseId);
    if (!entry) {
      setState({ data: undefined, error: new Error(`No case called ${caseId}. Pick one from the case list.`), loading: false });
      return;
    }
    let live = true;
    setState({ data: undefined, error: undefined, loading: true });
    loadCase(entry).then(
      (data) => live && setState({ data, error: undefined, loading: false }),
      (error: Error) => live && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      live = false;
    };
  }, [index.data, caseId]);
  if (index.error) return { data: undefined, error: index.error, loading: false };
  return state;
}

export const useDriftFrames = (entry: CaseIndexEntry | undefined, enabled = true) =>
  useJson<DriftFrames>(entry && enabled ? `${entry.path}drift_frames.json` : null);

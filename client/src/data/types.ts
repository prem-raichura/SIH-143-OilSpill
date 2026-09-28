// Types mirroring "static data/README.md". Coordinates are [lon, lat] WGS84, times UTC ISO 8601.

export type LonLat = [number, number];
export type Bounds = [number, number, number, number]; // west, south, east, north

export interface Feature<G = Geometry, P = Record<string, unknown>> {
  type: "Feature";
  geometry: G;
  properties: P;
}
export interface FeatureCollection<G = Geometry, P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
  properties?: Record<string, unknown>;
}
export type Geometry =
  | { type: "Point"; coordinates: LonLat }
  | { type: "LineString"; coordinates: LonLat[] }
  | { type: "Polygon"; coordinates: LonLat[][] }
  | { type: "MultiPolygon"; coordinates: LonLat[][][] }
  | { type: "MultiLineString"; coordinates: LonLat[][] };
export type PolygonGeometry = Extract<Geometry, { type: "Polygon" | "MultiPolygon" }>;

export type VerdictCode = 1 | 2 | 3 | 4 | 5;

export interface ShortlistEntry {
  mmsi: number;
  name: string;
  score: number;
  rank1_share: number;
}

export interface Verdict {
  code: VerdictCode;
  label: string;
  name?: string | null;
  mmsi?: number | null;
  probable_source?: string | null;
  sar_only?: boolean;
  score_gap?: number;
  rank_stability?: number;
  best_fit_release_time?: string;
  shortlist?: ShortlistEntry[];
  reason?: string;
  what_would_help?: string[];
}

export interface CaseIndexEntry {
  id: string;
  kind: string;
  note: string;
  t_image: string;
  region: "india" | "gulf_of_mexico";
  centroid: LonLat;
  labels: string[];
  verdict: { code: VerdictCode; label: string; name: string | null; mmsi: number | null; probable_source: string | null };
  has_sar_image: boolean;
  path: string;
}

export interface CasesIndex {
  cases: CaseIndexEntry[];
  shared: string[];
  gallery: string;
  benchmark: string;
}

export interface AgePrior {
  min: number;
  max: number;
  label: string;
  spreading_min_h?: number;
}

export interface SlickMeasures {
  area_km2: number;
  perimeter_km: number;
  length_km: number;
  mean_width_km: number;
  elongation: number;
  compactness: number;
  components: number;
  orientation_deg: number;
  centroid: LonLat;
  taper: string;
  end_width_ratio?: number;
  fresh_end_bearing_deg?: number;
  edge_truncated: boolean;
  wind_speed_ms: number;
  wind_reliability: number;
  age_prior_h: AgePrior;
  shape_indicator: string;
  cerulean_slick_id?: number;
  cerulean_machine_confidence?: number;
  cerulean_class?: number;
  s1_scene_id?: string;
  simulated?: boolean;
  source?: string;
}

export interface Physics {
  formula: string;
  current_source: string;
  stokes_source?: string;
  wind_source: string;
  alpha: number;
  alpha_range: [number, number];
  current_scale_sd?: number;
  wind_rotation_sd_deg?: number;
  current_error_sd_ms?: number;
  diffusion_m2s?: number;
  time_step_s: number;
  backward_members: number;
  backward_particles: number;
  forward_members: number;
  max_age_h: number;
  tides_missing?: boolean;
}

export interface Meta {
  id: string;
  kind: string;
  note: string;
  t_image: string;
  window: [string, string];
  bbox: Bounds;
  centroid: LonLat;
  region: "india" | "gulf_of_mexico";
  slick: { source: string; measures: SlickMeasures };
  satellite: {
    product_id: string;
    acquisition_start: string;
    acquisition_end: string;
    polarisation: string;
    calibration: string;
    quicklook: string;
    bounds: Bounds;
    stretch_db: [number, number];
    sar_targets: string;
    n_sar_targets: number;
  } | null;
  ais: string;
  forcing: Record<string, string>;
  physics: Physics;
  forecast: {
    model: string;
    oil_type: string;
    hours: number;
    coastal_impact: boolean;
    stranded_elements: number;
  };
  verdict: Verdict;
  human_gate: string;
  scenario_key_available?: boolean;
  labels: string[];
  reproduce: string;
}

export interface EvidenceItem {
  key: string;
  value: number;
  weight: number;
  reliability: number;
  contribution: number;
  text: string;
}

export interface Reachability {
  reachable: boolean;
  closest_margin_km: number;
  closest_age_h: number;
  closest_dist_km: number;
  continuous: boolean;
  max_gap_h: number;
  spoofing: boolean;
  flags: { impossible_jumps: number };
}

export interface Candidate {
  mmsi: number;
  name: string;
  vessel_type: number | null;
  synthetic: boolean;
  score: number;
  fit: number;
  best_fit_release_time: string;
  best_fit_age_h: number;
  best_fit_position: LonLat;
  screening: { d_km: number; sigma_km: number; log_likelihood: number; fit: number };
  confirmation: {
    fss: number;
    fss_members: number[];
    centroid_km: number;
    centroid_over_sigma: number;
    orientation_diff_deg: number | null;
    fit: number;
    fit_members: number[];
    scales_km: number[];
    release_window: [string, string];
    particles: number;
  } | null;
  shape: {
    length: string;
    direction: string;
    length_covered_fraction?: number;
    direction_diff_deg?: number;
    spoofing: boolean;
  };
  reachability: Reachability;
  sar: { status: string; radius_km: number } | null;
  items: EvidenceItem[];
  rank1_share: number;
  band: "High" | "Medium" | "Low";
  relative_support: number;
}

export interface Eliminated extends Reachability {
  mmsi: number;
  name: string;
  why_not: string;
}

export interface ScenarioKey {
  source_mmsi: number | null;
  source_in_ais: boolean;
  expected_verdict: string;
  release_time: string | null;
  physics: string | null;
  injection: string | null;
  label: string;
  outcome: string;
}

export interface Ledger {
  case_id: string;
  t_image: string;
  verdict: Verdict;
  disclaimer: string;
  ais_coverage: { score: number; vessels_used: number; threshold: number };
  none_option_support: number;
  thresholds: {
    plausible_fit: number;
    plausible_score: number;
    lead_gap: number;
    lead_stability: number;
    coverage_min: number;
    none_score: number;
  };
  weights: Record<string, number>;
  candidates: Candidate[];
  eliminated: Eliminated[];
  sar_targets_context_only: { lonlat: LonLat; d_slick_km: number }[];
  infrastructure_context: {
    platforms_within_km: number;
    count: number;
    nearest_km: number;
    platforms: { lonlat: LonLat; d_km: number }[];
    note: string;
  };
  counts: {
    vessels_in_window: number;
    eliminated: number;
    screened: number;
    confirmed: number;
    sar_only_targets: number;
  };
  why_not: { mmsi: number; name: string; score: number; text: string }[];
  scenario_key?: ScenarioKey | null;
  data: { ais: string; physics: string; human_gate: string };
  candidates_summary: { mmsi: number; name: string; score: number; fit: number; band: string; best_fit_age_h: number }[];
  candidates_not_listed: number;
  eliminated_total: number;
}

export interface MonitoringEvent {
  t: string;
  type: string;
  text: string;
  derived?: boolean;
}

export interface Monitoring {
  note: string;
  vessels: { mmsi: number; fixes: number; window: [string, string]; events: MonitoringEvent[] }[];
}

export interface DriftFrames {
  t_image: string;
  step_h: number;
  backward: { note: string; frames: LonLat[][] };
  forward: { note: string; frames: (LonLat | null)[][] };
}

export interface ForcingArrows {
  grid: LonLat[];
  units: string;
  current: string;
  wind: string;
  frames: { t: string; cur: [number, number][]; wind: [number, number][] }[];
}

export type TrackRoleInFile = "leading" | "candidate" | "eliminated" | "background";

export interface TrackProps {
  mmsi: number;
  name: string;
  role: TrackRoleInFile;
  vessel_type: number | null;
  synthetic: boolean;
  t_offset_s: number[];
  sog: (number | null)[];
}

export type TrackFeature = Feature<{ type: "LineString"; coordinates: LonLat[] }, TrackProps>;

export interface ForecastProps {
  kind: "forecast_envelope" | "stranded" | string;
  hours?: number;
  active_fraction?: number;
}

export interface CorridorProps {
  kind: "age" | "release_corridor" | "expanded_corridor_for_veto";
  age_h?: number;
  in_age_prior?: boolean;
  age_prior_h?: AgePrior;
  margin_km?: number;
}

export interface SarTargetProps {
  peak_db: number;
  area_px: number;
  approx_length_m: number;
  platform: boolean;
}

export interface SlickProps extends Partial<SlickMeasures> {
  [k: string]: unknown;
}

export interface MassBudget {
  mass_oil: number[];
  mass_evaporated: number[];
  mass_dispersed: number[];
}

export interface GalleryItem {
  id: string;
  class: "oil" | "lookalike" | "clean";
  source_file: string;
  oil_fraction: number;
  stretch_db: [number, number];
  bounds_wgs84: Bounds;
  image: string;
  mask: string;
}

export interface Gallery {
  source: string;
  display: string;
  items: GalleryItem[];
}

type CI = [number, number];
export interface BenchmarkSetA {
  n: number;
  top1: [number, CI];
  top3: [number, CI];
  coverage_verdict3: [number, CI];
  leading_candidate_precision: [number, number, CI];
  verdicts: Record<string, number>;
  source_wrongly_eliminated: number;
}
export interface BenchmarkSetB {
  n: number;
  wrongful_naming: [number, CI];
  correct_refusal: [number, CI];
  verdicts: Record<string, number>;
  vessel_without_ais_rate: [number, CI];
}
export interface Benchmark {
  label: string;
  design: Record<string, unknown> & { scenarios_per_set: number; target_wrongful_naming: number };
  thresholds: Ledger["thresholds"];
  tuning: { set_A: BenchmarkSetA; set_B: BenchmarkSetB };
  held_out: { set_A: BenchmarkSetA; set_B: BenchmarkSetB };
  comparison_methods_held_out: Record<
    string,
    {
      label: string;
      set_A_named: [number, number];
      set_A_correct: [number, CI];
      set_A_precision: [number, number, CI];
      set_B_wrongful_naming: [number, CI];
    }
  >;
  tradeoff_curve_held_out: { lead_gap: number; wrongful_naming: number; coverage: number; precision: number | null }[];
  errors: number;
}

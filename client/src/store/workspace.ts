import { create } from "zustand";
import { useClock } from "./clock";

export type Step = "image" | "oil" | "slick" | "drift" | "ships" | "evidence" | "verdict" | "followup";
export const STEPS: { id: Step; label: string; locked: boolean }[] = [
  { id: "image", label: "Image", locked: false },
  { id: "oil", label: "Oil check", locked: false },
  { id: "slick", label: "Slick", locked: false },
  { id: "drift", label: "Drift", locked: false },
  { id: "ships", label: "Ships", locked: true },
  { id: "evidence", label: "Evidence", locked: true },
  { id: "verdict", label: "Verdict", locked: true },
  { id: "followup", label: "Follow-up", locked: true },
];

export type View = "map" | "scene" | "cube";

export type LayerId =
  | "sar" | "targets"
  | "slick" | "measures"
  | "backParticles" | "backRoute" | "isochrones" | "corridor" | "expanded"
  | "fwdParticles" | "fwdRoute" | "cone"
  | "tracks" | "tracksElim" | "tracksBg" | "heads" | "gaps" | "reach" | "release" | "driftCorrected"
  | "currents" | "wind"
  | "eez" | "graticule" | "ports" | "platforms";

export interface LayerDef {
  id: LayerId;
  label: string;
  group: "Image" | "Oil" | "Where it came from" | "Where it goes" | "Ships" | "Ocean and wind" | "Reference";
  swatch: "sar" | "targets" | "slick" | "measure" | "past-dot" | "past-line" | "past-iso" | "past-hatch" | "past-dash"
    | "future-dot" | "future-line" | "future-cone" | "ship-line" | "ship-elim" | "ship-bg" | "ship-head" | "gap" | "reach"
    | "release" | "drifted" | "current" | "wind" | "eez" | "grid" | "port" | "platform";
  ships?: boolean; // hidden until the oil check is answered
}

export const LAYERS: LayerDef[] = [
  { id: "sar", label: "Sentinel-1 image", group: "Image", swatch: "sar" },
  { id: "targets", label: "Bright points (CFAR)", group: "Image", swatch: "targets" },
  { id: "slick", label: "Slick outline", group: "Oil", swatch: "slick" },
  { id: "measures", label: "Measurements", group: "Oil", swatch: "measure" },
  { id: "backParticles", label: "Backward particles", group: "Where it came from", swatch: "past-dot" },
  { id: "backRoute", label: "Backward route and ensemble", group: "Where it came from", swatch: "past-line" },
  { id: "isochrones", label: "Hours before image", group: "Where it came from", swatch: "past-iso" },
  { id: "corridor", label: "Release corridor", group: "Where it came from", swatch: "past-hatch" },
  { id: "expanded", label: "Expanded corridor (veto only)", group: "Where it came from", swatch: "past-dash" },
  { id: "fwdParticles", label: "Forecast particles", group: "Where it goes", swatch: "future-dot" },
  { id: "fwdRoute", label: "Forecast route", group: "Where it goes", swatch: "future-line" },
  { id: "cone", label: "Forecast cone 24, 48, 72 h", group: "Where it goes", swatch: "future-cone" },
  { id: "tracks", label: "Candidate routes", group: "Ships", swatch: "ship-line", ships: true },
  { id: "tracksElim", label: "Eliminated routes", group: "Ships", swatch: "ship-elim", ships: true },
  { id: "tracksBg", label: "Background traffic", group: "Ships", swatch: "ship-bg", ships: true },
  { id: "heads", label: "Ships at current time", group: "Ships", swatch: "ship-head", ships: true },
  { id: "gaps", label: "AIS gaps", group: "Ships", swatch: "gap", ships: true },
  { id: "reach", label: "Reachable area in gaps (25 kn)", group: "Ships", swatch: "reach", ships: true },
  { id: "release", label: "Best-fit release points", group: "Ships", swatch: "release", ships: true },
  { id: "driftCorrected", label: "Drift-corrected track", group: "Ships", swatch: "drifted", ships: true },
  { id: "currents", label: "Currents", group: "Ocean and wind", swatch: "current" },
  { id: "wind", label: "Wind (barbs)", group: "Ocean and wind", swatch: "wind" },
  { id: "eez", label: "EEZ boundary", group: "Reference", swatch: "eez" },
  { id: "graticule", label: "Graticule", group: "Reference", swatch: "grid" },
  { id: "ports", label: "Ports", group: "Reference", swatch: "port" },
  { id: "platforms", label: "Offshore platforms", group: "Reference", swatch: "platform" },
];

type LayerSet = Partial<Record<LayerId, boolean>>;
const base: LayerSet = { slick: true, eez: true, graticule: false, ports: true, platforms: false };

/** Which camera fit shows a layer best ("zoom to layer"). */
export const LAYER_FIT: Partial<Record<LayerId, WorkspaceState["fitRequest"]["kind"]>> = {
  sar: "sar", targets: "sar", slick: "slick", measures: "slick",
  backParticles: "corridor", backRoute: "corridor", isochrones: "corridor", corridor: "corridor", expanded: "corridor",
  fwdParticles: "drift", fwdRoute: "drift", cone: "drift",
  tracks: "ships", tracksElim: "ships", tracksBg: "ships", heads: "ships", gaps: "ships", reach: "ships", release: "corridor", driftCorrected: "selected",
  currents: "drift", wind: "drift",
};

export const PRESETS: Record<Step, LayerSet> = {
  image: { ...base, sar: true },
  oil: { ...base, sar: true, ports: false },
  slick: { ...base, sar: true, measures: true },
  drift: { ...base, backParticles: true, backRoute: true, isochrones: true, corridor: true, fwdParticles: true, fwdRoute: true, cone: true, currents: true },
  ships: { ...base, corridor: true, expanded: true, tracks: true, tracksElim: true, tracksBg: true, heads: true, gaps: true, reach: true, platforms: true },
  evidence: { ...base, corridor: true, tracks: true, heads: true, gaps: true, release: true, driftCorrected: true, backRoute: true },
  verdict: { ...base, corridor: true, tracks: true, heads: true, release: true, cone: true },
  followup: { ...base, corridor: true, tracks: true, heads: true, gaps: true },
};

export const SAR_OPACITY: Partial<Record<Step, number>> = { slick: 0.55 };

export interface WorkspaceState {
  caseId: string | null;
  step: Step;
  view: View;
  layers: Record<LayerId, boolean>;
  sarOpacity: number;
  /** Per-layer opacity multipliers set from the layers panel (1 when absent). */
  opacity: Partial<Record<LayerId, number>>;
  selectedMmsi: number | null;
  hoverMmsi: number | null;
  driftTab: "back" | "fwd" | "forcing";
  onlyShortlist: boolean;
  colorBySpeed: boolean;
  /** Layers the user explicitly toggled. These stick across steps; step presets only fill in the rest. */
  touched: Partial<Record<LayerId, boolean>>;
  followWindowH: number;
  tilt: boolean;
  decimalCoords: boolean;
  fitRequest: { kind: "slick" | "corridor" | "ships" | "selected" | "sar" | "drift" | "bbox"; n: number };
  playedDrift: Record<string, boolean>;
  /** Layer drawer over the left of the map (closed by default). */
  railOpen: boolean;
  /** Step details panel over the right of the map (a bottom sheet on narrow screens). */
  panelOpen: boolean;
  enterCase: (caseId: string) => void;
  setStep: (s: Step) => void;
  setView: (v: View) => void;
  toggleLayer: (id: LayerId, on?: boolean, touch?: boolean) => void;
  resetLayers: () => void;
  setSarOpacity: (o: number) => void;
  setOpacity: (id: LayerId, o: number) => void;
  select: (mmsi: number | null) => void;
  hover: (mmsi: number | null) => void;
  setDriftTab: (t: WorkspaceState["driftTab"]) => void;
  set: (p: Partial<WorkspaceState>) => void;
  requestFit: (kind: WorkspaceState["fitRequest"]["kind"]) => void;
  /** Re-frame the map on what the current step is about. */
  refit: () => void;
}

const allOff = Object.fromEntries(LAYERS.map((l) => [l.id, false])) as Record<LayerId, boolean>;
const layersFor = (step: Step) => ({ ...allOff, ...PRESETS[step] });

const STEP_TIME: Partial<Record<Step, number>> = { image: 0, oil: 0, slick: 0, ships: 0, verdict: 0, followup: 0 };

const FIT_FOR: Record<Step, WorkspaceState["fitRequest"]["kind"]> = {
  image: "sar", oil: "slick", slick: "slick", drift: "drift", ships: "ships", evidence: "selected", verdict: "corridor", followup: "ships",
};

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  caseId: null,
  step: "image",
  view: "map",
  layers: layersFor("image"),
  sarOpacity: 0.9,
  opacity: {},
  selectedMmsi: null,
  hoverMmsi: null,
  driftTab: "back",
  onlyShortlist: false,
  colorBySpeed: false,
  touched: {},
  followWindowH: 24,
  tilt: false,
  decimalCoords: false,
  fitRequest: { kind: "sar", n: 0 },
  playedDrift: {},
  railOpen: false,
  // Wide screens open the step panel beside the map; narrow screens start with the map and a collapsed sheet.
  panelOpen: typeof window === "undefined" || !window.matchMedia?.("(max-width: 1023px)").matches,
  enterCase: (caseId) => {
    if (get().caseId === caseId) return;
    set({
      caseId, step: "image", view: "map", layers: layersFor("image"), sarOpacity: 0.9, selectedMmsi: null, hoverMmsi: null,
      driftTab: "back", touched: {}, fitRequest: { kind: "sar", n: get().fitRequest.n + 1 },
    });
  },
  setStep: (step) => {
    // Each step opens at the moment that matters for it; stop any running playback first.
    useClock.getState().pause();
    const t = STEP_TIME[step];
    if (t != null) useClock.getState().setH(t);
    else if (step === "evidence") {
      /* the Evidence panel moves the clock to the selected ship's best-fit release */
    }
    set((s) => ({
      step,
      // Evidence opens in the 3D scene (the ship's hypothesis on the sea); leaving it goes back to the map.
      view: step === "evidence" ? "scene" : s.step === "evidence" && s.view === "scene" ? "map" : s.view,
      // Step presets fill in layers the user never touched; explicit user picks stick across steps.
      layers: { ...layersFor(step), ...s.touched },
      sarOpacity: SAR_OPACITY[step] ?? 0.9,
      fitRequest: { kind: FIT_FOR[step], n: s.fitRequest.n + 1 },
    }));
  },
  setView: (view) => set({ view }),
  toggleLayer: (id, on, touch = true) => set((s) => {
    const value = on ?? !s.layers[id];
    return { layers: { ...s.layers, [id]: value }, touched: touch ? { ...s.touched, [id]: value } : s.touched };
  }),
  resetLayers: () => set((s) => ({ layers: layersFor(s.step), opacity: {}, touched: {} })),
  setSarOpacity: (sarOpacity) => set({ sarOpacity }),
  setOpacity: (id, o) => set((s) => ({ opacity: { ...s.opacity, [id]: o } })),
  select: (selectedMmsi) => set({ selectedMmsi }),
  hover: (hoverMmsi) => (get().hoverMmsi === hoverMmsi ? undefined : set({ hoverMmsi })),
  setDriftTab: (driftTab) => set({ driftTab }),
  set: (p) => set(p),
  requestFit: (kind) => set((s) => ({ fitRequest: { kind, n: s.fitRequest.n + 1 } })),
  refit: () => set((s) => ({ fitRequest: { kind: FIT_FOR[s.step], n: s.fitRequest.n + 1 } })),
}));

// Human-in-the-loop records, persisted in IndexedDB. Export/import as JSON.
import { get as idbGet, set as idbSet } from "idb-keyval";
import { create } from "zustand";
import type { GateLabel } from "../lib/verdict";
import { useSession } from "../auth/session";

export interface GateDecision {
  caseId: string;
  label: GateLabel;
  reason: string;
  note: string;
  at: string;
  blind: boolean;
  sawMaskFirst: boolean;
}

export interface CaseReview {
  caseId: string;
  decision: "accept" | "dispute";
  note: string;
  at: string;
}

export type HumanLabel = "CONFIRMED_OIL" | "FALSE_POSITIVE" | "LOOKALIKE" | "UNCERTAIN" | "CORRECTED_MASK";

/** Feedback record for model retraining, plus where it came from. */
export interface FeedbackRecord {
  feedback_id: string;
  incident_id: string | null;
  image_id: string;
  ai_prediction: "oil" | "lookalike" | "clean";
  ai_confidence: number | null;
  human_label: HumanLabel;
  corrected_mask: string | null;
  reason: string;
  notes: string;
  reviewer_role: string;
  reviewer_saw_ai_mask: boolean;
  blind_review: boolean;
  model_version: string;
  timestamp: string;
  dataset_version: string;
  source: "case" | "test_set";
  test_set_label?: string;
}

export interface Sighting {
  id: string;
  caseId: string;
  linkedId: string;
  observedAt: string;
  where: string;
  note: string;
  at: string;
}

/** Forecast verification record: what an operator observed, not a yes/no judgement. */
export interface ForecastObservation {
  id: string;
  caseId: string;
  source: "satellite" | "aircraft" | "vessel" | "shoreline";
  observedAt: string; // ISO UTC
  lonlat: [number, number];
  oilSeen: boolean;
  searchedRadiusKm: number;
  note: string;
  synthetic: boolean;
  at: string;
}

interface Persisted {
  gate: Record<string, GateDecision>;
  reviews: Record<string, CaseReview>;
  feedback: FeedbackRecord[];
  sightings: Sighting[];
  observations: ForecastObservation[];
  reviewerRole: string;
  blindMode: boolean;
}

interface ReviewState extends Persisted {
  hydrated: boolean;
  setGate: (d: GateDecision) => void;
  clearGate: (caseId: string) => void;
  setReview: (r: CaseReview) => void;
  addFeedback: (r: Omit<FeedbackRecord, "feedback_id" | "timestamp" | "dataset_version" | "model_version" | "reviewer_role">) => void;
  addSighting: (s: Omit<Sighting, "id" | "linkedId" | "at">) => Sighting;
  addObservation: (o: Omit<ForecastObservation, "id" | "at">) => void;
  removeObservation: (id: string) => void;
  setBlindMode: (b: boolean) => void;
  setReviewerRole: (r: string) => void;
  importAll: (p: Partial<Persisted>) => void;
  clearAll: () => void;
}

const KEY = "oilspill.review.v1";
const empty: Persisted = { gate: {}, reviews: {}, feedback: [], sightings: [], observations: [], reviewerRole: "analyst", blindMode: false };

export const MODEL_VERSION = "detector-1.0";
export const DATASET_VERSION = "feedback-v1";

export const useReview = create<ReviewState>((set, get) => ({
  ...empty,
  hydrated: false,
  setGate: (d) => set((s) => ({ gate: { ...s.gate, [d.caseId]: d } })),
  clearGate: (caseId) =>
    set((s) => {
      const gate = { ...s.gate };
      delete gate[caseId];
      return { gate };
    }),
  setReview: (r) => set((s) => ({ reviews: { ...s.reviews, [r.caseId]: r } })),
  addFeedback: (r) =>
    set((s) => ({
      feedback: [
        ...s.feedback,
        {
          ...r,
          feedback_id: `FB-${String(s.feedback.length + 1).padStart(6, "0")}`,
          timestamp: new Date().toISOString(),
          dataset_version: DATASET_VERSION,
          model_version: MODEL_VERSION,
          reviewer_role: useSession.getState().session?.role ?? s.reviewerRole,
        },
      ],
    })),
  addSighting: (x) => {
    const n = get().sightings.filter((s) => s.caseId === x.caseId).length + 1;
    const s: Sighting = { ...x, id: `S-${Date.now()}`, linkedId: `${x.caseId}-L${n}`, at: new Date().toISOString() };
    set((st) => ({ sightings: [...st.sightings, s] }));
    return s;
  },
  addObservation: (o) => set((st) => ({ observations: [...st.observations, { ...o, id: `O-${Date.now()}`, at: new Date().toISOString() }] })),
  removeObservation: (id) => set((st) => ({ observations: st.observations.filter((o) => o.id !== id) })),
  setBlindMode: (blindMode) => set({ blindMode }),
  setReviewerRole: (reviewerRole) => set({ reviewerRole }),
  importAll: (p) => set({ ...empty, ...p }),
  clearAll: () => set({ ...empty }),
}));

// Hydrate once, then persist every change. IndexedDB can be unavailable (private mode): the app still works.
idbGet<Persisted>(KEY)
  .then((saved) => useReview.setState({ ...(saved ?? {}), observations: (saved?.observations ?? []).filter((o) => !o.synthetic), hydrated: true }))
  .catch(() => useReview.setState({ hydrated: true }));

useReview.subscribe((s) => {
  if (!s.hydrated) return;
  const { gate, reviews, feedback, sightings, observations, reviewerRole, blindMode } = s;
  idbSet(KEY, { gate, reviews, feedback, sightings, observations, reviewerRole, blindMode }).catch(() => undefined);
});

export function exportJson(): string {
  const { gate, reviews, feedback, sightings, observations, reviewerRole, blindMode } = useReview.getState();
  return JSON.stringify({ exported_at: new Date().toISOString(), gate, reviews, feedback, sightings, observations, reviewerRole, blindMode }, null, 2);
}

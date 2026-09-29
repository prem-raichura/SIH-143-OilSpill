// Guided tour: a scripted walk through one investigation, from the satellite pass to the verdict.
// It moves between pages and steps, but never makes a human decision for the user.
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { create } from "zustand";
import { useReview } from "../store/review";
import { useWorkspace, type View } from "../store/workspace";

interface Stop {
  route: string;
  title: string;
  text: string;
  view?: View;
  /** The user must answer the oil check for this case before moving on. */
  needsGate?: string;
}

const STOPS: Stop[] = [
  { route: "/app", title: "Satellite passes arrive", text: "Each Sentinel-1 pass is ingested and scanned for slicks automatically. The pipeline then stops and waits for a person at the oil check." },
  { route: "/app/case/AS-04?step=image", title: "The case", text: "Sentinel-1 radar off Kerala. Oil calms the sea surface, so the 46 km slick shows up as a dark streak. The outline comes from the detector." },
  { route: "/app/case/AS-04?step=oil", title: "A person checks the oil first", text: "Ships and scores stay hidden until someone decides: oil, look-alike or not sure. That keeps the review free of any suspect. Click Confirm oil to continue.", needsGate: "AS-04" },
  { route: "/app/case/AS-04?step=slick", title: "Measure the slick", text: "Area, length, shape and a deliberately weak age prior of 2 to 48 hours. The age sets how far back the drift and the ship search reach." },
  { route: "/app/case/AS-04?step=drift", title: "Trace it back, forecast it forward", text: "Ten ensemble members run the oil backward through currents, tides, waves and wind into the hatched release corridor. The amber cone shows where it goes next." },
  { route: "/app/case/AS-04?step=ships", title: "Every nearby ship", text: "Only physical impossibility removes a ship: continuous AIS that could not reach the corridor even at 25 knots. Everything else is weighed as evidence." },
  { route: "/app/case/AS-04?step=evidence", title: "Why this ship", text: "The ship's past positions, moved with the same ocean and wind to the image time, land on the slick. The ledger shows every item for and against, weighted by data quality." },
  { route: "/app/case/AS-04?step=evidence", view: "scene", title: "See the hypothesis", text: "The same case in 3D: the ship on its real track at the best-fit release time, the oil on a wind-driven sea. Labelled as a hypothesis, never as evidence. Try Radar look." },
  { route: "/app/case/AS-04?step=evidence", view: "cube", title: "Space and time together", text: "Time runs upward. The leading ship's track passes through the oil's past positions at the same moment: consistent with releasing it." },
  { route: "/app/case/AS-04?step=verdict", title: "One verdict, checked in order", text: "Five verdicts, first match wins. A ship is named only when it clearly beats the runner-up and stays first in the perturbed runs." },
  { route: "/app/case/IN-E1?step=oil", title: "When the answer is no", text: "A real slick off Kerala near the MSC Elsa 3 wreck. Confirm oil to see what the system says when no AIS ship fits.", needsGate: "IN-E1" },
  { route: "/app/case/IN-E1?step=verdict", title: "A measured refusal", text: "No consistent AIS vessel. Coverage was adequate, so the system says so, instead of naming the nearest ship." },
  { route: "/app/benchmark", title: "Measured, not claimed", text: "On 100 held-out test scenarios with the source absent, the system named a ship 0 times. Simpler methods name the wrong ship far more often." },
];

interface TourState {
  index: number | null;
  start: () => void;
  stop: () => void;
  go: (i: number) => void;
}

export const useTour = create<TourState>((set) => ({
  index: null,
  start: () => set({ index: 0 }),
  stop: () => set({ index: null }),
  go: (i) => set({ index: Math.max(0, Math.min(STOPS.length - 1, i)) }),
}));

export default function GuidedTour() {
  const { index, go, stop } = useTour();
  const navigate = useNavigate();
  const gates = useReview((s) => s.gate);
  const s = index != null ? STOPS[index] : null;

  useEffect(() => {
    if (!s) return;
    navigate(s.route);
    const ws = useWorkspace.getState();
    // The case page resets the view when it opens a case; apply the stop's view once it has settled.
    const t = window.setTimeout(() => useWorkspace.getState().setView(s.view ?? "map"), s.route.includes("/case/") ? 700 : 0);
    if (!s.route.includes("/case/")) ws.setView("map");
    return () => window.clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (index == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stop]);

  if (!s || index == null) return null;
  const blocked = Boolean(s.needsGate && !gates[s.needsGate]);
  return (
    <aside className="coach" role="dialog" aria-label="Guided tour" aria-live="polite">
      <header>
        <span className="t-label num">Guided tour, {index + 1} of {STOPS.length}</span>
        <button type="button" className="icon-btn" aria-label="End the tour" onClick={stop}><X size={15} /></button>
      </header>
      <h2 className="t-section">{s.title}</h2>
      <p>{s.text}</p>
      <div className="coach-progress" aria-hidden="true">
        {STOPS.map((_, i) => <i key={i} className={i <= index ? "on" : ""} />)}
      </div>
      <footer>
        <button type="button" className="btn btn-quiet" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft size={15} /> Back</button>
        {index < STOPS.length - 1 ? (
          <button type="button" className="btn btn-primary" disabled={blocked} title={blocked ? "Answer the oil check first" : undefined} onClick={() => go(index + 1)}>
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={stop}>Finish</button>
        )}
      </footer>
      {blocked && <p className="t-label">Waiting for your oil check answer.</p>}
    </aside>
  );
}

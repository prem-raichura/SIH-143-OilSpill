// Viewer map preferences (basemap). Kept in this browser only; ocean is the default view.
import { create } from "zustand";

export type BasemapId = "chart" | "ocean" | "satellite" | "light" | "dark";
const KEY = "oilspill.basemap";
const IDS: BasemapId[] = ["chart", "ocean", "satellite", "light", "dark"];

function initial(): BasemapId {
  try {
    const v = localStorage.getItem(KEY) as BasemapId | null;
    return v && IDS.includes(v) ? v : "ocean";
  } catch {
    return "ocean";
  }
}

interface MapPrefsState {
  basemap: BasemapId;
  setBasemap: (b: BasemapId) => void;
}

export const useMapPrefs = create<MapPrefsState>((set) => ({
  basemap: initial(),
  setBasemap: (basemap) => {
    try {
      localStorage.setItem(KEY, basemap);
    } catch {
      /* storage unavailable: the choice still applies for this session */
    }
    set({ basemap });
  },
}));

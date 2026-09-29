// Viewer map preferences, remembered per browser: the basemap (ocean by default) and whether the
// advanced GIS tools (grid, coordinates, minimap, measuring, 3D views) are shown. Simple mode is the default.
import { create } from "zustand";

export type BasemapId = "chart" | "ocean" | "satellite" | "light" | "dark";
const KEY = "oilspill.basemap";
const ADVANCED_KEY = "oilspill.mapAdvanced";
const IDS: BasemapId[] = ["chart", "ocean", "satellite", "light", "dark"];

function initial(): BasemapId {
  try {
    const v = localStorage.getItem(KEY) as BasemapId | null;
    return v && IDS.includes(v) ? v : "ocean";
  } catch {
    return "ocean";
  }
}

function initialAdvanced(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === "1";
  } catch {
    return false;
  }
}

interface MapPrefsState {
  basemap: BasemapId;
  advanced: boolean;
  setBasemap: (b: BasemapId) => void;
  setAdvanced: (on: boolean) => void;
}

export const useMapPrefs = create<MapPrefsState>((set) => ({
  basemap: initial(),
  advanced: initialAdvanced(),
  setBasemap: (basemap) => {
    try {
      localStorage.setItem(KEY, basemap);
    } catch {
      /* storage unavailable: the choice still applies for this session */
    }
    set({ basemap });
  },
  setAdvanced: (advanced) => {
    try {
      localStorage.setItem(ADVANCED_KEY, advanced ? "1" : "0");
    } catch {
      /* storage unavailable: the choice still applies for this session */
    }
    set({ advanced });
  },
}));

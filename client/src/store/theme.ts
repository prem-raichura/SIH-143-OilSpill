import { create } from "zustand";
import type { ThemeName } from "../design/palette";

const KEY = "oilspill.theme";

function initial(): ThemeName {
  try {
    return localStorage.getItem(KEY) === "day" ? "day" : "night";
  } catch {
    return "night";
  }
}

interface ThemeState {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initial(),
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === "night" ? "day" : "night"),
}));

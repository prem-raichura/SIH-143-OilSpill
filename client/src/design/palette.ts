// Map colors for deck.gl / three.js. Same hex values as tokens.css (checked by palette.test.ts).
export type ThemeName = "night" | "day";

export interface Palette {
  sea: string;
  land: string;
  coast: string;
  ink: string;
  ink2: string;
  grid: string;
  past: string;
  future: string;
  shipLead: string;
  shipShort: string;
  shipScreen: string;
  shipElim: string;
  shipBg: string;
  focus: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  night: {
    sea: "#0F2433",
    land: "#2B2C24",
    coast: "#4E5446",
    ink: "#E8EFF2",
    ink2: "#93A9B5",
    grid: "#1B384B",
    past: "#D55181",
    future: "#C98500",
    shipLead: "#86B6EF",
    shipShort: "#3987E5",
    shipScreen: "#1C5CAB",
    shipElim: "#6F818C",
    shipBg: "#34505F",
    focus: "#FFD84D",
  },
  day: {
    sea: "#EEF4F7",
    land: "#EFE4C4",
    coast: "#B9A97A",
    ink: "#10222D",
    ink2: "#587381",
    grid: "#D6E2E8",
    past: "#C2407E",
    future: "#B86E00",
    shipLead: "#184F95",
    shipShort: "#2A78D6",
    shipScreen: "#86B6EF",
    shipElim: "#8A9AA3",
    shipBg: "#C3CFD5",
    focus: "#FFD84D",
  },
};

export type RGBA = [number, number, number, number];

export function rgba(hex: string, alpha = 1): RGBA {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, Math.round(alpha * 255)];
}

/** Mix two hex colors, t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgba(a);
  const [br, bg, bb] = rgba(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

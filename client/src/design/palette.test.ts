import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTES } from "./palette";

const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) out[m[1]] = m[2].toUpperCase();
  return out;
}

const map: Record<string, string> = {
  sea: "sea", land: "land", coast: "coast", ink: "ink", ink2: "ink-2", grid: "grid", past: "past",
  future: "future", shipLead: "ship-lead", shipShort: "ship-short", shipScreen: "ship-screen",
  shipElim: "ship-elim", shipBg: "ship-bg", focus: "focus",
};

describe("palette.ts mirrors tokens.css", () => {
  it.each([
    ["night", ':root[data-theme="night"]'],
    ["day", ':root[data-theme="day"]'],
  ] as const)("%s", (theme, selector) => {
    const tokens = block(selector);
    for (const [k, v] of Object.entries(map)) {
      expect(PALETTES[theme][k as keyof (typeof PALETTES)["night"]].toUpperCase(), k).toBe(tokens[v]);
    }
  });
});

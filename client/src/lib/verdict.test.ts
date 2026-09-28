import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CasesIndex, Ledger, Meta } from "../data/types";
import { deriveVerdict } from "./verdict";
import { wilson } from "./wilson";

const root = resolve(__dirname, "../../public/data");
const read = <T,>(p: string): T => JSON.parse(readFileSync(resolve(root, p), "utf8")) as T;
const index = read<CasesIndex>("cases.json");

describe("verdict order matches the stored pipeline verdict", () => {
  it.each(index.cases.map((c) => [c.id, c.path]))("%s", (_id, path) => {
    const ledger = read<Ledger>(`${path}ledger.json`);
    const meta = read<Meta>(`${path}meta.json`);
    const d = deriveVerdict(ledger, meta, null);
    expect(d.code).toBe(ledger.verdict.code);
    if (ledger.verdict.code === 3) {
      expect(d.lead?.mmsi).toBe(ledger.verdict.mmsi);
      expect(d.gap).toBeCloseTo(ledger.verdict.score_gap ?? 0, 1);
    }
    expect(d.checks).toHaveLength(5);
    expect(d.checks.filter((c) => c.status === "fired")).toHaveLength(1);
  });

  it("a look-alike decision at the oil check stops at verdict 1", () => {
    const c = index.cases[0];
    const d = deriveVerdict(read<Ledger>(`${c.path}ledger.json`), read<Meta>(`${c.path}meta.json`), "lookalike");
    expect(d.code).toBe(1);
  });
});

describe("wilson", () => {
  it("matches the benchmark file", () => {
    const b = read<{ held_out: { set_B: { wrongful_naming: [number, [number, number]] }; set_A: { top1: [number, [number, number]] } } }>(
      "shared/benchmark.json",
    );
    const [lo, hi] = wilson(0, 100);
    expect(lo).toBeCloseTo(b.held_out.set_B.wrongful_naming[1][0], 3);
    expect(hi).toBeCloseTo(b.held_out.set_B.wrongful_naming[1][1], 3);
    const [lo2, hi2] = wilson(65, 100);
    expect(lo2).toBeCloseTo(b.held_out.set_A.top1[1][0], 3);
    expect(hi2).toBeCloseTo(b.held_out.set_A.top1[1][1], 3);
  });
});

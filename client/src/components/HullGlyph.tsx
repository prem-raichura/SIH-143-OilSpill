import type { HullKind, Role } from "../lib/vessels";

const ROLE_VAR: Record<Role, string> = {
  leading: "var(--ship-lead)",
  shortlist: "var(--ship-short)",
  screened: "var(--ship-screen)",
  eliminated: "var(--ship-elim)",
  background: "var(--ship-bg)",
};

const PATH: Record<HullKind, string> = {
  tanker: "M10 1 Q14 3 14 6 V19 H6 V6 Q6 3 10 1Z",
  cargo: "M10 1.5 Q14.5 3.5 14.5 6 V19 H5.5 V6 Q5.5 3.5 10 1.5Z",
  passenger: "M10 2 Q14 4 14 8 V16 Q14 19 10 19 Q6 19 6 16 V8 Q6 4 10 2Z",
  fishing: "M10 4 Q13.5 6 13.5 9 V14 Q13.5 17 10 17 Q6.5 17 6.5 14 V9 Q6.5 6 10 4Z",
  tug: "M10 4.5 Q14 6 14 9 V13.5 Q14 16.5 10 16.5 Q6 16.5 6 13.5 V9 Q6 6 10 4.5Z",
  other: "M10 1.5 L14.5 8.5 L14 18.5 H6 L5.5 8.5Z",
};

export function HullGlyph({ kind, role, size = 20, angle = 35 }: { kind: HullKind; role: Role; size?: number; angle?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ flex: "none" }}>
      <path d={PATH[kind]} fill={ROLE_VAR[role]} transform={`rotate(${angle} 10 10)`} stroke={role === "eliminated" ? "var(--ink-2)" : "none"} strokeWidth={role === "eliminated" ? 0.8 : 0} />
    </svg>
  );
}

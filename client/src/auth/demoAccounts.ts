// Demo accounts for the static build. Sign-in is simulated in the browser; there is no server.
// These are test values for this app only, not real credentials.
export type Role = "analyst" | "investigator" | "supervisor";

export interface DemoAccount {
  email: string;
  password: string;
  name: string;
  role: Role;
  unit: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "analyst@demo.oilwatch.test", password: "demo-analyst", name: "Demo analyst", role: "analyst", unit: "Image review desk" },
  { email: "investigator@demo.oilwatch.test", password: "demo-investigator", name: "Demo investigator", role: "investigator", unit: "Pollution investigation cell" },
  { email: "supervisor@demo.oilwatch.test", password: "demo-supervisor", name: "Demo supervisor", role: "supervisor", unit: "Operations room" },
];

export const ROLE_TEXT: Record<Role, { label: string; can: string }> = {
  analyst: { label: "Analyst", can: "Oil checks and the detection test. Never sees candidate ships, so reviews stay unbiased." },
  investigator: { label: "Investigator", can: "Full case investigation: drift, ships, evidence, verdict, follow-up and reports." },
  supervisor: { label: "Supervisor", can: "Everything an investigator can do, plus review log export and oversight." },
};

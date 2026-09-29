// Sign-in accounts, one per role. Credentials are checked in the browser; connect an identity provider before
// putting real users on it.
export type Role = "analyst" | "investigator" | "supervisor";

export interface Account {
  userId: string;
  password: string;
  name: string;
  role: Role;
  unit: string;
}

export const ACCOUNTS: Account[] = [
  { userId: "analyst", password: "analyst-2026", name: "Duty Analyst", role: "analyst", unit: "Image review desk" },
  { userId: "investigator", password: "investigator-2026", name: "Lead Investigator", role: "investigator", unit: "Pollution investigation cell" },
  { userId: "supervisor", password: "supervisor-2026", name: "Operations Supervisor", role: "supervisor", unit: "Operations room" },
];

export const ROLE_TEXT: Record<Role, { label: string; can: string }> = {
  analyst: { label: "Analyst", can: "Oil checks and the detection test. Never sees candidate ships, so reviews stay unbiased." },
  investigator: { label: "Investigator", can: "Full case investigation: drift, ships, evidence, verdict, follow-up and reports." },
  supervisor: { label: "Supervisor", can: "Everything an investigator can do, plus review log export and oversight." },
};

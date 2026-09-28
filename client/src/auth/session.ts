import { create } from "zustand";
import { DEMO_ACCOUNTS, type DemoAccount, type Role } from "./demoAccounts";

const KEY = "oilspill.session";

export interface Session {
  email: string;
  name: string;
  role: Role;
  unit: string;
  since: string;
}

function load(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

interface SessionState {
  session: Session | null;
  signIn: (email: string, password: string) => { ok: true } | { ok: false; message: string };
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  session: load(),
  signIn: (email, password) => {
    const acc: DemoAccount | undefined = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!acc) return { ok: false, message: "No demo account with that email. Use one of the demo account buttons." };
    if (acc.password !== password) return { ok: false, message: "Wrong password for this demo account. The demo buttons fill it in for you." };
    const session: Session = { email: acc.email, name: acc.name, role: acc.role, unit: acc.unit, since: new Date().toISOString() };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* storage blocked: the session lasts until reload */
    }
    set({ session });
    return { ok: true };
  },
  signOut: () => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ session: null });
  },
}));

export const canSeeShips = (r: Role | undefined) => r === "investigator" || r === "supervisor";

import { create } from "zustand";
import { ACCOUNTS, type Account, type Role } from "./accounts";

const KEY = "oilspill.session";

export interface Session {
  userId: string;
  name: string;
  role: Role;
  unit: string;
  since: string;
}

/** Restore the session of this tab. Anything that no longer matches a current account is dropped (sign in again). */
function load(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    const acc = ACCOUNTS.find((a) => a.userId === s.userId);
    if (!acc || !s.since) return null;
    return { userId: acc.userId, name: acc.name, role: acc.role, unit: acc.unit, since: s.since };
  } catch {
    return null;
  }
}

interface SessionState {
  session: Session | null;
  signIn: (userId: string, password: string) => { ok: true } | { ok: false; message: string };
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  session: load(),
  signIn: (userId, password) => {
    const acc: Account | undefined = ACCOUNTS.find((a) => a.userId === userId.trim().toLowerCase());
    if (!acc) return { ok: false, message: "No account with that user ID." };
    if (acc.password !== password) return { ok: false, message: "Wrong password." };
    const session: Session = { userId: acc.userId, name: acc.name, role: acc.role, unit: acc.unit, since: new Date().toISOString() };
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

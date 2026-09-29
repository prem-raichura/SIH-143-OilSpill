import * as Popover from "@radix-ui/react-popover";
import { BarChart3, BookOpen, ClipboardList, LogOut, Map, Menu, Moon, PlayCircle, Radar, ScanSearch, Ship, Sun, type LucideIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { ROLE_TEXT } from "../auth/accounts";
import { canSeeShips, useSession } from "../auth/session";
import { Tip } from "../components/ui";
import { useTheme } from "../store/theme";
import { useTour } from "../tour/GuidedTour";

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; ships?: boolean }[] = [
  { to: "/app", label: "Console", icon: Radar, end: true },
  { to: "/app/cases", label: "Cases", icon: Map },
  { to: "/app/detection", label: "Detection test", icon: ScanSearch },
  { to: "/app/benchmark", label: "Benchmark", icon: BarChart3 },
  { to: "/app/vessels", label: "Vessels", icon: Ship, ships: true },
  { to: "/app/reviews", label: "Review log", icon: ClipboardList },
  { to: "/app/method", label: "Method", icon: BookOpen },
];

export function Mark() {
  return (
    <img src="/logo/final_logo.png" width="22" height="22" alt="" aria-hidden="true" />
  );
}

export default function TopBar() {
  const { theme, toggle } = useTheme();
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const nav = NAV.filter((n) => !n.ships || canSeeShips(session?.role));
  const initials = session ? session.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "";
  return (
    <header className="topbar">
      <NavLink to="/app" className="brand" aria-label="Oilens, home">
        <span className="brand-mark"><Mark /></span>
        <span className="brand-name">Oilens</span>
      </NavLink>
      <nav className="topnav" aria-label="Main">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            <n.icon size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" className="btn btn-secondary menu-btn" aria-label="Open the menu"><Menu size={17} /> Menu</button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="menu-pop" align="start" sideOffset={6}>
            <nav aria-label="Main">
              {nav.map((n) => (
                <Popover.Close asChild key={n.to}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => `menu-link${isActive ? " active" : ""}`}>
                    <n.icon size={16} strokeWidth={1.8} aria-hidden="true" /> {n.label}
                  </NavLink>
                </Popover.Close>
              ))}
            </nav>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div className="topbar-right">
        {canSeeShips(session?.role) && (
          <button type="button" className="btn btn-accent-outline" onClick={() => useTour.getState().start()} title="Walk through an investigation">
            <PlayCircle size={15} strokeWidth={1.8} /> <span className="hide-sm">Take the tour</span>
          </button>
        )}
        <Tip content={theme === "night" ? "Switch to light theme" : "Switch to dark theme"} side="bottom">
          <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label={theme === "night" ? "Switch to light theme" : "Switch to dark theme"}>
            {theme === "night" ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
          </button>
        </Tip>
        {session && (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button type="button" className="user-chip" aria-label={`Account: ${session.name}`}>
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span className="user-text">
                  <b>{session.name}</b>
                  <span>{ROLE_TEXT[session.role].label}</span>
                </span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="menu-pop user-pop" align="end" sideOffset={6}>
                <div className="user-pop-head">
                  <span className="avatar avatar-lg" aria-hidden="true">{initials}</span>
                  <div>
                    <b>{session.name}</b>
                    <span className="muted">{session.userId}</span>
                  </div>
                </div>
                <dl className="kv user-pop-kv">
                  <dt>Role</dt>
                  <dd>{ROLE_TEXT[session.role].label}</dd>
                  <dt>Unit</dt>
                  <dd>{session.unit}</dd>
                </dl>
                <p className="t-label">{ROLE_TEXT[session.role].can}</p>
                <button type="button" className="btn btn-secondary" onClick={() => { signOut(); navigate("/"); }}>
                  <LogOut size={15} strokeWidth={1.8} /> Sign out
                </button>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </header>
  );
}

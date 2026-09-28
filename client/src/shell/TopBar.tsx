import * as Popover from "@radix-ui/react-popover";
import { LogOut, Menu, Moon, PlayCircle, Sun } from "lucide-react";
import { useDemo } from "../demo/GuidedDemo";
import { NavLink, useNavigate } from "react-router-dom";
import { ROLE_TEXT } from "../auth/demoAccounts";
import { canSeeShips, useSession } from "../auth/session";
import { useTheme } from "../store/theme";

const NAV = [
  { to: "/app", label: "Console", end: true },
  { to: "/app/cases", label: "Cases" },
  { to: "/app/detection", label: "Detection test" },
  { to: "/app/benchmark", label: "Benchmark" },
  { to: "/app/vessels", label: "Vessels", ships: true },
  { to: "/app/reviews", label: "Review log" },
  { to: "/app/method", label: "Method" },
];

export function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 21c4-6 8 2 12-3s7-2 12-1" stroke="var(--past)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M8 13l8-5 8 5" stroke="var(--ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 26c4-2 8 1 12-1s7-1 12 0" stroke="var(--future)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function TopBar() {
  const { theme, toggle } = useTheme();
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const nav = NAV.filter((n) => !("ships" in n) || canSeeShips(session?.role));
  return (
    <header className="topbar">
      <NavLink to="/app" className="brand" aria-label="Oil spill investigation, home">
        <Mark />
        <span className="brand-name">Oil spill investigation</span>
        <span className="brand-sub">SIH 26143</span>
      </NavLink>
      <nav className="topnav" aria-label="Main">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" className="btn btn-quiet menu-btn" aria-label="Open the menu"><Menu size={17} /> Menu</button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="menu-pop" align="start" sideOffset={6}>
            <nav aria-label="Main">
              {nav.map((n) => (
                <Popover.Close asChild key={n.to}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => `menu-link${isActive ? " active" : ""}`}>{n.label}</NavLink>
                </Popover.Close>
              ))}
            </nav>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div className="topbar-right">
        {canSeeShips(session?.role) && (
          <button type="button" className="btn btn-quiet" onClick={() => useDemo.getState().start()} title="Walk through the demo story">
            <PlayCircle size={15} strokeWidth={1.5} /> <span className="hide-sm">Guided demo</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={toggle}
          aria-label={theme === "night" ? "Switch to day theme" : "Switch to night theme"}
          title={theme === "night" ? "Day theme (better on projectors)" : "Night theme"}
        >
          {theme === "night" ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
          <span className="hide-sm">{theme === "night" ? "Day" : "Night"}</span>
        </button>
        {session && (
          <span className="user-chip" title={session.unit}>
            <span className="avatar" aria-hidden="true">{session.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
            <span className="user-text">
              <b>{session.name}</b>
              <span>{ROLE_TEXT[session.role].label}</span>
            </span>
          </span>
        )}
        <button type="button" className="btn btn-quiet" onClick={() => { signOut(); navigate("/"); }} aria-label="Sign out">
          <LogOut size={15} strokeWidth={1.5} /> <span className="hide-sm">Sign out</span>
        </button>
      </div>
    </header>
  );
}

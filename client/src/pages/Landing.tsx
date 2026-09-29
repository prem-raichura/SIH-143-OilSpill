import { LogIn } from "lucide-react";
import { useEffect, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../auth/session";
import ChartPlate, { ChartKey } from "../brand/ChartPlate";
import ThemeToggle from "../components/ThemeToggle";
import { DotCIRows } from "../charts/charts";
import { useBenchmark } from "../data/load";
import { Mark } from "../shell/TopBar";

const STAGES = [
  { t: "Detect", d: "A detection model marks dark patches on Sentinel-1 radar images. A second check separates oil from look-alikes such as calm water or algae." },
  { t: "Human oil check", d: "An analyst confirms the oil before any ship data is shown. A look-alike closes the case there." },
  { t: "Drift back and forward", d: "The oil is run backward through currents, tides, waves and wind to the area it came from, and forward 72 hours to show where it goes." },
  { t: "Screen ships", d: "Ship tracks (AIS) are checked against that area. Only a physical impossibility rules a ship out; everything else is weighed as evidence." },
  { t: "Verdict, or a refusal", d: "One of five verdicts. A ship is named only when the evidence clearly separates it; otherwise the system says what data would help." },
];

const DATA = [
  ["Sentinel-1 radar (Copernicus)", "Slick detection and bright-point ship targets"],
  ["AIS ship positions", "Vessel tracks, including NOAA MarineCadastre for US waters"],
  ["CMEMS ocean currents, tides and waves", "Drift physics, backward and forward"],
  ["ERA5 wind (ECMWF)", "Drift physics and radar reliability"],
  ["OpenDrift OpenOil", "Forecast and forward confirmation"],
  ["SkyTruth Cerulean", "Slick outlines with scene IDs, and an independent comparison"],
];

/** In-page links: the app uses hash routing, so "#how" would be read as a route. Scroll to the section instead. */
function jump(e: MouseEvent, id: string) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
}

const USERS = [
  { t: "Pollution response teams", d: "See where a slick came from and where it is heading, on one map." },
  { t: "Coast guard investigators", d: "Weigh the evidence for and against every nearby ship before acting." },
  { t: "Port state control", d: "Take a documented, reviewable case into inspections and hearings." },
];

export default function Landing() {
  const session = useSession((s) => s.session);
  const bench = useBenchmark().data;
  useEffect(() => {
    document.title = "OILENS";
  }, []);
  const B = bench?.held_out.set_B;
  const cmp = bench?.comparison_methods_held_out;
  const primary = session ? { to: "/app", label: "Open the console" } : { to: "/login", label: "Sign in" };
  return (
    <div className="landing">
      <header className="landing-bar">
        <Link to="/" className="brand" aria-label="OILENS, start page">
          <span className="brand-mark"><Mark /></span>
          <span className="brand-name">OILENS</span>
        </Link>
        <nav aria-label="Page sections" className="landing-nav">
          <a href="#how" onClick={(e) => jump(e, "how")}>How it works</a>
          <a href="#proof" onClick={(e) => jump(e, "proof")}>Results</a>
          <a href="#data" onClick={(e) => jump(e, "data")}>Data sources</a>
        </nav>
        <div className="landing-actions">
          <ThemeToggle />
          <Link to={primary.to} className="btn btn-primary">{!session && <LogIn size={15} />} {primary.label}</Link>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-chart">
          <ChartPlate framing="hero" animate />
        </div>
        <div className="hero-copy">
          <h1 className="hero-title" id="hero-title">From detecting spills to protecting the marine ecosystem, OILENS leads the way.</h1>
          <p className="hero-sub">
            Satellite radar, ocean currents and ship tracks in one investigation. The evidence for and against every ship is laid out, and
            the system says so when the data can't decide.
          </p>
          <div className="hero-actions">
            <Link to={primary.to} className="btn btn-primary btn-lg">{primary.label}</Link>
            <a href="#how" className="btn btn-secondary btn-lg hero-secondary" onClick={(e) => jump(e, "how")}>See how it works</a>
          </div>
        </div>
        <div className="hero-aside">
          <ChartKey />
          <p className="hero-caption"><span className="place">Mumbai approaches</span>, Sentinel-1 radar, 3 October 2024</p>
        </div>
      </section>

      <section id="how" className="l-section" tabIndex={-1}>
        <h2 className="l-h2">How an investigation runs</h2>
        <ol className="route">
          {STAGES.map((s, i) => (
            <li key={s.t} className={i === 1 ? "human" : undefined}>
              <span className="wp num" aria-hidden="true">{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="l-band">
        <section id="proof" className="l-section l-split" tabIndex={-1}>
          <div className="l-proof-text">
            <h2 className="l-h2">Measured, not claimed</h2>
            <p className="l-lead">
              {B
                ? `On ${B.n} held-out test scenarios where the source ship was not in AIS, the system named a ship ${B.wrongful_naming[0]} times (95 % CI ${(B.wrongful_naming[1][0] * 100).toFixed(0)} to ${(B.wrongful_naming[1][1] * 100).toFixed(1)} %).`
                : "Loading results…"}
            </p>
            <p className="muted">
              Simpler methods on the same scenarios name the wrong ship far more often. Results are test outcomes with 95 % intervals, never
              real-world probabilities.
            </p>
          </div>
          <figure className="l-figure">
            {B && cmp && (
              <DotCIRows
                rows={[
                  { label: "Full system", k: B.wrongful_naming[0], n: B.n, p: B.wrongful_naming[0] / B.n, ci: B.wrongful_naming[1], strong: true },
                  { label: "Forward match only", k: cmp.baseline_forward.set_B_wrongful_naming[0], n: 100, p: cmp.baseline_forward.set_B_wrongful_naming[0] / 100, ci: cmp.baseline_forward.set_B_wrongful_naming[1] },
                  { label: "Proximity and timing only", k: cmp.baseline_proximity.set_B_wrongful_naming[0], n: 100, p: cmp.baseline_proximity.set_B_wrongful_naming[0] / 100, ci: cmp.baseline_proximity.set_B_wrongful_naming[1] },
                ]}
              />
            )}
            <figcaption>Wrongful naming when the source ship is absent, held-out tests. Lower is better.</figcaption>
          </figure>
        </section>
      </div>

      <section id="data" className="l-section" tabIndex={-1}>
        <h2 className="l-h2">What it runs on</h2>
        <dl className="data-list">
          {DATA.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="l-section">
        <h2 className="l-h2">Who it is for</h2>
        <div className="users">
          {USERS.map((u) => (
            <div key={u.t}>
              <h3>{u.t}</h3>
              <p>{u.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-close">
        <div className="l-close-inner">
          <h2 className="l-h2">Open a case and follow the evidence.</h2>
          <Link to={primary.to} className="btn btn-primary btn-lg">{primary.label}</Link>
        </div>
      </section>

      <footer className="landing-foot">
        <span className="brand"><span className="brand-mark"><Mark /></span> OILENS</span>
        <span>© 2026 OILENS</span>
      </footer>
    </div>
  );
}

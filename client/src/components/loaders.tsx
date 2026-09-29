// Loaders, each matched to where it is used:
// - LogoLoader / PageLoader: page and route loads (OILENS badge stays still, a satellite ring orbits it).
// - MapLoader: covers a map until its data and first tiles are in.
// - MapProgress: thin bar for later tile loads (pan and zoom), never blocks the map.
// - Skeleton*: placeholders shaped like the content that is coming.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, DUR, EASE, m } from "./motion";

export const LOGO_SRC = `${import.meta.env.BASE_URL}logo/logo-256.png`;

/**
 * Show a loader only if loading lasts longer than `delay` (no flash on fast or cached loads),
 * and once shown keep it at least `min` ms (no flicker).
 */
export function useDelayed(active: boolean, delay = 150, min = 350, startShown = false): boolean {
  // startShown: visible from the first frame when already active on mount (no gap after a page switch).
  const [shown, setShown] = useState(() => startShown && active);
  const since = useRef(0);
  useEffect(() => {
    if (active) {
      if (shown) return;
      const t = window.setTimeout(() => {
        since.current = performance.now();
        setShown(true);
      }, delay);
      return () => window.clearTimeout(t);
    }
    if (!shown) return;
    const left = Math.max(0, min - (performance.now() - since.current));
    const t = window.setTimeout(() => setShown(false), left);
    return () => window.clearTimeout(t);
  }, [active, shown, delay, min]);
  return shown;
}

export function LogoLoader({ label, size = "lg" }: { label?: string; size?: "lg" | "md" | "sm" }) {
  return (
    <div className={`logo-loader ll-${size}`} role="status" aria-live="polite">
      <div className="ll-mark" aria-hidden="true">
        <span className="ll-halo" />
        <svg className="ll-orbit" viewBox="0 0 100 100">
          <circle className="ll-track" cx="50" cy="50" r="46" />
          <circle className="ll-arc" cx="50" cy="50" r="46" pathLength={100} />
          <circle className="ll-sat" cx="50" cy="4" r="3.4" />
        </svg>
        <img src={LOGO_SRC} alt="" draggable={false} />
      </div>
      {label && size !== "sm" ? <span className="ll-label">{label}</span> : <span className="sr-only">{label ?? "Loading"}</span>}
    </div>
  );
}

/** Loader that fills its container (a route or a whole page). */
export function PageLoader({ label = "Loading…", fullscreen = false, immediate = false }: { label?: string; fullscreen?: boolean; immediate?: boolean }) {
  const shown = useDelayed(true, 120);
  // Full-screen takes over from the boot loader in index.html: show at once, no fade, so there is no blank frame.
  // `immediate`: page switches, where the loader must be on screen in the very next paint.
  if (fullscreen || immediate) {
    return (
      <div className={`page-loader${fullscreen ? " fullscreen" : ""}`}>
        <LogoLoader label={fullscreen ? undefined : label} />
      </div>
    );
  }
  return (
    <div className={`page-loader${fullscreen ? " fullscreen" : ""}`}>
      <AnimatePresence>
        {shown && (
          <m.div key="l" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: DUR.base, ease: EASE }}>
            <LogoLoader label={label} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Covers a map while it is not ready; fades out when it is. */
export function MapLoader({ show, label = "Loading map…" }: { show: boolean; label?: string }) {
  const shown = useDelayed(show, 80, 400, true);
  return (
    <AnimatePresence>
      {shown && (
        <m.div
          key="map-loader"
          className="map-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.slow, ease: EASE }}
        >
          <LogoLoader label={label} size="md" />
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** Thin indeterminate bar along the top of a map: tiles still arriving. */
export function MapProgress({ show }: { show: boolean }) {
  const shown = useDelayed(show, 250, 300);
  return (
    <AnimatePresence>
      {shown && (
        <m.div key="p" className="map-progress" role="progressbar" aria-label="Loading map tiles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <span />
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function SkeletonBlock({ w = "100%", h = 12, r = 4, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="skeleton" style={{ display: "block", width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonText({ lines = 4 }: { lines?: number }) {
  return (
    <div className="skel-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} w={`${Math.max(35, 92 - i * 11)}%`} />
      ))}
    </div>
  );
}

/** Card-shaped placeholder: a title row, a large line and a meta line (case rows, feed items). */
export function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className="skel-card" aria-hidden="true">
      <div className="skel-row">
        <SkeletonBlock w={52} h={18} />
        <SkeletonBlock w={96} h={20} r={999} />
      </div>
      <SkeletonBlock w="70%" h={18} />
      <SkeletonBlock w="45%" h={11} />
      {tall && (
        <div className="skel-row" style={{ justifyContent: "flex-start" }}>
          {[56, 70, 58, 44].map((w, i) => <SkeletonBlock key={i} w={w} h={18} r={999} />)}
        </div>
      )}
    </div>
  );
}

/**
 * Reading-page placeholder shaped like what is coming:
 * cards (benchmark charts), table (vessel history, review log), tiles (detection test), report (a document with maps).
 */
export function PageSkeleton({ variant }: { variant: "cards" | "table" | "tiles" | "report" }) {
  const head = (
    <div className="skel-row" style={{ justifyContent: "flex-start", gap: 14 }}>
      <SkeletonBlock w={44} h={44} r={12} />
      <SkeletonBlock w={260} h={26} />
    </div>
  );
  return (
    <div className={variant === "report" ? "report-page" : "page-pad reading"} aria-busy="true" aria-label="Loading">
      <div className={`skel-page${variant === "report" ? " report" : ""}`}>
        {variant === "report" ? <SkeletonBlock w="55%" h={30} /> : head}
        <SkeletonText lines={2} />
        {variant === "cards" && (
          <div className="skel-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {[0, 1].map((i) => (
              <div key={i} className="skel-card"><SkeletonBlock w="60%" h={16} /><SkeletonBlock h={150} r={8} /><SkeletonText lines={2} /></div>
            ))}
          </div>
        )}
        {variant === "table" && (
          <div className="skel-card">
            {Array.from({ length: 8 }, (_, i) => <SkeletonBlock key={i} h={i === 0 ? 14 : 20} w={i === 0 ? "40%" : "100%"} style={{ opacity: i === 0 ? 0.8 : 1 }} />)}
          </div>
        )}
        {variant === "tiles" && (
          <div className="skel-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {Array.from({ length: 12 }, (_, i) => <SkeletonBlock key={i} h="auto" r={10} style={{ aspectRatio: "1" }} />)}
          </div>
        )}
        {variant === "report" && (
          <>
            <SkeletonBlock h={360} r={8} />
            <SkeletonText lines={5} />
            <SkeletonBlock h={260} r={8} />
          </>
        )}
      </div>
    </div>
  );
}

/** A list of placeholder cards with an accessible busy state. */
export function SkeletonList({ n = 4, tall = false }: { n?: number; tall?: boolean }) {
  return (
    <div className="skel-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => <SkeletonCard key={i} tall={tall} />)}
    </div>
  );
}

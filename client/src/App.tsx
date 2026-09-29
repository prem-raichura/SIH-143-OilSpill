import * as RTooltip from "@radix-ui/react-tooltip";
import { domMax, LazyMotion, MotionConfig } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import { PageLoader } from "./components/loaders";
import { EASE, m } from "./components/motion";
import TopBar from "./shell/TopBar";
import GuidedTour from "./tour/GuidedTour";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Console = lazy(() => import("./pages/Console"));
const Home = lazy(() => import("./pages/Home"));
const CasePage = lazy(() => import("./pages/CasePage"));
const Benchmark = lazy(() => import("./pages/Benchmark"));
const DetectionTest = lazy(() => import("./pages/DetectionTest"));
const Vessels = lazy(() => import("./pages/Vessels"));
const ReviewLog = lazy(() => import("./pages/ReviewLog"));
const Method = lazy(() => import("./pages/Method"));
const Report = lazy(() => import("./pages/Report"));

/** What the loader says while a page is being opened. */
function loadingLabel(path: string): string {
  if (path === "/app") return "Loading console…";
  if (path === "/app/cases") return "Loading cases…";
  if (/^\/app\/case\/[^/]+\/report$/.test(path)) return "Preparing report…";
  if (path.startsWith("/app/case/")) return "Opening case…";
  if (path === "/app/detection") return "Loading detection test…";
  if (path === "/app/benchmark") return "Loading benchmark…";
  if (path === "/app/vessels") return "Loading vessels…";
  if (path === "/app/reviews") return "Loading review log…";
  return "Loading…";
}

/**
 * Pages with maps and 3D views take a moment to build, and building blocks the screen.
 * On a page change, paint the loader first and build the new page two frames later, so the loader is on screen
 * while the work happens (its spin runs on the compositor and keeps moving). Then the page fades in.
 */
function RouteFade() {
  const { pathname } = useLocation();
  const [shown, setShown] = useState(pathname);
  useEffect(() => {
    if (pathname === shown) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setShown(pathname));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [pathname, shown]);
  if (pathname !== shown) return <PageLoader label={loadingLabel(pathname)} immediate />;
  return (
    <m.div key={pathname} className="route-fade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24, ease: EASE }}>
      <Outlet />
    </m.div>
  );
}

function AppFrame() {
  return (
    <RequireAuth>
      <div className="app">
        <TopBar />
        <main className="app-main">
          <Suspense fallback={<PageLoader immediate />}>
            <RouteFade />
          </Suspense>
          <GuidedTour />
        </main>
      </div>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <RTooltip.Provider>
          <HashRouter>
            <Suspense fallback={<PageLoader fullscreen />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/app" element={<AppFrame />}>
                  <Route index element={<Console />} />
                  <Route path="cases" element={<Home />} />
                  <Route path="case/:id" element={<CasePage />} />
                  <Route path="case/:id/report" element={<Report />} />
                  <Route path="benchmark" element={<Benchmark />} />
                  <Route path="detection" element={<DetectionTest />} />
                  <Route path="vessels" element={<Vessels />} />
                  <Route path="reviews" element={<ReviewLog />} />
                  <Route path="method" element={<Method />} />
                </Route>
                <Route path="/case/:id" element={<Navigate to="/app/cases" replace />} />
                <Route path="*" element={<div className="page-pad">This page does not exist. Go to the <a href="#/">start page</a>.</div>} />
              </Routes>
            </Suspense>
          </HashRouter>
        </RTooltip.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}

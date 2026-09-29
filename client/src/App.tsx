import * as RTooltip from "@radix-ui/react-tooltip";
import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import { Loading } from "./components/ui";
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

function PageFallback() {
  return (
    <div className="page-pad">
      <Loading lines={5} />
    </div>
  );
}

function AppFrame() {
  return (
    <RequireAuth>
      <div className="app">
        <TopBar />
        <main className="app-main">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
          <GuidedTour />
        </main>
      </div>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <RTooltip.Provider>
      <HashRouter>
        <Suspense fallback={<PageFallback />}>
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
  );
}

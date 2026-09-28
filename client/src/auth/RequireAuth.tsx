import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "./session";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession((s) => s.session);
  const loc = useLocation();
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

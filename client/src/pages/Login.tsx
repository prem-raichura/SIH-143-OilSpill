import { ArrowLeft, Eye, EyeOff, ScanSearch, Search, ShieldCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ACCOUNTS, ROLE_TEXT, type Role } from "../auth/accounts";
import { useSession } from "../auth/session";
import ChartPlate, { ChartKey } from "../brand/ChartPlate";
import { Mark } from "../shell/TopBar";

const ROLE_ICON: Record<Role, typeof Search> = { analyst: ScanSearch, investigator: Search, supervisor: ShieldCheck };

export default function Login() {
  const { session, signIn } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const next = params.get("next") || "/app";
  if (session) return <Navigate to={next} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = signIn(userId, password);
    if (r.ok) navigate(next, { replace: true });
    else setError(r.message);
  };

  return (
    <div className="login">
      <section className="login-art" aria-label="Chart of an investigation off Mumbai">
        <ChartPlate framing="panel" />
        <Link to="/" className="login-art-brand" aria-label="Oilence, start page">
          <span className="brand-mark"><Mark /></span>
          <span>Oilence</span>
        </Link>
        <div className="login-art-caption">
          <span className="place">Mumbai approaches</span>
          <span>A 66 km slick, traced back to the area it came from and forward 72 hours.</span>
          <ChartKey />
        </div>
      </section>
      <section className="login-side">
        <Link to="/" className="btn btn-quiet login-back"><ArrowLeft size={15} /> Back to home</Link>
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-head">
            <h1 className="t-page">Sign in</h1>
            <p className="muted">For maritime pollution-response staff.</p>
          </div>
          <label className="field">
            <span className="t-label">User ID</span>
            <input className="input input-lg" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={userId}
              onChange={(e) => { setUserId(e.target.value); setError(null); }} aria-invalid={Boolean(error)} required />
          </label>
          <label className="field">
            <span className="t-label">Password</span>
            <span className="pw-field">
              <input className="input input-lg" type={show ? "text" : "password"} autoComplete="current-password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }} aria-invalid={Boolean(error)} required />
              <button type="button" className="icon-btn pw-toggle" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {error && <p className="error-note" role="alert">{error}</p>}
          <button ref={submitRef} type="submit" className="btn btn-primary btn-lg">Sign in</button>
          <div className="login-roles" role="group" aria-labelledby="roles-title">
            <span className="t-label" id="roles-title">Sign in as</span>
            {ACCOUNTS.map((a) => {
              const I = ROLE_ICON[a.role];
              return (
                <button key={a.role} type="button" className="role-acc"
                  onClick={() => { setUserId(a.userId); setPassword(a.password); setError(null); submitRef.current?.focus(); }}>
                  <span className="role-icon" aria-hidden="true"><I size={17} strokeWidth={1.8} /></span>
                  <b>{a.name}</b>
                  <span>{ROLE_TEXT[a.role].can}</span>
                </button>
              );
            })}
          </div>
        </form>
      </section>
    </div>
  );
}

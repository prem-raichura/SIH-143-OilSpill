import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { DEMO_ACCOUNTS, ROLE_TEXT } from "../auth/demoAccounts";
import { useSession } from "../auth/session";
import { dataUrl } from "../data/load";
import { Mark } from "../shell/TopBar";

export default function Login() {
  const { session, signIn } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const next = params.get("next") || "/app";
  if (session) return <Navigate to={next} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = signIn(email, password);
    if (r.ok) navigate(next, { replace: true });
    else setError(r.message);
  };

  return (
    <div className="login">
      <section className="login-art" aria-label="Sentinel-1 radar scene off Mumbai">
        <img src={dataUrl("AS-01/sar_quicklook.png")} alt="" />
        <div className="login-art-frame" aria-hidden="true" />
        <div className="login-art-caption">
          <span className="place">Mumbai approaches</span>
          <span>Sentinel-1 radar, 3 Oct 2024, 01:03 UTC. The dark streak is a 66 km slick.</span>
        </div>
      </section>
      <section className="login-side">
        <Link to="/" className="btn btn-quiet login-back"><ArrowLeft size={15} /> Back to the start page</Link>
        <form className="login-card" onSubmit={submit} noValidate>
          <div className="login-brand"><Mark /> <span>Oil spill investigation</span></div>
          <h1 className="t-page">Sign in to the investigation console</h1>
          <p className="muted">For authorised maritime pollution-response staff.</p>
          <label className="field">
            <span className="t-label">Work email</span>
            <input className="input input-lg" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} required />
          </label>
          <label className="field">
            <span className="t-label">Password</span>
            <input className="input input-lg" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} required />
          </label>
          {error && <p className="error-note" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg">Sign in</button>
          <div className="login-demo">
            <span className="t-label">Demo accounts</span>
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.role} type="button" className="demo-acc" onClick={() => { setEmail(a.email); setPassword(a.password); setError(null); }}>
                <b>{ROLE_TEXT[a.role].label}</b>
                <span>{ROLE_TEXT[a.role].can}</span>
              </button>
            ))}
          </div>
          <p className="note">Demo build: sign-in happens in this browser only. No data leaves your device.</p>
        </form>
      </section>
    </div>
  );
}

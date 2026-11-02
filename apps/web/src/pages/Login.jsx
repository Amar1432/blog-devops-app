import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import StatusMessage from "../components/StatusMessage.jsx";
import { api } from "../lib/api.js";
import { getToken, saveSession } from "../lib/auth.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (getToken()) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data = await api.login({ email, password });
      saveSession(data.token, data.user);
      navigate(location.state?.from || "/admin", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="narrow">
      <p className="eyebrow">Admin access</p>
      <h1>Log in</h1>
      <p className="muted">Sign in with the admin account created by the seed script.</p>

      {error && <StatusMessage tone="error">{error}</StatusMessage>}

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

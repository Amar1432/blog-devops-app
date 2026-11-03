import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, LogIn as LogInIcon, ShieldCheck } from "lucide-react";
import StatusMessage from "../components/StatusMessage.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { api } from "../lib/api.js";
import { getToken, saveSession } from "../lib/auth.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const fillDemoCredentials = () => {
    setEmail("admin@example.com");
    setPassword("change-me-please");
  };

  return (
    <div className="narrow mx-auto max-w-[440px] py-6 sm:py-12">
      <Card className="border-border/80 shadow-md">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <KeyRound className="size-5" />
            </div>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
              title="Click to fill seed credentials"
            >
              Fill seed credentials
            </button>
          </div>

          <div>
            <p className="eyebrow m-0 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Admin access
            </p>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground mt-1">
              Log in
            </CardTitle>
            <CardDescription className="muted text-sm text-muted-foreground mt-1.5">
              Sign in with the admin account created by the seed script.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-5">
              <StatusMessage tone="error">{error}</StatusMessage>
            </div>
          )}

          <form className="form grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label htmlFor="login-email" className="text-xs font-semibold text-foreground">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold text-foreground">
                  Password
                </label>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="button w-full h-10 gap-2 font-medium"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogInIcon className="size-4" />
                    <span>Sign in</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-border/60 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 m-0">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              Protected by JWT &amp; role-based access control
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

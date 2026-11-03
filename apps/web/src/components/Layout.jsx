import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Terminal, Shield, LogOut, LogIn, BookOpen, Layers } from "lucide-react";
import { clearSession, getToken, getUser } from "../lib/auth.js";
import { ThemeToggle } from "./ui/theme-toggle.jsx";
import { Avatar, AvatarFallback } from "./ui/avatar.jsx";
import { Badge } from "./ui/badge.jsx";

export default function Layout() {
  const navigate = useNavigate();
  const authenticated = Boolean(getToken());
  const user = getUser();

  function handleLogout() {
    clearSession();
    navigate("/");
  }

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  return (
    <div className="app-shell min-h-screen flex flex-col bg-background text-foreground transition-colors duration-150">
      <header className="site-header border-b border-border/80 sticky top-0 z-40 bg-background/80 backdrop-blur-md">
        <div className="container header-inner flex items-center justify-between h-15">
          <Link
            to="/"
            className="brand flex items-center gap-2.5 text-foreground hover:opacity-90 transition-opacity"
            aria-label="DevOps Blog"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Terminal className="size-4" />
            </div>
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-base">
              <span>DevOps</span>
              <span className="text-muted-foreground font-medium">Blog</span>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] px-1.5 py-0 h-4.5 font-mono text-muted-foreground border-border/80">
              v1.0
            </Badge>
          </Link>

          <nav className="nav flex items-center gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? "bg-secondary text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`
              }
            >
              <BookOpen className="size-3.5" />
              <span>Posts</span>
            </NavLink>

            {authenticated ? (
              <>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      isActive
                        ? "bg-secondary text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`
                  }
                >
                  <Shield className="size-3.5 text-primary" />
                  <span>Admin</span>
                </NavLink>

                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-border/60">
                  <Avatar className="size-7 border border-border">
                    <AvatarFallback className="text-[11px] font-semibold bg-muted text-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-muted-foreground max-w-[100px] truncate">
                    {user?.name || "Admin"}
                  </span>
                </div>

                <button
                  type="button"
                  className="link-button flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive px-2.5 py-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut className="size-3.5" />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    isActive
                      ? "bg-secondary text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                <LogIn className="size-3.5" />
                <span>Log in</span>
              </NavLink>
            )}

            <div className="pl-1 border-l border-border/60 ml-1">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>

      <main className="container main-content flex-1 py-8">
        <Outlet />
      </main>

      <footer className="site-footer border-t border-border/80 bg-card text-muted-foreground mt-auto py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-6 items-center justify-center rounded-md bg-muted text-foreground">
              <Layers className="size-3.5" />
            </div>
            <p className="m-0">
              DevOps Blog — automated deployment with Coolify &amp; GHCR.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              CI/CD Pipeline Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

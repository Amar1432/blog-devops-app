import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getToken } from "../lib/auth.js";

export default function Layout() {
  const navigate = useNavigate();
  const authenticated = Boolean(getToken());

  function handleLogout() {
    clearSession();
    navigate("/");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            DevOps<span>Blog</span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Posts
            </NavLink>
            {authenticated ? (
              <>
                <NavLink to="/admin">Admin</NavLink>
                <button type="button" className="link-button" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/login">Log in</NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="container main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>DevOps Blog — built as a learning project.</p>
        </div>
      </footer>
    </div>
  );
}

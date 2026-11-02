import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ProtectedRoute from "./ProtectedRoute.jsx";

function LocationProbe() {
  const location = useLocation();
  return <p>at {location.pathname}</p>;
}

function renderRoute(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <p>admin page</p>
            </ProtectedRoute>
          }
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  it("redirects anonymous visitors to the login page", () => {
    renderRoute("/admin");

    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("admin page")).not.toBeInTheDocument();
    expect(screen.getByText("at /login")).toBeInTheDocument();
  });

  it("renders protected content when a token exists", () => {
    localStorage.setItem("devops_blog_token", "token-123");

    renderRoute("/admin");

    expect(screen.getByText("admin page")).toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });
});

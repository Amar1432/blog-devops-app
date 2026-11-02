import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Layout from "./Layout.jsx";

function renderLayout(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>home content</p>} />
          <Route path="admin" element={<p>admin content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("Layout", () => {
  it("shows a login link to anonymous visitors", () => {
    renderLayout();

    expect(screen.getByRole("link", { name: "DevOps Blog" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Posts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByText("home content")).toBeInTheDocument();
  });

  it("shows admin navigation and logout to authenticated users", () => {
    localStorage.setItem("devops_blog_token", "token-123");

    renderLayout();

    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("clears the session and returns home on logout", async () => {
    const user = userEvent.setup();
    localStorage.setItem("devops_blog_token", "token-123");
    localStorage.setItem("devops_blog_user", JSON.stringify({ id: 1 }));

    renderLayout("/admin");
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(localStorage.getItem("devops_blog_token")).toBeNull();
    expect(localStorage.getItem("devops_blog_user")).toBeNull();
    expect(screen.getByText("home content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  });
});

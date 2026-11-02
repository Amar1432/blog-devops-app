import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { api } from "./lib/api.js";

vi.mock("./lib/api.js", () => ({
  api: {
    getPublishedPosts: vi.fn(),
    getPublishedPost: vi.fn(),
    login: vi.fn(),
    getAdminPosts: vi.fn(),
    getAdminPost: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
  },
}));

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("App routing", () => {
  beforeEach(() => {
    api.getPublishedPosts.mockReset().mockResolvedValue({ posts: [] });
    api.getAdminPosts.mockReset().mockResolvedValue({ posts: [] });
  });

  it("renders the home page at the root route", async () => {
    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "Learning DevOps in public." })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No posts have been published yet. Check back soon.")
    ).toBeInTheDocument();
  });

  it("renders the not-found page for unknown routes", () => {
    renderApp("/this-does-not-exist");

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("redirects anonymous visitors from the dashboard to login", () => {
    renderApp("/admin");

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Manage posts" })).not.toBeInTheDocument();
  });

  it("renders the admin dashboard for authenticated visitors", async () => {
    localStorage.setItem("devops_blog_token", "token-123");

    renderApp("/admin");

    expect(screen.getByRole("heading", { name: "Manage posts" })).toBeInTheDocument();
    expect(
      await screen.findByText("No posts yet. Create your first post to get started.")
    ).toBeInTheDocument();
  });
});

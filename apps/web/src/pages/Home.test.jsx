import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import Home from "./Home.jsx";

vi.mock("../lib/api.js", () => ({
  api: {
    getPublishedPosts: vi.fn(),
  },
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

describe("Home", () => {
  beforeEach(() => {
    api.getPublishedPosts.mockReset();
  });

  it("shows a loading message while posts are fetched", () => {
    api.getPublishedPosts.mockReturnValue(new Promise(() => {}));

    renderHome();

    expect(screen.getByText("Loading posts...")).toBeInTheDocument();
  });

  it("renders published posts with metadata and links", async () => {
    api.getPublishedPosts.mockResolvedValue({
      posts: [
        {
          id: 1,
          slug: "first-post",
          title: "First post",
          excerpt: "A short excerpt",
          publishedAt: "2026-01-02T10:00:00.000Z",
          author: { name: "Ada" },
        },
      ],
    });

    renderHome();

    expect(await screen.findByRole("heading", { name: "First post" })).toBeInTheDocument();
    expect(screen.getByText("A short excerpt")).toBeInTheDocument();
    expect(
      screen.getByText(`${formatDate("2026-01-02T10:00:00.000Z")} · Ada`)
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /first post|read post/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /first post|read post/i })[0]).toHaveAttribute(
      "href",
      "/posts/first-post"
    );
  });

  it("omits the excerpt and author when they are not present", async () => {
    api.getPublishedPosts.mockResolvedValue({
      posts: [
        {
          id: 1,
          slug: "bare-post",
          title: "Bare post",
          createdAt: "2026-01-02T10:00:00.000Z",
        },
      ],
    });

    renderHome();

    expect(await screen.findByRole("heading", { name: "Bare post" })).toBeInTheDocument();
    expect(
      screen.getByText(formatDate("2026-01-02T10:00:00.000Z"))
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read post" })).toHaveAttribute(
      "href",
      "/posts/bare-post"
    );
  });

  it("shows an empty state when no posts are published", async () => {
    api.getPublishedPosts.mockResolvedValue({ posts: [] });

    renderHome();

    expect(
      await screen.findByText("No posts have been published yet. Check back soon.")
    ).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    api.getPublishedPosts.mockRejectedValue(new Error("Network down"));

    renderHome();

    expect(await screen.findByText("Network down")).toBeInTheDocument();
    expect(screen.queryByText("Loading posts...")).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/format.js";
import PostDetail from "./PostDetail.jsx";

vi.mock("../lib/api.js", () => ({
  api: {
    getPublishedPost: vi.fn(),
  },
}));

function renderPost(path = "/posts/first-post") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/posts/:slug" element={<PostDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PostDetail", () => {
  beforeEach(() => {
    api.getPublishedPost.mockReset();
  });

  it("shows a loading message first", () => {
    api.getPublishedPost.mockReturnValue(new Promise(() => {}));

    renderPost();

    expect(screen.getByText("Loading post...")).toBeInTheDocument();
  });

  it("requests the post by slug and renders its content", async () => {
    api.getPublishedPost.mockResolvedValue({
      post: {
        id: 1,
        slug: "first-post",
        title: "First post",
        excerpt: "A short excerpt",
        content: "The full article body",
        publishedAt: "2026-01-02T10:00:00.000Z",
        author: { name: "Ada" },
      },
    });

    renderPost();

    expect(await screen.findByRole("heading", { name: "First post" })).toBeInTheDocument();
    expect(api.getPublishedPost).toHaveBeenCalledWith("first-post");
    expect(screen.getByText("A short excerpt")).toBeInTheDocument();
    expect(screen.getByText("The full article body")).toBeInTheDocument();
    expect(
      screen.getByText(`${formatDate("2026-01-02T10:00:00.000Z")} · Ada`)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all posts" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("omits the excerpt and author when they are not present", async () => {
    api.getPublishedPost.mockResolvedValue({
      post: {
        id: 1,
        slug: "bare-post",
        title: "Bare post",
        content: "Body only",
        createdAt: "2026-01-02T10:00:00.000Z",
      },
    });

    renderPost("/posts/bare-post");

    expect(await screen.findByRole("heading", { name: "Bare post" })).toBeInTheDocument();
    expect(
      screen.getByText(formatDate("2026-01-02T10:00:00.000Z"))
    ).toBeInTheDocument();
    expect(screen.getByText("Body only")).toBeInTheDocument();
  });

  it("renders nothing when the API returns no post", async () => {
    api.getPublishedPost.mockResolvedValue({ post: null });

    const { container } = renderPost("/posts/gone");

    await waitFor(() => {
      expect(screen.queryByText("Loading post...")).not.toBeInTheDocument();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an error with a way back when the post cannot be loaded", async () => {
    api.getPublishedPost.mockRejectedValue(new Error("Post not found"));

    renderPost("/posts/missing");

    expect(await screen.findByText("Post not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all posts" })).toHaveAttribute(
      "href",
      "/"
    );
  });
});

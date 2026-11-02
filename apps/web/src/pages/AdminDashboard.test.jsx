import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api.js";
import AdminDashboard from "./AdminDashboard.jsx";

vi.mock("../lib/api.js", () => ({
  api: {
    getAdminPosts: vi.fn(),
    deletePost: vi.fn(),
  },
}));

const publishedPost = {
  id: 1,
  slug: "first-post",
  title: "First post",
  published: true,
  updatedAt: "2026-01-02T10:00:00.000Z",
};

const draftPost = {
  id: 2,
  slug: "draft-post",
  title: "Draft post",
  published: false,
  updatedAt: "2026-01-03T10:00:00.000Z",
};

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminDashboard", () => {
  beforeEach(() => {
    localStorage.setItem("devops_blog_token", "token-123");
    api.getAdminPosts.mockReset();
    api.deletePost.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading message while posts are fetched", () => {
    api.getAdminPosts.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByText("Loading posts...")).toBeInTheDocument();
  });

  it("lists posts with status badges and row actions", async () => {
    api.getAdminPosts.mockResolvedValue({ posts: [publishedPost, draftPost] });

    renderDashboard();

    expect(await screen.findByText("First post")).toBeInTheDocument();
    expect(screen.getByText("Draft post")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(api.getAdminPosts).toHaveBeenCalledWith("token-123");

    expect(screen.getAllByRole("link", { name: "View" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Edit" })[0]).toHaveAttribute(
      "href",
      "/admin/posts/1/edit"
    );
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("shows an empty state when there are no posts", async () => {
    api.getAdminPosts.mockResolvedValue({ posts: [] });

    renderDashboard();

    expect(
      await screen.findByText("No posts yet. Create your first post to get started.")
    ).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    api.getAdminPosts.mockRejectedValue(new Error("Unable to load posts"));

    renderDashboard();

    expect(await screen.findByText("Unable to load posts")).toBeInTheDocument();
  });

  it("logs out and redirects on a 401 response", async () => {
    api.getAdminPosts.mockRejectedValue({ status: 401, message: "Unauthorized" });

    renderDashboard();

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(localStorage.getItem("devops_blog_token")).toBeNull();
  });

  it("deletes a post after confirmation and removes the row", async () => {
    const user = userEvent.setup();
    api.getAdminPosts.mockResolvedValue({ posts: [publishedPost, draftPost] });
    api.deletePost.mockResolvedValue(null);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();
    await screen.findByText("First post");

    const row = screen.getByText("First post").closest("tr");
    await user.click(within(row).getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Delete "First post"? This cannot be undone.'
    );
    expect(api.deletePost).toHaveBeenCalledWith("token-123", 1);
    await waitFor(() => {
      expect(screen.queryByText("First post")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Draft post")).toBeInTheDocument();
  });

  it("shows an error and keeps the row when deletion fails", async () => {
    const user = userEvent.setup();
    api.getAdminPosts.mockResolvedValue({ posts: [publishedPost] });
    api.deletePost.mockRejectedValue(new Error("Could not delete post"));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();
    await screen.findByText("First post");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Could not delete post")).toBeInTheDocument();
    expect(screen.getByText("First post")).toBeInTheDocument();
  });

  it("logs out and redirects when deletion returns 401", async () => {
    const user = userEvent.setup();
    api.getAdminPosts.mockResolvedValue({ posts: [publishedPost] });
    api.deletePost.mockRejectedValue({ status: 401, message: "Unauthorized" });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();
    await screen.findByText("First post");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(localStorage.getItem("devops_blog_token")).toBeNull();
  });

  it("does not delete when confirmation is dismissed", async () => {
    const user = userEvent.setup();
    api.getAdminPosts.mockResolvedValue({ posts: [publishedPost] });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderDashboard();
    await screen.findByText("First post");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(api.deletePost).not.toHaveBeenCalled();
    expect(screen.getByText("First post")).toBeInTheDocument();
  });
});

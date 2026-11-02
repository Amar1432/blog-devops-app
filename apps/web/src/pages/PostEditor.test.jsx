import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api.js";
import PostEditor from "./PostEditor.jsx";

vi.mock("../lib/api.js", () => ({
  api: {
    getAdminPost: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
  },
}));

function EditRedirectProbe() {
  const { id } = useParams();
  return <p>editing post {id}</p>;
}

function renderNewEditor() {
  return render(
    <MemoryRouter initialEntries={["/admin/posts/new"]}>
      <Routes>
        <Route path="/admin/posts/new" element={<PostEditor />} />
        <Route path="/admin/posts/:id/edit" element={<EditRedirectProbe />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEditEditor(postId = "7") {
  return render(
    <MemoryRouter initialEntries={[`/admin/posts/${postId}/edit`]}>
      <Routes>
        <Route path="/admin/posts/:id/edit" element={<PostEditor />} />
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/posts/:slug" element={<p>public post</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const existingPost = {
  id: 7,
  title: "First post",
  slug: "first-post",
  excerpt: "Old excerpt",
  content: "Old body",
  published: true,
};

describe("PostEditor", () => {
  beforeEach(() => {
    localStorage.setItem("devops_blog_token", "token-123");
    api.getAdminPost.mockReset();
    api.createPost.mockReset();
    api.updatePost.mockReset();
  });

  it("creates a new post and redirects to its edit page", async () => {
    const user = userEvent.setup();
    api.createPost.mockResolvedValue({ post: { id: 9 } });

    renderNewEditor();

    expect(screen.getByRole("heading", { name: "New post" })).toBeInTheDocument();
    expect(api.getAdminPost).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Title"), "New post");
    await user.type(screen.getByLabelText("Content"), "Fresh body");
    await user.click(screen.getByRole("checkbox", { name: "Published" }));
    await user.click(screen.getByRole("button", { name: "Create post" }));

    expect(api.createPost).toHaveBeenCalledWith("token-123", {
      title: "New post",
      excerpt: null,
      content: "Fresh body",
      published: true,
    });
    expect(api.createPost.mock.calls[0][1]).not.toHaveProperty("slug");
    expect(await screen.findByText("editing post 9")).toBeInTheDocument();
  });

  it("loads an existing post into the edit form", async () => {
    api.getAdminPost.mockResolvedValue({ post: existingPost });

    renderEditEditor();

    expect(await screen.findByDisplayValue("First post")).toBeInTheDocument();
    expect(api.getAdminPost).toHaveBeenCalledWith("token-123", "7");
    expect(screen.getByRole("heading", { name: "Edit post" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Slug/)).toHaveValue("first-post");
    expect(screen.getByLabelText("Excerpt")).toHaveValue("Old excerpt");
    expect(screen.getByLabelText("Content")).toHaveValue("Old body");
    expect(screen.getByRole("checkbox", { name: "Published" })).toBeChecked();
    expect(screen.getByRole("link", { name: "View published post" })).toHaveAttribute(
      "href",
      "/posts/first-post"
    );
  });

  it("saves changes to an existing post", async () => {
    const user = userEvent.setup();
    api.getAdminPost.mockResolvedValue({ post: existingPost });
    api.updatePost.mockResolvedValue({ post: existingPost });

    renderEditEditor();
    const titleInput = await screen.findByDisplayValue("First post");

    await user.clear(titleInput);
    await user.type(titleInput, "Updated title");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(api.updatePost).toHaveBeenCalledWith("token-123", "7", {
      title: "Updated title",
      slug: "first-post",
      excerpt: "Old excerpt",
      content: "Old body",
      published: true,
    });
    expect(await screen.findByText(/Saved at/)).toBeInTheDocument();
  });

  it("shows a save error and keeps the form editable", async () => {
    const user = userEvent.setup();
    api.getAdminPost.mockResolvedValue({ post: existingPost });
    api.updatePost.mockRejectedValue(new Error("Slug already exists"));

    renderEditEditor();
    await screen.findByDisplayValue("First post");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Slug already exists")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeEnabled();
  });

  it("shows an error when an existing post cannot be loaded", async () => {
    api.getAdminPost.mockRejectedValue(new Error("Post not found"));

    renderEditEditor();

    expect(await screen.findByText("Post not found")).toBeInTheDocument();
    expect(screen.queryByText("Loading post...")).not.toBeInTheDocument();
  });

  it("logs out and redirects when saving returns 401", async () => {
    const user = userEvent.setup();
    api.createPost.mockRejectedValue({ status: 401, message: "Unauthorized" });

    renderNewEditor();
    await user.type(screen.getByLabelText("Title"), "New post");
    await user.type(screen.getByLabelText("Content"), "Fresh body");
    await user.click(screen.getByRole("button", { name: "Create post" }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(localStorage.getItem("devops_blog_token")).toBeNull();
  });

  it("logs out and redirects when loading the post returns 401", async () => {
    api.getAdminPost.mockRejectedValue({ status: 401, message: "Unauthorized" });

    renderEditEditor();

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(localStorage.getItem("devops_blog_token")).toBeNull();
  });
});

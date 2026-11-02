import { afterAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  createPost,
  deletePost,
  getPostById,
  getPublishedPost,
  listAllPosts,
  listPublishedPosts,
  updatePost,
} from "../../src/controllers/postController.js";
import { createTestAdmin, prisma, resetDatabase } from "../helpers/db.js";

let admin;

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function makePost(overrides = {}) {
  return prisma.post.create({
    data: {
      title: "A Post",
      slug: `a-post-${Math.random().toString(36).slice(2, 8)}`,
      content: "Body",
      authorId: admin.user.id,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
  admin = await createTestAdmin();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createPost", () => {
  test("creates a draft with a generated slug", async () => {
    const req = {
      body: { title: "Hello DevOps World", content: "Body text" },
      user: { id: admin.user.id },
    };
    const res = mockResponse();
    const next = jest.fn();

    await createPost(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const { post } = res.json.mock.calls[0][0];
    expect(post.slug).toBe("hello-devops-world");
    expect(post.published).toBe(false);
    expect(post.publishedAt).toBeNull();
    expect(post.author.id).toBe(admin.user.id);

    const stored = await prisma.post.findUnique({ where: { id: post.id } });
    expect(stored).not.toBeNull();
  });

  test("sets publishedAt when created as published", async () => {
    const req = {
      body: { title: "Published", content: "Body", published: true },
      user: { id: admin.user.id },
    };
    const res = mockResponse();

    await createPost(req, res, jest.fn());

    const { post } = res.json.mock.calls[0][0];
    expect(post.published).toBe(true);
    expect(post.publishedAt).toBeInstanceOf(Date);
  });

  test("de-duplicates generated slugs", async () => {
    await makePost({ title: "Repeat Me", slug: "repeat-me" });

    const req = {
      body: { title: "Repeat Me", content: "Body" },
      user: { id: admin.user.id },
    };
    const res = mockResponse();

    await createPost(req, res, jest.fn());

    expect(res.json.mock.calls[0][0].post.slug).toBe("repeat-me-2");
  });

  test("forwards a unique conflict for an explicit duplicate slug", async () => {
    await makePost({ slug: "taken-slug" });

    const req = {
      body: { title: "Another", slug: "taken-slug", content: "Body" },
      user: { id: admin.user.id },
    };
    const next = jest.fn();

    await createPost(req, mockResponse(), next);

    expect(next.mock.calls[0][0].code).toBe("P2002");
  });
});

describe("listPublishedPosts", () => {
  test("returns only published posts, newest first", async () => {
    await makePost({ title: "Draft", published: false });
    await makePost({
      title: "Older",
      published: true,
      publishedAt: new Date("2025-01-01T00:00:00Z"),
    });
    await makePost({
      title: "Newer",
      published: true,
      publishedAt: new Date("2025-02-01T00:00:00Z"),
    });

    const res = mockResponse();
    await listPublishedPosts({}, res, jest.fn());

    const titles = res.json.mock.calls[0][0].posts.map((post) => post.title);
    expect(titles).toEqual(["Newer", "Older"]);
  });

  test("omits full content from list responses", async () => {
    await makePost({ published: true, publishedAt: new Date(), content: "Secret body" });

    const res = mockResponse();
    await listPublishedPosts({}, res, jest.fn());

    expect(res.json.mock.calls[0][0].posts[0].content).toBeUndefined();
  });
});

describe("getPublishedPost", () => {
  test("returns a published post with content", async () => {
    const post = await makePost({
      slug: "readable",
      published: true,
      publishedAt: new Date(),
      content: "Full content",
    });

    const res = mockResponse();
    await getPublishedPost({ params: { slug: post.slug } }, res, jest.fn());

    expect(res.json.mock.calls[0][0].post.content).toBe("Full content");
  });

  test("returns 404 for a draft", async () => {
    const post = await makePost({ slug: "draft-only", published: false });
    const next = jest.fn();

    await getPublishedPost({ params: { slug: post.slug } }, mockResponse(), next);

    expect(next.mock.calls[0][0].status).toBe(404);
  });

  test("returns 404 for an unknown slug", async () => {
    const next = jest.fn();
    await getPublishedPost({ params: { slug: "missing" } }, mockResponse(), next);
    expect(next.mock.calls[0][0].status).toBe(404);
  });
});

describe("updatePost", () => {
  test("updates the title without changing the slug", async () => {
    const post = await makePost({ slug: "stable-slug", title: "Old" });

    const req = { params: { id: post.id }, body: { title: "New title" } };
    const res = mockResponse();

    await updatePost(req, res, jest.fn());

    const updated = res.json.mock.calls[0][0].post;
    expect(updated.title).toBe("New title");
    expect(updated.slug).toBe("stable-slug");
  });

  test("sets publishedAt on first publish", async () => {
    const post = await makePost({ published: false, publishedAt: null });
    const req = { params: { id: post.id }, body: { published: true } };
    const res = mockResponse();

    await updatePost(req, res, jest.fn());

    expect(res.json.mock.calls[0][0].post.publishedAt).not.toBeNull();
  });

  test("keeps publishedAt when unpublishing and republishing", async () => {
    const originalDate = new Date("2024-06-01T12:00:00Z");
    const post = await makePost({ published: true, publishedAt: originalDate });

    const unpublishReq = { params: { id: post.id }, body: { published: false } };
    const unpublishRes = mockResponse();
    await updatePost(unpublishReq, unpublishRes, jest.fn());
    const unpublishedAt = unpublishRes.json.mock.calls[0][0].post.publishedAt;

    const republishReq = { params: { id: post.id }, body: { published: true } };
    const republishRes = mockResponse();
    await updatePost(republishReq, republishRes, jest.fn());

    const republishedAt = republishRes.json.mock.calls[0][0].post.publishedAt;
    expect(unpublishedAt).toEqual(originalDate);
    expect(republishedAt).toEqual(originalDate);
  });

  test("allows changing the slug explicitly", async () => {
    const post = await makePost({ slug: "old-slug" });
    const req = { params: { id: post.id }, body: { slug: "new-slug" } };
    const res = mockResponse();

    await updatePost(req, res, jest.fn());

    expect(res.json.mock.calls[0][0].post.slug).toBe("new-slug");
  });

  test("returns 404 for an unknown id", async () => {
    const next = jest.fn();

    await updatePost(
      { params: { id: "missing" }, body: { title: "x" } },
      mockResponse(),
      next
    );

    expect(next.mock.calls[0][0].status).toBe(404);
  });
});

describe("deletePost", () => {
  test("deletes the post and responds 204", async () => {
    const post = await makePost();
    const res = mockResponse();

    await deletePost({ params: { id: post.id } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    await expect(prisma.post.findUnique({ where: { id: post.id } })).resolves.toBeNull();
  });

  test("returns 404 for an unknown id", async () => {
    const next = jest.fn();
    await deletePost({ params: { id: "missing" } }, mockResponse(), next);
    expect(next.mock.calls[0][0].status).toBe(404);
  });
});

describe("admin post reads", () => {
  test("listAllPosts includes drafts", async () => {
    await makePost({ title: "Draft", published: false });
    await makePost({ title: "Live", published: true, publishedAt: new Date() });

    const res = mockResponse();
    await listAllPosts({}, res, jest.fn());

    const titles = res.json.mock.calls[0][0].posts.map((post) => post.title).sort();
    expect(titles).toEqual(["Draft", "Live"]);
  });

  test("getPostById returns drafts with content", async () => {
    const post = await makePost({ published: false, content: "Draft body" });
    const res = mockResponse();

    await getPostById({ params: { id: post.id } }, res, jest.fn());

    expect(res.json.mock.calls[0][0].post.content).toBe("Draft body");
  });

  test("getPostById returns 404 for an unknown id", async () => {
    const next = jest.fn();
    await getPostById({ params: { id: "missing" } }, mockResponse(), next);
    expect(next.mock.calls[0][0].status).toBe(404);
  });
});

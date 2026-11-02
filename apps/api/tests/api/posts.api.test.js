import { afterAll, beforeEach, describe, expect, test } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTestAdmin, prisma, resetDatabase } from "../helpers/db.js";
import { authHeader, getToken } from "../helpers/auth.js";

let token;

beforeEach(async () => {
  await resetDatabase();
  await createTestAdmin();
  token = await getToken(app);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createPost(payload, options = {}) {
  const agent = request(app)
    .post("/api/posts")
    .set(options.authorized === false ? {} : authHeader(token));

  return agent.send(payload);
}

describe("public post reads", () => {
  test("returns an empty list when nothing is published", async () => {
    const response = await request(app).get("/api/posts");
    expect(response.status).toBe(200);
    expect(response.body.posts).toEqual([]);
  });

  test("returns 404 for an unknown slug", async () => {
    const response = await request(app).get("/api/posts/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/posts", () => {
  test("requires authentication", async () => {
    const response = await createPost(
      { title: "Unauthorized", content: "Body" },
      { authorized: false }
    );

    expect(response.status).toBe(401);
  });

  test("validates the payload", async () => {
    const response = await createPost({ title: "", content: "" });

    expect(response.status).toBe(422);
    expect(response.body.error.details.fieldErrors.title).toBeDefined();
    expect(response.body.error.details.fieldErrors.content).toBeDefined();
  });

  test("rejects an invalid explicit slug", async () => {
    const response = await createPost({
      title: "Title",
      content: "Body",
      slug: "Not Valid",
    });

    expect(response.status).toBe(422);
  });

  test("creates a draft and keeps it out of public reads", async () => {
    const created = await createPost({ title: "Draft Post", content: "Draft body" });

    expect(created.status).toBe(201);
    expect(created.body.post).toMatchObject({
      title: "Draft Post",
      slug: "draft-post",
      published: false,
      publishedAt: null,
    });

    const list = await request(app).get("/api/posts");
    expect(list.body.posts).toEqual([]);

    const detail = await request(app).get("/api/posts/draft-post");
    expect(detail.status).toBe(404);
  });

  test("creates a published post visible to the public", async () => {
    const created = await createPost({
      title: "Live Post",
      excerpt: "Summary",
      content: "Line one.\n\nLine two.",
      published: true,
    });

    expect(created.status).toBe(201);
    expect(created.body.post.publishedAt).not.toBeNull();

    const list = await request(app).get("/api/posts");
    expect(list.body.posts).toHaveLength(1);
    expect(list.body.posts[0].slug).toBe("live-post");
    expect(list.body.posts[0].content).toBeUndefined();

    const detail = await request(app).get("/api/posts/live-post");
    expect(detail.status).toBe(200);
    expect(detail.body.post.content).toBe("Line one.\n\nLine two.");
  });

  test("returns 409 for a duplicate explicit slug", async () => {
    await createPost({ title: "First", slug: "shared-slug", content: "Body" });

    const response = await createPost({
      title: "Second",
      slug: "shared-slug",
      content: "Body",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  test("generates unique slugs for duplicate titles", async () => {
    await createPost({ title: "Same Title", content: "One" });
    const second = await createPost({ title: "Same Title", content: "Two" });

    expect(second.status).toBe(201);
    expect(second.body.post.slug).toBe("same-title-2");
  });
});

describe("PUT /api/posts/:id", () => {
  test("requires authentication", async () => {
    const created = await createPost({ title: "Edit Me", content: "Body" });

    const response = await request(app)
      .put(`/api/posts/${created.body.post.id}`)
      .send({ title: "Changed" });

    expect(response.status).toBe(401);
  });

  test("rejects an empty update", async () => {
    const created = await createPost({ title: "Edit Me", content: "Body" });

    const response = await request(app)
      .put(`/api/posts/${created.body.post.id}`)
      .set(authHeader(token))
      .send({});

    expect(response.status).toBe(422);
  });

  test("publishes a draft and exposes it publicly", async () => {
    const created = await createPost({ title: "Soon Live", content: "Body" });

    const update = await request(app)
      .put(`/api/posts/${created.body.post.id}`)
      .set(authHeader(token))
      .send({ published: true });

    expect(update.status).toBe(200);
    expect(update.body.post.publishedAt).not.toBeNull();

    const detail = await request(app).get("/api/posts/soon-live");
    expect(detail.status).toBe(200);
  });

  test("returns 404 for an unknown post", async () => {
    const response = await request(app)
      .put("/api/posts/missing")
      .set(authHeader(token))
      .send({ title: "Changed" });

    expect(response.status).toBe(404);
  });

  test("rejects a slug that is already taken", async () => {
    await createPost({ title: "Taken", slug: "taken", content: "Body" });
    const second = await createPost({ title: "Second", content: "Body" });

    const response = await request(app)
      .put(`/api/posts/${second.body.post.id}`)
      .set(authHeader(token))
      .send({ slug: "taken" });

    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/posts/:id", () => {
  test("requires authentication", async () => {
    const created = await createPost({ title: "Protected", content: "Body" });

    const response = await request(app).delete(`/api/posts/${created.body.post.id}`);
    expect(response.status).toBe(401);
  });

  test("deletes the post", async () => {
    const created = await createPost({ title: "Delete Me", content: "Body" });

    const response = await request(app)
      .delete(`/api/posts/${created.body.post.id}`)
      .set(authHeader(token));

    expect(response.status).toBe(204);

    const detail = await request(app).get("/api/posts/delete-me");
    expect(detail.status).toBe(404);
  });

  test("returns 404 for an unknown post", async () => {
    const response = await request(app)
      .delete("/api/posts/missing")
      .set(authHeader(token));

    expect(response.status).toBe(404);
  });
});

describe("admin post endpoints", () => {
  test("require authentication", async () => {
    expect((await request(app).get("/api/admin/posts")).status).toBe(401);
    expect((await request(app).get("/api/admin/posts/any")).status).toBe(401);
  });

  test("list drafts and published posts", async () => {
    await createPost({ title: "Draft", content: "Body" });
    await createPost({ title: "Live", content: "Body", published: true });

    const response = await request(app)
      .get("/api/admin/posts")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.posts).toHaveLength(2);
    expect(response.body.posts.map((post) => post.title).sort()).toEqual([
      "Draft",
      "Live",
    ]);
  });

  test("return a draft by id with its content", async () => {
    const created = await createPost({ title: "Draft Detail", content: "Hidden body" });

    const response = await request(app)
      .get(`/api/admin/posts/${created.body.post.id}`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.post.content).toBe("Hidden body");
  });

  test("return 404 for an unknown id", async () => {
    const response = await request(app)
      .get("/api/admin/posts/missing")
      .set(authHeader(token));

    expect(response.status).toBe(404);
  });
});

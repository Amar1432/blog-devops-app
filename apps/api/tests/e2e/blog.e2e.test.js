import { afterAll, beforeEach, describe, expect, test } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTestAdmin, prisma, resetDatabase, TEST_ADMIN } from "../helpers/db.js";
import { authHeader, getToken } from "../helpers/auth.js";

beforeEach(async () => {
  await resetDatabase();
  await createTestAdmin();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("blog lifecycle", () => {
  test("publish, read, edit, unpublish, republish and delete a post", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    expect(login.status).toBe(200);
    const token = login.body.token;

    const created = await request(app)
      .post("/api/posts")
      .set(authHeader(token))
      .send({
        title: "Deploying With Confidence",
        excerpt: "A short field note.",
        content: "First paragraph.\n\nSecond paragraph.",
        published: false,
      });
    expect(created.status).toBe(201);
    const post = created.body.post;
    expect(post.slug).toBe("deploying-with-confidence");

    const draftList = await request(app).get("/api/posts");
    expect(draftList.body.posts).toEqual([]);

    const publish = await request(app)
      .put(`/api/posts/${post.id}`)
      .set(authHeader(token))
      .send({ published: true });
    expect(publish.status).toBe(200);
    const firstPublishedAt = publish.body.post.publishedAt;
    expect(firstPublishedAt).not.toBeNull();

    const publicList = await request(app).get("/api/posts");
    expect(publicList.body.posts.map((item) => item.slug)).toEqual([
      "deploying-with-confidence",
    ]);

    const publicDetail = await request(app).get("/api/posts/deploying-with-confidence");
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body.post.content).toBe("First paragraph.\n\nSecond paragraph.");

    const edit = await request(app)
      .put(`/api/posts/${post.id}`)
      .set(authHeader(token))
      .send({ title: "Deploying With Confidence, Part 2", content: "Updated body." });
    expect(edit.status).toBe(200);
    expect(edit.body.post.title).toBe("Deploying With Confidence, Part 2");
    expect(edit.body.post.slug).toBe("deploying-with-confidence");

    const editedDetail = await request(app).get(
      "/api/posts/deploying-with-confidence"
    );
    expect(editedDetail.body.post.content).toBe("Updated body.");

    const unpublish = await request(app)
      .put(`/api/posts/${post.id}`)
      .set(authHeader(token))
      .send({ published: false });
    expect(unpublish.status).toBe(200);

    expect((await request(app).get("/api/posts")).body.posts).toEqual([]);
    expect(
      (await request(app).get("/api/posts/deploying-with-confidence")).status
    ).toBe(404);

    const adminList = await request(app)
      .get("/api/admin/posts")
      .set(authHeader(token));
    expect(adminList.body.posts).toHaveLength(1);
    expect(adminList.body.posts[0].published).toBe(false);

    const republish = await request(app)
      .put(`/api/posts/${post.id}`)
      .set(authHeader(token))
      .send({ published: true });
    expect(republish.body.post.publishedAt).toBe(firstPublishedAt);

    const remove = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set(authHeader(token));
    expect(remove.status).toBe(204);

    expect((await request(app).get("/api/posts")).body.posts).toEqual([]);
    expect(
      (await request(app).get("/api/posts/deploying-with-confidence")).status
    ).toBe(404);

    const emptyAdminList = await request(app)
      .get("/api/admin/posts")
      .set(authHeader(token));
    expect(emptyAdminList.body.posts).toEqual([]);
  });

  test("anonymous users cannot create, edit or delete posts", async () => {
    const token = await getToken(app);

    const created = await request(app)
      .post("/api/posts")
      .set(authHeader(token))
      .send({ title: "Guarded", content: "Body" });
    expect(created.status).toBe(201);

    const anonymousCreate = await request(app)
      .post("/api/posts")
      .send({ title: "Nope", content: "Body" });
    expect(anonymousCreate.status).toBe(401);

    const anonymousUpdate = await request(app)
      .put(`/api/posts/${created.body.post.id}`)
      .send({ title: "Hijacked" });
    expect(anonymousUpdate.status).toBe(401);

    const anonymousDelete = await request(app).delete(
      `/api/posts/${created.body.post.id}`
    );
    expect(anonymousDelete.status).toBe(401);

    const stillThere = await request(app)
      .get(`/api/admin/posts/${created.body.post.id}`)
      .set(authHeader(token));
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.post.title).toBe("Guarded");
  });
});

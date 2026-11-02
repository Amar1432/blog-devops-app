import { describe, expect, test } from "@jest/globals";
import { loginSchema } from "../../src/validators/auth.js";
import { createPostSchema, updatePostSchema } from "../../src/validators/post.js";

describe("loginSchema", () => {
  test("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "admin@example.com",
      password: "secret",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "secret" });
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.email).toBeDefined();
  });

  test("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "admin@example.com" });
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.password).toBeDefined();
  });
});

describe("createPostSchema", () => {
  test("accepts the minimal payload", () => {
    const result = createPostSchema.safeParse({ title: "Title", content: "Body" });
    expect(result.success).toBe(true);
  });

  test("trims title and accepts a null excerpt", () => {
    const result = createPostSchema.safeParse({
      title: "  Title  ",
      content: "Body",
      excerpt: null,
    });
    expect(result.success).toBe(true);
    expect(result.data.title).toBe("Title");
  });

  test("rejects an empty title", () => {
    const result = createPostSchema.safeParse({ title: "   ", content: "Body" });
    expect(result.success).toBe(false);
  });

  test("rejects empty content", () => {
    const result = createPostSchema.safeParse({ title: "Title", content: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid slug", () => {
    const result = createPostSchema.safeParse({
      title: "Title",
      content: "Body",
      slug: "Not A Slug",
    });
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.slug).toBeDefined();
  });

  test("accepts a valid slug", () => {
    const result = createPostSchema.safeParse({
      title: "Title",
      content: "Body",
      slug: "valid-slug-2",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an excerpt longer than 500 characters", () => {
    const result = createPostSchema.safeParse({
      title: "Title",
      content: "Body",
      excerpt: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  test("rejects a non-boolean published flag", () => {
    const result = createPostSchema.safeParse({
      title: "Title",
      content: "Body",
      published: "yes",
    });
    expect(result.success).toBe(false);
  });
});

describe("updatePostSchema", () => {
  test("rejects an empty update", () => {
    expect(updatePostSchema.safeParse({}).success).toBe(false);
  });

  test("accepts a partial update", () => {
    const result = updatePostSchema.safeParse({ published: true });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ published: true });
  });

  test("applies the same field rules as create", () => {
    expect(updatePostSchema.safeParse({ title: "" }).success).toBe(false);
    expect(updatePostSchema.safeParse({ slug: "Bad Slug" }).success).toBe(false);
  });
});

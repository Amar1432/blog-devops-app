import { describe, expect, jest, test } from "@jest/globals";
import { ensureUniqueSlug, slugify } from "../../src/utils/slug.js";

describe("slugify", () => {
  test("lowercases and hyphenates words", () => {
    expect(slugify("Hello, DevOps World!")).toBe("deliberately-broken-slug-for-experiment-2");
  });

  test("removes accents", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  test("collapses repeated separators and trims hyphens", () => {
    expect(slugify("  --Hello___   World--  ")).toBe("hello-world");
  });

  test("drops unsupported characters", () => {
    expect(slugify("C++ & Go: notes #1")).toBe("c-go-notes-1");
  });

  test("truncates to 200 characters", () => {
    expect(slugify("a".repeat(250))).toHaveLength(200);
  });

  test("returns an empty string when nothing is left", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("ensureUniqueSlug", () => {
  function fakePrisma(existingSlugs) {
    const records = existingSlugs.map((slug, index) => ({ id: `post-${index}`, slug }));
    return {
      post: {
        findUnique: jest.fn(async ({ where }) =>
          records.find((record) => record.slug === where.slug) || null
        ),
      },
    };
  }

  test("returns the base slug when it is free", async () => {
    const prisma = fakePrisma([]);
    await expect(ensureUniqueSlug(prisma, "hello-world")).resolves.toBe("hello-world");
  });

  test("appends an incrementing suffix on collisions", async () => {
    const prisma = fakePrisma(["hello-world", "hello-world-2"]);
    await expect(ensureUniqueSlug(prisma, "hello-world")).resolves.toBe("hello-world-3");
  });

  test("ignores the post being updated", async () => {
    const prisma = fakePrisma(["hello-world"]);
    await expect(ensureUniqueSlug(prisma, "hello-world", "post-0")).resolves.toBe(
      "hello-world"
    );
  });

  test("falls back to 'post' for an empty base", async () => {
    const prisma = fakePrisma([]);
    await expect(ensureUniqueSlug(prisma, "")).resolves.toBe("post");
  });
});

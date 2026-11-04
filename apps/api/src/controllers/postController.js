import { prisma } from "../lib/prisma.js";
import { notFound } from "../utils/AppError.js";
import { ensureUniqueSlug, slugify } from "../utils/slug.js";

const authorSelect = { select: { id: true, name: true } };

const listSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: authorSelect,
};

const detailSelect = {
  ...listSelect,
  content: true,
};

function postPayload(input) {
  const data = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.excerpt !== undefined) data.excerpt = input.excerpt ?? null;
  if (input.content !== undefined) data.content = input.content;
  if (input.published !== undefined) data.published = input.published;
  return data;
}

export async function listPublishedPosts(req, res, next) {
  try {
    res.set?.("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    const posts = await prisma.post.findMany({
      where: { published: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: listSelect,
    });
    res.json({ posts });
  } catch (error) {
    next(error);
  }
}

export async function getPublishedPost(req, res, next) {
  try {
    const post = await prisma.post.findFirst({
      where: { slug: req.params.slug, published: true },
      select: detailSelect,
    });

    if (!post) {
      throw notFound("Post not found");
    }

    res.set?.("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    res.json({ post });
  } catch (error) {
    next(error);
  }
}

export async function listAllPosts(req, res, next) {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { updatedAt: "desc" },
      select: listSelect,
    });
    res.json({ posts });
  } catch (error) {
    next(error);
  }
}

export async function getPostById(req, res, next) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      select: detailSelect,
    });

    if (!post) {
      throw notFound("Post not found");
    }

    res.json({ post });
  } catch (error) {
    next(error);
  }
}

export async function createPost(req, res, next) {
  try {
    const input = req.body;
    const slug = input.slug ?? (await ensureUniqueSlug(prisma, slugify(input.title)));

    const post = await prisma.post.create({
      data: {
        ...postPayload(input),
        slug,
        publishedAt: input.published ? new Date() : null,
        authorId: req.user.id,
      },
      select: detailSelect,
    });

    res.status(201).json({ post });
  } catch (error) {
    next(error);
  }
}

export async function updatePost(req, res, next) {
  try {
    const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw notFound("Post not found");
    }

    const input = req.body;
    const data = postPayload(input);

    if (input.slug !== undefined) {
      data.slug = input.slug;
    }

    if (input.published === true && !existing.publishedAt) {
      data.publishedAt = new Date();
    }

    const post = await prisma.post.update({
      where: { id: existing.id },
      data,
      select: detailSelect,
    });

    res.json({ post });
  } catch (error) {
    next(error);
  }
}

export async function deletePost(req, res, next) {
  try {
    const existing = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      throw notFound("Post not found");
    }

    await prisma.post.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

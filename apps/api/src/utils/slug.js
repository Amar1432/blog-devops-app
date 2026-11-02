export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export async function ensureUniqueSlug(prisma, baseSlug, excludeId) {
  const base = baseSlug || "post";
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

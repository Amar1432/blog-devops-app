import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma.js";

export const TEST_ADMIN = {
  email: "admin@test.local",
  password: "test-password",
  name: "Test Admin",
};

export function assertTestDatabase() {
  const url = process.env.DATABASE_URL || "";
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(
      "Refusing to touch the database: DATABASE_URL must point to a *_test database"
    );
  }
}

export async function resetDatabase() {
  assertTestDatabase();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestAdmin(overrides = {}) {
  assertTestDatabase();
  const admin = { ...TEST_ADMIN, ...overrides };

  const user = await prisma.user.create({
    data: {
      email: admin.email.toLowerCase(),
      name: admin.name,
      passwordHash: await bcrypt.hash(admin.password, 4),
    },
  });

  return { ...admin, user };
}

export { prisma };

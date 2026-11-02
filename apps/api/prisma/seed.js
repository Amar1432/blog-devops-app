import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Site Admin";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user");
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters long");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash },
  });

  console.log(`Admin user ready: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

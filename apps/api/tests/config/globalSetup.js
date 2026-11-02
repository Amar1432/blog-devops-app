import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default async function globalSetup() {
  const result = dotenv.config({
    path: path.join(apiRoot, ".env.test"),
    override: true,
  });

  if (result.error) {
    throw new Error(
      "Missing apps/api/.env.test. Copy .env.test.example to .env.test first."
    );
  }

  const databaseUrl = process.env.DATABASE_URL || "";

  if (!/_test(\?|$)/.test(databaseUrl)) {
    throw new Error(
      "Refusing to run tests: DATABASE_URL must point to a database name ending in _test"
    );
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: apiRoot,
    env: process.env,
    stdio: "inherit",
  });
}

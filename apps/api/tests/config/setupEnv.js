import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const result = dotenv.config({
  path: path.join(apiRoot, ".env.test"),
  override: true,
});

if (result.error) {
  throw new Error(
    "Missing apps/api/.env.test. Copy .env.test.example to .env.test and point it at a *_test database."
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in apps/api/.env.test");
}

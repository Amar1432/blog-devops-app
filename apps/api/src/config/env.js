import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  corsOrigins: parsed.data.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

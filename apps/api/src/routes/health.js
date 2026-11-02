import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (req, res) => {
  const base = {
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up", ...base });
  } catch {
    res.status(503).json({ status: "error", database: "down", ...base });
  }
});

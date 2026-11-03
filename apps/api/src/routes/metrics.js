import { Router } from "express";
import { register } from "../lib/metrics.js";

export const metricsRouter = Router();

metricsRouter.get("/", async (req, res, next) => {
  try {
    res.setHeader("Content-Type", register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err) {
    next(err);
  }
});

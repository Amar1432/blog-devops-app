import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { metricsMiddleware } from "./middleware/metrics.js";
import { adminPostsRouter } from "./routes/adminPosts.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { metricsRouter } from "./routes/metrics.js";
import { postsRouter } from "./routes/posts.js";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use(metricsMiddleware);

app.use("/api/health", healthRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);
app.use("/api/admin/posts", adminPostsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

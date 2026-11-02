import { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Request body must be valid JSON" },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A record with the same unique value already exists",
          details: err.meta,
        },
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Resource not found" },
      });
    }
  }

  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      ...(env.isProduction ? {} : { details: err.message }),
    },
  });
}

export class AppError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = options.code ?? "ERROR";
    this.details = options.details;
  }
}

export const badRequest = (message, details) =>
  new AppError(400, message, { code: "BAD_REQUEST", details });

export const unauthorized = (message = "Authentication required") =>
  new AppError(401, message, { code: "UNAUTHORIZED" });

export const forbidden = (message = "Not allowed") =>
  new AppError(403, message, { code: "FORBIDDEN" });

export const notFound = (message = "Resource not found") =>
  new AppError(404, message, { code: "NOT_FOUND" });

export const conflict = (message, details) =>
  new AppError(409, message, { code: "CONFLICT", details });

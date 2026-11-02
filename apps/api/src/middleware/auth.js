import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized } from "../utils/AppError.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(unauthorized());
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}

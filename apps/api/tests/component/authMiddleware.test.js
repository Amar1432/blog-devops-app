import { describe, expect, jest, test } from "@jest/globals";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import { authenticate } from "../../src/middleware/auth.js";

function runWithHeader(header) {
  const req = { headers: header === undefined ? {} : { authorization: header } };
  const res = {};
  const next = jest.fn();
  authenticate(req, res, next);
  return { req, res, next };
}

describe("authenticate middleware", () => {
  test("rejects a missing Authorization header", () => {
    const { next } = runWithHeader(undefined);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.status).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  test("rejects a non-Bearer scheme", () => {
    const { next } = runWithHeader("Basic abc123");

    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test("rejects a malformed token", () => {
    const { next } = runWithHeader("Bearer not-a-jwt");

    const error = next.mock.calls[0][0];
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/invalid or expired/i);
  });

  test("rejects an expired token", () => {
    const token = jwt.sign({ sub: "user-1", email: "a@b.c" }, env.JWT_SECRET, {
      expiresIn: -10,
    });
    const { next } = runWithHeader(`Bearer ${token}`);

    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test("rejects a token signed with another secret", () => {
    const token = jwt.sign({ sub: "user-1" }, "a-different-secret-value", {
      expiresIn: "1h",
    });
    const { next } = runWithHeader(`Bearer ${token}`);

    expect(next.mock.calls[0][0].status).toBe(401);
  });

  test("attaches the user and calls next on a valid token", () => {
    const token = jwt.sign({ sub: "user-1", email: "admin@test.local" }, env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const { req, next } = runWithHeader(`Bearer ${token}`);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: "user-1", email: "admin@test.local" });
  });
});

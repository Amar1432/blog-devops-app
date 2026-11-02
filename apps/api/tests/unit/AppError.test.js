import { describe, expect, test } from "@jest/globals";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../../src/utils/AppError.js";

describe("AppError", () => {
  test("stores status, code and optional details", () => {
    const error = new AppError(418, "Teapot", { code: "TEAPOT", details: { a: 1 } });

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(418);
    expect(error.code).toBe("TEAPOT");
    expect(error.details).toEqual({ a: 1 });
  });

  test("defaults the code to ERROR", () => {
    expect(new AppError(500, "Oops").code).toBe("ERROR");
  });
});

describe("AppError helpers", () => {
  test("badRequest", () => {
    const error = badRequest("Bad", { field: "title" });
    expect(error.status).toBe(400);
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.details).toEqual({ field: "title" });
  });

  test("unauthorized", () => {
    const error = unauthorized();
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/authentication required/i);
  });

  test("forbidden", () => {
    const error = forbidden();
    expect(error.status).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });

  test("notFound", () => {
    const error = notFound("Missing");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Missing");
  });

  test("conflict", () => {
    const error = conflict("Duplicate", { slug: "taken" });
    expect(error.status).toBe(409);
    expect(error.details).toEqual({ slug: "taken" });
  });
});

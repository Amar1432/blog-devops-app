import { describe, expect, jest, test } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { errorHandler, notFoundHandler } from "../../src/middleware/errorHandler.js";
import { AppError } from "../../src/utils/AppError.js";

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function prismaError(code, meta) {
  return new Prisma.PrismaClientKnownRequestError("Prisma failure", {
    code,
    clientVersion: "test",
    meta,
  });
}

describe("errorHandler", () => {
  test("serializes AppError with status, code and details", () => {
    const res = mockResponse();
    const error = new AppError(409, "Conflict", {
      code: "CONFLICT",
      details: { field: "slug" },
    });

    errorHandler(error, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "CONFLICT",
        message: "Conflict",
        details: { field: "slug" },
      },
    });
  });

  test("maps Prisma P2002 to 409", () => {
    const res = mockResponse();

    errorHandler(prismaError("P2002", { target: ["slug"] }), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error.code).toBe("CONFLICT");
  });

  test("maps Prisma P2025 to 404", () => {
    const res = mockResponse();

    errorHandler(prismaError("P2025", {}), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error.code).toBe("NOT_FOUND");
  });

  test("maps JSON parse failures to 400", () => {
    const res = mockResponse();

    errorHandler({ type: "entity.parse.failed" }, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.code).toBe("BAD_REQUEST");
  });

  test("returns 500 for unexpected errors without leaking in production mode", () => {
    const res = mockResponse();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("boom"), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("notFoundHandler", () => {
  test("returns a 404 for unknown routes", () => {
    const res = mockResponse();

    notFoundHandler({ method: "GET", originalUrl: "/api/nope" }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error.message).toBe("Route GET /api/nope not found");
  });
});

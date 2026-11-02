import { describe, expect, jest, test } from "@jest/globals";
import { z } from "zod";
import { validate } from "../../src/middleware/validate.js";

const schema = z.object({
  title: z.string().trim().min(1),
  count: z.coerce.number().int(),
});

describe("validate middleware", () => {
  test("replaces req.body with parsed data and calls next", () => {
    const req = { body: { title: "  Hello  ", count: "2" } };
    const next = jest.fn();

    validate(schema)(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ title: "Hello", count: 2 });
  });

  test("forwards a 422 AppError with field details", () => {
    const req = { body: { title: "", count: "nope" } };
    const next = jest.fn();

    validate(schema)(req, {}, next);

    const error = next.mock.calls[0][0];
    expect(error.status).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details.fieldErrors.title).toBeDefined();
    expect(error.details.fieldErrors.count).toBeDefined();
  });

  test("leaves the original body untouched when invalid", () => {
    const body = { title: "", count: "nope" };
    const req = { body };

    validate(schema)(req, {}, jest.fn());

    expect(req.body).toBe(body);
  });

  test("can validate a different request source", () => {
    const req = { query: { title: "  Hi  ", count: "3" } };
    const next = jest.fn();

    validate(schema, "query")(req, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ title: "Hi", count: 3 });
  });
});

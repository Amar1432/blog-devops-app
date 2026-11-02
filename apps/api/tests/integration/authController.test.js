import { afterAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import { login, me } from "../../src/controllers/authController.js";
import {
  createTestAdmin,
  prisma,
  resetDatabase,
  TEST_ADMIN,
} from "../helpers/db.js";

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(async () => {
  await resetDatabase();
  await createTestAdmin();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("authController.login", () => {
  test("returns a valid token and a sanitized user", async () => {
    const req = { body: { email: TEST_ADMIN.email, password: TEST_ADMIN.password } };
    const res = mockResponse();
    const next = jest.fn();

    await login(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.user).toEqual({
      id: expect.any(String),
      email: TEST_ADMIN.email,
      name: TEST_ADMIN.name,
    });
    expect(body.user.passwordHash).toBeUndefined();

    const payload = jwt.verify(body.token, env.JWT_SECRET);
    expect(payload.sub).toBe(body.user.id);
  });

  test("normalizes email casing and whitespace", async () => {
    const req = {
      body: { email: "  ADMIN@TEST.LOCAL  ", password: TEST_ADMIN.password },
    };
    const res = mockResponse();
    const next = jest.fn();

    await login(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test("rejects a wrong password with 401", async () => {
    const req = { body: { email: TEST_ADMIN.email, password: "wrong-password" } };
    const next = jest.fn();

    await login(req, mockResponse(), next);

    const error = next.mock.calls[0][0];
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/invalid email or password/i);
  });

  test("rejects an unknown email with the same 401 message", async () => {
    const req = { body: { email: "nobody@test.local", password: "whatever" } };
    const next = jest.fn();

    await login(req, mockResponse(), next);

    const error = next.mock.calls[0][0];
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/invalid email or password/i);
  });
});

describe("authController.me", () => {
  test("returns the authenticated user", async () => {
    const admin = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email } });
    const req = { user: { id: admin.id } };
    const res = mockResponse();
    const next = jest.fn();

    await me(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].user).toEqual({
      id: admin.id,
      email: TEST_ADMIN.email,
      name: TEST_ADMIN.name,
    });
  });

  test("rejects a token whose user no longer exists", async () => {
    const req = { user: { id: "deleted-user-id" } };
    const next = jest.fn();

    await me(req, mockResponse(), next);

    expect(next.mock.calls[0][0].status).toBe(401);
  });
});

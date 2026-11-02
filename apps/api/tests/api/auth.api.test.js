import { afterAll, beforeEach, describe, expect, test } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTestAdmin, prisma, resetDatabase, TEST_ADMIN } from "../helpers/db.js";
import { authHeader, getToken } from "../helpers/auth.js";

beforeEach(async () => {
  await resetDatabase();
  await createTestAdmin();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/login", () => {
  test("returns a token for valid credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toEqual({
      id: expect.any(String),
      email: TEST_ADMIN.email,
      name: TEST_ADMIN.name,
    });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  test("returns 401 for a wrong password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_ADMIN.email, password: "nope-nope" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns 401 for an unknown email", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@test.local", password: "whatever" });

    expect(response.status).toBe(401);
  });

  test("returns 422 with field errors for invalid input", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fieldErrors.email).toBeDefined();
    expect(response.body.error.details.fieldErrors.password).toBeDefined();
  });

  test("rejects malformed JSON with 400", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });
});

describe("GET /api/auth/me", () => {
  test("returns the current user for a valid token", async () => {
    const token = await getToken(app);

    const response = await request(app)
      .get("/api/auth/me")
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(TEST_ADMIN.email);
  });

  test("returns 401 without a token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns 401 with an invalid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set(authHeader("not-a-token"));

    expect(response.status).toBe(401);
  });
});

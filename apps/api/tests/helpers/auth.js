import request from "supertest";
import { TEST_ADMIN } from "./db.js";

export async function login(app, overrides = {}) {
  const credentials = { ...TEST_ADMIN, ...overrides };

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: credentials.email, password: credentials.password });

  return response;
}

export async function getToken(app, overrides = {}) {
  const response = await login(app, overrides);
  return response.body.token;
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

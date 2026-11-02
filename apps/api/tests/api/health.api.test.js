import { afterAll, describe, expect, jest, test } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../helpers/db.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/health", () => {
  test("reports the API and database as healthy", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", database: "up" });
    expect(typeof response.body.uptime).toBe("number");
    expect(new Date(response.body.timestamp).toString()).not.toBe("Invalid Date");
  });

  test("reports 503 when the database query fails", async () => {
    const spy = jest
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("database unavailable"));

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: "error", database: "down" });
    spy.mockRestore();
  });

  test("sets an CORS header for an allowed origin", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173"
    );
  });
});

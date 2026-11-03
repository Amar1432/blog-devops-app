import { describe, expect, test } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/metrics", () => {
  test("returns 200 with Prometheus text format", async () => {
    // Generate a test request so metrics are updated
    await request(app).get("/api/health");

    const response = await request(app).get("/api/metrics");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("http_requests_total");
    expect(response.text).toContain("http_request_duration_seconds");
    expect(response.text).toContain("app=\"devops-blog-api\"");
    expect(response.text).toContain("route=\"/api/health\"");
  });

  test("tracks 404 routes without label explosion", async () => {
    await request(app).get("/api/non-existent-endpoint-random-xyz");

    const response = await request(app).get("/api/metrics");

    expect(response.status).toBe(200);
    expect(response.text).toContain("route=\"not_found\"");
    expect(response.text).toContain("status_code=\"404\"");
  });
});

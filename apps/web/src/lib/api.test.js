import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api.js";

function mockFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches published posts", async () => {
    const payload = { posts: [{ id: 1, title: "Hello" }] };
    const fetchMock = mockFetch(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(api.getPublishedPosts()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/posts$/),
      { method: "GET", headers: {}, body: undefined }
    );
  });

  it("sends credentials as JSON when logging in", async () => {
    const payload = { token: "abc", user: { id: 1 } };
    const fetchMock = mockFetch(
      new Response(JSON.stringify(payload), { status: 200 })
    );

    await api.login({ email: "ada@example.com", password: "secret" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/login$/),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          password: "secret",
        }),
      }
    );
  });

  it("attaches the bearer token to protected requests", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ posts: [] }), { status: 200 })
    );

    await api.getAdminPosts("token-123");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/posts$/),
      {
        method: "GET",
        headers: { Authorization: "Bearer token-123" },
        body: undefined,
      }
    );
  });

  it("returns null for a 204 response", async () => {
    mockFetch(new Response(null, { status: 204 }));

    await expect(api.deletePost("token-123", 4)).resolves.toBeNull();
  });

  it("throws an ApiError using the API error envelope", async () => {
    const body = {
      error: { message: "Post not found", details: [{ field: "slug" }] },
    };
    mockFetch(new Response(JSON.stringify(body), { status: 404 }));

    const error = await api.getPublishedPost("missing").catch((err) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: "ApiError",
      message: "Post not found",
      status: 404,
      details: [{ field: "slug" }],
    });
  });

  it("falls back to the status code when the error body is not JSON", async () => {
    mockFetch(new Response("nope", { status: 500 }));

    await expect(api.getPublishedPosts()).rejects.toMatchObject({
      message: "Request failed with status 500",
      status: 500,
    });
  });

  it("wraps network failures in an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(api.getPublishedPosts()).rejects.toMatchObject({
      name: "ApiError",
      message: "Cannot reach the API. Is the backend running?",
      status: 0,
    });
  });
});

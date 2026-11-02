const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the API. Is the backend running?", 0);
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || `Request failed with status ${response.status}`,
      response.status,
      data?.error?.details
    );
  }

  return data;
}

export const api = {
  getPublishedPosts: () => request("/posts"),
  getPublishedPost: (slug) => request(`/posts/${encodeURIComponent(slug)}`),
  login: (credentials) => request("/auth/login", { method: "POST", body: credentials }),
  me: (token) => request("/auth/me", { token }),
  getAdminPosts: (token) => request("/admin/posts", { token }),
  getAdminPost: (token, id) => request(`/admin/posts/${id}`, { token }),
  createPost: (token, post) => request("/posts", { method: "POST", body: post, token }),
  updatePost: (token, id, post) =>
    request(`/posts/${id}`, { method: "PUT", body: post, token }),
  deletePost: (token, id) => request(`/posts/${id}`, { method: "DELETE", token }),
};

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  getToken,
  getUser,
  saveSession,
} from "./auth.js";

describe("auth session helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when there is no session", () => {
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it("persists and reads the token and user", () => {
    saveSession("token-123", { id: 1, name: "Ada", email: "ada@example.com" });

    expect(getToken()).toBe("token-123");
    expect(getUser()).toEqual({ id: 1, name: "Ada", email: "ada@example.com" });
  });

  it("returns null when the stored user is not valid JSON", () => {
    localStorage.setItem("devops_blog_user", "{not-json");

    expect(getUser()).toBeNull();
  });

  it("removes the token and user on clearSession", () => {
    saveSession("token-123", { id: 1 });

    clearSession();

    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(localStorage.getItem("devops_blog_token")).toBeNull();
    expect(localStorage.getItem("devops_blog_user")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { formatDate } from "./format.js";

describe("formatDate", () => {
  it("returns an empty string when no value is provided", () => {
    expect(formatDate()).toBe("");
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("formats a date with the long numeric month style", () => {
    const value = "2026-03-15T12:00:00.000Z";
    const expected = new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    expect(formatDate(value)).toBe(expected);
  });

  it("intentional failure to verify publishing is blocked", () => {
    expect("ci-guard").toBe("blocked-by-failing-test");
  });
});

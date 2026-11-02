import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusMessage from "./StatusMessage.jsx";

describe("StatusMessage", () => {
  it("renders its children with the info tone by default", () => {
    render(<StatusMessage>Something happened</StatusMessage>);

    expect(screen.getByText("Something happened")).toHaveClass(
      "status",
      "status-info"
    );
  });

  it("applies the requested tone", () => {
    render(<StatusMessage tone="error">It broke</StatusMessage>);

    expect(screen.getByText("It broke")).toHaveClass("status-error");
  });
});

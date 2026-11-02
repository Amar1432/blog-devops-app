import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NotFound from "./NotFound.jsx";

describe("NotFound", () => {
  it("renders a 404 message with a link home", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(
      screen.getByText("The page you are looking for does not exist.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to all posts" })).toHaveAttribute(
      "href",
      "/"
    );
  });
});

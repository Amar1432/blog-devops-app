import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api.js";
import Login from "./Login.jsx";

vi.mock("../lib/api.js", () => ({
  api: {
    login: vi.fn(),
  },
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<p>admin dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function submitCredentials(email = "ada@example.com", password = "secret") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("Login", () => {
  beforeEach(() => {
    api.login.mockReset();
  });

  it("renders the login form", () => {
    renderLogin();

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("saves the session and redirects to the dashboard on success", async () => {
    api.login.mockResolvedValue({
      token: "token-123",
      user: { id: 1, name: "Ada", email: "ada@example.com" },
    });

    renderLogin();
    await submitCredentials();

    expect(api.login).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "secret",
    });
    expect(await screen.findByText("admin dashboard")).toBeInTheDocument();
    expect(localStorage.getItem("devops_blog_token")).toBe("token-123");
    expect(JSON.parse(localStorage.getItem("devops_blog_user"))).toMatchObject({
      name: "Ada",
    });
  });

  it("shows an error and stays on the form when login fails", async () => {
    api.login.mockRejectedValue(new Error("Invalid credentials"));

    renderLogin();
    await submitCredentials("ada@example.com", "wrong");

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(screen.queryByText("admin dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(localStorage.getItem("devops_blog_token")).toBeNull();
  });

  it("redirects authenticated users away from the login page", () => {
    localStorage.setItem("devops_blog_token", "token-123");

    renderLogin();

    expect(screen.getByText("admin dashboard")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Log in" })).not.toBeInTheDocument();
  });
});

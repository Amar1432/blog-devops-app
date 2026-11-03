import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MarkdownRenderer from "./MarkdownRenderer.jsx";

describe("MarkdownRenderer", () => {
  it("renders null when content is empty or null", () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders basic markdown headings, lists, and typography", () => {
    const markdown = `
# DevOps Heading 1
## Subheading 2

This is a **bold** statement and *italic* text.

- Item 1
- Item 2

> This is a blockquote.
    `;

    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByRole("heading", { level: 1, name: "DevOps Heading 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Subheading 2" })).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("italic")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText(/This is a blockquote/)).toBeInTheDocument();
  });

  it("renders GFM tables properly", () => {
    const markdown = `
| Tool | Purpose |
| :--- | :--- |
| Docker | Containers |
| K8s | Orchestration |
    `;

    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tool" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Docker" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Orchestration" })).toBeInTheDocument();
  });

  it("renders external links with target=_blank and rel attributes", () => {
    const markdown = `Check out [Kubernetes Docs](https://kubernetes.io) for more.`;

    render(<MarkdownRenderer content={markdown} />);

    const link = screen.getByRole("link", { name: "Kubernetes Docs" });
    expect(link).toHaveAttribute("href", "https://kubernetes.io");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders code blocks with a copy button", async () => {
    const user = userEvent.setup();
    const markdown = `
\`\`\`bash
kubectl get pods -n production
\`\`\`
    `;

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByText(/kubectl get pods/)).toBeInTheDocument();
    const copyBtn = screen.getByRole("button", { name: "Copy code to clipboard" });
    expect(copyBtn).toBeInTheDocument();

    await user.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith("kubectl get pods -n production");
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });
});

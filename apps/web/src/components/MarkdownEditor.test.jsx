import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MarkdownEditor from "./MarkdownEditor.jsx";

describe("MarkdownEditor", () => {
  it("renders textarea in write mode and allows typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <div>
        <label htmlFor="test-content">Content</label>
        <MarkdownEditor
          id="test-content"
          name="content"
          value=""
          onChange={handleChange}
        />
      </div>
    );

    const textarea = screen.getByLabelText("Content");
    expect(textarea).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Write" })).toHaveClass("is-active");

    await user.type(textarea, "Hello DevOps");
    expect(handleChange).toHaveBeenCalled();
  });

  it("applies bold formatting via toolbar button", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <div>
        <label htmlFor="test-content">Content</label>
        <MarkdownEditor
          id="test-content"
          name="content"
          value="sample text"
          onChange={handleChange}
        />
      </div>
    );

    const boldBtn = screen.getByRole("button", { name: "Bold (Ctrl+B)" });
    await user.click(boldBtn);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          name: "content",
          value: expect.stringContaining("**"),
        }),
      })
    );
  });

  it("switches to preview mode and renders markdown preview", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <label htmlFor="test-content">Content</label>
        <MarkdownEditor
          id="test-content"
          name="content"
          value={`# Preview Title

Some preview text`}
          onChange={() => {}}
        />
      </div>
    );

    const previewTab = screen.getByRole("tab", { name: "Preview" });
    await user.click(previewTab);

    expect(previewTab).toHaveClass("is-active");
    expect(screen.queryByLabelText("Content")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Preview Title" })).toBeInTheDocument();
    expect(screen.getByText("Some preview text")).toBeInTheDocument();
  });

  it("shows empty state message when previewing blank content", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <label htmlFor="test-content">Content</label>
        <MarkdownEditor
          id="test-content"
          name="content"
          value="   "
          onChange={() => {}}
        />
      </div>
    );

    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(
      screen.getByText("Nothing to preview yet. Start typing in Write mode.")
    ).toBeInTheDocument();
  });

  it("supports keyboard shortcut Ctrl+B or Cmd+B for bold formatting", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <div>
        <label htmlFor="test-content">Content</label>
        <MarkdownEditor
          id="test-content"
          name="content"
          value="my text"
          onChange={handleChange}
        />
      </div>
    );

    const textarea = screen.getByLabelText("Content");
    await user.click(textarea);
    await user.keyboard("{Control>}b{/Control}");

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          name: "content",
          value: expect.stringContaining("**"),
        }),
      })
    );
  });
});

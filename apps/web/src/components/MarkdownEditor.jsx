import { useRef, useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer.jsx";

const TOOLBAR_ACTIONS = [
  { id: "bold", label: "B", title: "Bold (Ctrl+B)", format: "bold" },
  { id: "italic", label: "I", title: "Italic (Ctrl+I)", format: "italic", style: { fontStyle: "italic" } },
  { id: "heading", label: "H", title: "Heading", format: "heading", style: { fontWeight: "bold" } },
  { id: "inline-code", label: "<>", title: "Inline code", format: "inline-code" },
  { id: "code-block", label: "{ }", title: "Code block", format: "code-block" },
  { id: "link", label: "Link", title: "Insert link (Ctrl+K)", format: "link" },
  { id: "quote", label: "“ Quote", title: "Blockquote", format: "quote" },
  { id: "bullet-list", label: "• List", title: "Bullet list", format: "bullet-list" },
  { id: "numbered-list", label: "1. List", title: "Numbered list", format: "numbered-list" },
  { id: "table", label: "⊞ Table", title: "Insert table", format: "table" },
];

export default function MarkdownEditor({
  id = "post-content",
  name = "content",
  value = "",
  onChange,
  rows = 16,
  required = false,
  placeholder = "Write your blog post content here using Markdown...",
  "aria-label": ariaLabel = "Content",
}) {
  const [tab, setTab] = useState("write");
  const textareaRef = useRef(null);

  function triggerChange(newVal, newCursorStart, newCursorEnd) {
    if (onChange) {
      onChange({
        target: {
          name,
          value: newVal,
          type: "textarea",
        },
      });
    }

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        if (newCursorStart !== undefined && newCursorEnd !== undefined) {
          textareaRef.current.setSelectionRange(newCursorStart, newCursorEnd);
        }
      }
    });
  }

  function applyFormat(formatType) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const val = value || "";
    const start = textarea.selectionStart ?? val.length;
    const end = textarea.selectionEnd ?? val.length;
    const sel = val.slice(start, end);

    let newVal = val;
    let newStart = start;
    let newEnd = end;

    switch (formatType) {
      case "bold": {
        const rep = sel ? `**${sel}**` : `**bold text**`;
        newVal = val.slice(0, start) + rep + val.slice(end);
        newStart = sel ? start + 2 : start + 2;
        newEnd = sel ? end + 2 : start + 11;
        break;
      }
      case "italic": {
        const rep = sel ? `*${sel}*` : `*italic text*`;
        newVal = val.slice(0, start) + rep + val.slice(end);
        newStart = sel ? start + 1 : start + 1;
        newEnd = sel ? end + 1 : start + 12;
        break;
      }
      case "heading": {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        newVal = val.slice(0, lineStart) + "### " + val.slice(lineStart);
        newStart = start + 4;
        newEnd = end + 4;
        break;
      }
      case "inline-code": {
        const rep = sel ? `\`${sel}\`` : "`code`";
        newVal = val.slice(0, start) + rep + val.slice(end);
        newStart = sel ? start + 1 : start + 1;
        newEnd = sel ? end + 1 : start + 5;
        break;
      }
      case "code-block": {
        const snippet = sel
          ? `\n\`\`\`bash\n${sel}\n\`\`\`\n`
          : `\n\`\`\`bash\n# shell command or code\n\`\`\`\n`;
        newVal = val.slice(0, start) + snippet + val.slice(end);
        newStart = start + snippet.length;
        newEnd = newStart;
        break;
      }
      case "link": {
        let snippet;
        if (/^https?:\/\//i.test(sel)) {
          snippet = `[link title](${sel})`;
          newStart = start + 1;
          newEnd = start + 11;
        } else if (sel) {
          snippet = `[${sel}](https://example.com)`;
          newStart = start + sel.length + 3;
          newEnd = start + sel.length + 22;
        } else {
          snippet = `[link title](https://example.com)`;
          newStart = start + 1;
          newEnd = start + 11;
        }
        newVal = val.slice(0, start) + snippet + val.slice(end);
        break;
      }
      case "quote": {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        newVal = val.slice(0, lineStart) + "> " + val.slice(lineStart);
        newStart = start + 2;
        newEnd = end + 2;
        break;
      }
      case "bullet-list": {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        newVal = val.slice(0, lineStart) + "- " + val.slice(lineStart);
        newStart = start + 2;
        newEnd = end + 2;
        break;
      }
      case "numbered-list": {
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        newVal = val.slice(0, lineStart) + "1. " + val.slice(lineStart);
        newStart = start + 3;
        newEnd = end + 3;
        break;
      }
      case "table": {
        const snippet =
          "\n| Header 1 | Header 2 |\n| :--- | :--- |\n| Item 1 | Detail 1 |\n| Item 2 | Detail 2 |\n";
        newVal = val.slice(0, start) + snippet + val.slice(end);
        newStart = start + snippet.length;
        newEnd = newStart;
        break;
      }
      default:
        return;
    }

    triggerChange(newVal, newStart, newEnd);
  }

  function handleKeyDown(event) {
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        applyFormat("bold");
      } else if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        applyFormat("italic");
      } else if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        applyFormat("link");
      }
    }
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-nav">
        <div className="markdown-editor-tabs" role="tablist" aria-label="Editor tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            className={`editor-tab ${tab === "write" ? "is-active" : ""}`}
            onClick={() => setTab("write")}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={`editor-tab ${tab === "preview" ? "is-active" : ""}`}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </div>

        {tab === "write" && (
          <div className="markdown-toolbar" role="toolbar" aria-label="Markdown formatting tools">
            {TOOLBAR_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className="toolbar-btn"
                style={action.style}
                title={action.title}
                aria-label={action.title}
                onClick={() => applyFormat(action.format)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="markdown-editor-pane">
        {tab === "write" ? (
          <textarea
            ref={textareaRef}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            rows={rows}
            required={required}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="markdown-textarea"
          />
        ) : (
          <div className="markdown-preview-pane">
            {value.trim() ? (
              <MarkdownRenderer content={value} />
            ) : (
              <p className="preview-placeholder">Nothing to preview yet. Start typing in Write mode.</p>
            )}
          </div>
        )}
      </div>
      <div className="editor-footer">
        <span className="field-hint">Supports Markdown and GitHub Flavored Markdown (GFM).</span>
      </div>
    </div>
  );
}

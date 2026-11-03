import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui/button.jsx";

function getNodeText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (node.props && node.props.children) return getNodeText(node.props.children);
  return "";
}

function PreBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const text = getNodeText(children).replace(/\n$/, "");

  const handleCopy = async () => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write might be denied in some environments
    }
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-block-label">Code</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 border border-white/15 bg-white/10 px-2.5 text-xs text-slate-300 shadow-none hover:bg-white/15 hover:text-white"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );
}

function LinkBlock({ href, children, ...props }) {
  const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  return (
    <div className={`markdown-content ${className}`.trim()}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: PreBlock,
          a: LinkBlock,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

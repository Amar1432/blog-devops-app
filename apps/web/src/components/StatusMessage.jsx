import { cn } from "../lib/utils.js";

export default function StatusMessage({ tone = "info", className, children }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "status",
        `status-${tone}`,
        "flex items-center gap-2.5 p-3.5 rounded-lg text-sm border shadow-xs transition-all leading-relaxed",
        className
      )}
    >
      {children}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button.jsx";

export function ThemeToggle({ className }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("devops_blog_theme");
        if (stored) return stored;
        if (typeof window.matchMedia === "function") {
          return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
        }
      } catch {
        // ignore
      }
    }
    return "light";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("devops_blog_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="size-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-slate-700 transition-transform duration-200 rotate-0 hover:-rotate-12" />
      )}
    </Button>
  );
}

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * ThemeToggle — flips between Paper Medium (light) and Studio Dark, using the
 * app's ThemeContext (persisted as sb_theme). Medium is the default.
 */
export function ThemeToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 ${
        compact ? "h-8 w-8" : "h-9 w-9"
      } ${className}`}
      style={{
        color: "var(--muted-foreground)",
        background: "transparent",
        border: "1px solid var(--border)",
        minHeight: "auto",
        minWidth: "auto",
      }}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "./ThemeProvider"

interface ThemeToggleProps {
  hideLabel?: boolean;
}

export function ThemeToggle({ hideLabel }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={`
      flex ${hideLabel ? 'flex-col space-y-2' : 'flex-row space-x-1'} 
      p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl md:rounded-full border border-zinc-200 dark:border-zinc-700 transition-all duration-300
    `}>
      <button
        onClick={() => setTheme("light")}
        className={`p-2 rounded-xl md:rounded-full transition-colors ${
          theme === "light"
            ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
        title="Light Mode"
        aria-label="Light Mode"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-2 rounded-xl md:rounded-full transition-colors ${
          theme === "system"
            ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
        title="System Default"
        aria-label="System Default"
      >
        <Monitor className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-2 rounded-xl md:rounded-full transition-colors ${
          theme === "dark"
            ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-sm"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
        title="Dark Mode"
        aria-label="Dark Mode"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  )
}

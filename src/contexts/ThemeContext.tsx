import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface ThemeContextValue {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const initial: "dark" | "light" = (saved === "dark" || saved === "light") ? saved : "light";
    // Apply synchronously so CSS variables are ready before first paint
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", initial);
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(initial);
    }
    return initial;
  });

  useEffect(() => {
    if (user?.theme === "dark" || user?.theme === "light") {
      setTheme(user.theme);
    }
  }, [user?.theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    try {
      await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch {
      // Silently fail — local state already updated
    }

    if (document.documentElement.getAttribute("data-hc-extension") === "true") {
      document.dispatchEvent(
        new CustomEvent("HC_SAVE_SETTINGS", {
          detail: { theme: newTheme },
        })
      );
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ---- Types ----

export const BUILT_IN_THEMES = [
  "dark",
  "light",
  "midnight",
  "sunset",
  "neon",
] as const;

export type BuiltInTheme = (typeof BUILT_IN_THEMES)[number];

/** CSS variable overrides an admin can set per-venue */
export type ThemeOverrides = Partial<Record<string, string>>;

interface ThemeContextValue {
  /** Current active theme name */
  theme: BuiltInTheme;
  /** Switch to a built-in theme */
  setTheme: (theme: BuiltInTheme) => void;
  /** Apply venue-specific CSS variable overrides (from admin settings) */
  applyOverrides: (overrides: ThemeOverrides) => void;
  /** Clear any venue-specific overrides */
  clearOverrides: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---- Helpers ----

const STORAGE_KEY = "playplay-theme";

/** Maps theme names to the data-theme attribute value (dark = root default, no attribute) */
function getDataThemeValue(theme: BuiltInTheme): string | null {
  return theme === "dark" ? null : theme;
}

function applyThemeToDOM(theme: BuiltInTheme) {
  const root = document.documentElement;
  const value = getDataThemeValue(theme);

  // Add transition class, apply theme, then remove transition class
  root.classList.add("theme-transition");
  if (value) {
    root.setAttribute("data-theme", value);
  } else {
    root.removeAttribute("data-theme");
  }
  // Remove transition class after animation completes
  requestAnimationFrame(() => {
    setTimeout(() => root.classList.remove("theme-transition"), 350);
  });
}

function applyCSSOverrides(overrides: ThemeOverrides) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(overrides)) {
    if (value) {
      // Ensure keys are prefixed with --theme-
      const prop = key.startsWith("--theme-") ? key : `--theme-${key}`;
      root.style.setProperty(prop, value);
    }
  }
}

function clearCSSOverrides() {
  const root = document.documentElement;
  // Remove all inline --theme-* properties
  const style = root.style;
  const toRemove: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style[i];
    if (prop.startsWith("--theme-")) {
      toRemove.push(prop);
    }
  }
  toRemove.forEach((prop) => style.removeProperty(prop));
}

function getStoredTheme(): BuiltInTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && BUILT_IN_THEMES.includes(stored as BuiltInTheme)) {
      return stored as BuiltInTheme;
    }
  } catch {
    // localStorage unavailable
  }
  return "dark";
}

// ---- Provider ----

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BuiltInTheme>(getStoredTheme);

  const setTheme = useCallback((newTheme: BuiltInTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const applyOverrides = useCallback((overrides: ThemeOverrides) => {
    applyCSSOverrides(overrides);
  }, []);

  const clearOverrides = useCallback(() => {
    clearCSSOverrides();
  }, []);

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Apply initial theme immediately (avoid flash)
  useEffect(() => {
    const value = getDataThemeValue(getStoredTheme());
    if (value) {
      document.documentElement.setAttribute("data-theme", value);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, applyOverrides, clearOverrides }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ---- Hook ----

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

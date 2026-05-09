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
  "synthwave",
  "country",
  "disco",
  "punk",
  "pop",
  "hiphop",
] as const;

export type BuiltInTheme = (typeof BUILT_IN_THEMES)[number];

/** Display label for each theme. Picker UIs should render this, not the key. */
export const THEME_LABELS: Record<BuiltInTheme, string> = {
  dark: "Dark",
  light: "Light",
  midnight: "Midnight",
  sunset: "Sunset",
  synthwave: "Outrun",
  country: "Hank",
  disco: "Y2K",
  punk: "Sid",
  pop: "Bubblegum",
  hiphop: "Cypher",
};

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

/**
 * Google Font URLs per theme. Only the active theme's font is loaded.
 * Themes sharing the same font (dark/light → Inter) share a URL so
 * switching between them doesn't trigger a redundant load.
 */
const THEME_FONT_URL: Record<BuiltInTheme, string> = {
  dark: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
  light:
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
  midnight:
    "https://fonts.googleapis.com/css2?family=Din:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap",
  sunset:
    "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap",
  synthwave:
    "https://fonts.googleapis.com/css2?family=Electrolize:wght@400;500;600;700&family=Share+Tech+Mono:wght@400&display=swap",
  country:
    "https://fonts.googleapis.com/css2?family=Bitter:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
  disco:
    "https://fonts.googleapis.com/css2?family=Audiowide&family=Inter:wght@400;500;600;700&display=swap",
  punk: "https://fonts.googleapis.com/css2?family=Anton&family=Special+Elite&display=swap",
  pop: "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap",
  hiphop:
    "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap",
};

const FONT_LINK_ID = "playplay-theme-font";

function loadThemeFont(theme: BuiltInTheme) {
  const url = THEME_FONT_URL[theme];
  const existing = document.getElementById(
    FONT_LINK_ID,
  ) as HTMLLinkElement | null;

  // If the correct font is already loaded, do nothing
  if (existing && existing.href === url) return;

  // Remove old font link if present
  if (existing) existing.remove();

  // Create and inject the new font link
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

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
    // Migration: legacy "neon" / "edm" values were renamed to "synthwave".
    if (stored === "neon" || stored === "edm") {
      try {
        localStorage.setItem(STORAGE_KEY, "synthwave");
      } catch {
        // ignore
      }
      return "synthwave";
    }
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
    loadThemeFont(theme);
  }, [theme]);

  // Apply initial theme immediately (avoid flash)
  useEffect(() => {
    const initial = getStoredTheme();
    const value = getDataThemeValue(initial);
    if (value) {
      document.documentElement.setAttribute("data-theme", value);
    }
    loadThemeFont(initial);
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

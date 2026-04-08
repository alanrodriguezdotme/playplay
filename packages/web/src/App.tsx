import { Routes, Route } from "react-router";
import { useTheme, BUILT_IN_THEMES } from "./contexts/ThemeContext";

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="fixed right-4 top-4 flex gap-2">
      {BUILT_IN_THEMES.map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          className={`rounded-md border px-3 py-1 text-xs font-medium capitalize transition-colors ${
            theme === t
              ? "border-primary bg-primary text-on-primary"
              : "border-border bg-surface-raised text-on-surface-muted hover:text-on-surface"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-on-surface-muted">Coming soon</p>
        <div className="mt-8 flex justify-center gap-3">
          <div className="rounded-lg bg-primary px-4 py-2 text-on-primary">
            Primary
          </div>
          <div className="rounded-lg bg-secondary px-4 py-2 text-on-secondary">
            Secondary
          </div>
          <div className="rounded-lg border border-border bg-surface-raised px-4 py-2">
            Raised
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <ThemeSwitcher />
      <Routes>
        <Route path="/" element={<Placeholder title="PlayPlay Venue" />} />
        <Route path="/venue/:slug" element={<Placeholder title="Queue" />} />
        <Route
          path="/venue/:slug/now-playing"
          element={<Placeholder title="Now Playing" />}
        />
        <Route
          path="/admin"
          element={<Placeholder title="Admin Dashboard" />}
        />
      </Routes>
    </>
  );
}

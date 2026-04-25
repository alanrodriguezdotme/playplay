import { useState, useRef, useCallback } from "react";
import { useParams, useLocation, Outlet, Link } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../hooks/useSocket";
import { useTheme, BUILT_IN_THEMES } from "../../contexts/ThemeContext";
import { QueueProvider } from "../../contexts/QueueContext";
import { ToastProvider } from "../../contexts/ToastContext";
import { Login } from "./Login";

type Tab = "queue" | "search" | "history";

function QueueIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ConnectionIndicator() {
  const { isConnected, hasConnected } = useSocket();
  if (isConnected || !hasConnected) return null;
  return (
    <div className="bg-warning/90 text-center text-xs font-medium text-black py-1">
      Reconnecting…
    </div>
  );
}

function TopBar({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { slug } = useParams<{ slug: string }>();
  const [showThemes, setShowThemes] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-on-surface">
            {slug
              ?.replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Venue"}
          </h1>
          <p className="text-xs text-on-surface-muted">
            {user?.avatarEmoji && (
              <span className="mr-1">{user.avatarEmoji}</span>
            )}
            {user?.displayName || "Patron"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowThemes(!showThemes)}
              className="rounded-md border border-border p-2 text-on-surface-muted hover:text-on-surface"
              aria-label="Change theme"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            </button>
            {showThemes && (
              <div className="absolute right-0 top-full mt-1 flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-2 shadow-lg">
                {BUILT_IN_THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTheme(t);
                      setShowThemes(false);
                    }}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${theme === t
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-muted hover:text-on-surface hover:bg-surface-alt"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className="rounded-md border border-border px-3 py-2 text-xs text-on-surface-muted hover:text-on-surface"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

const TABS: { key: Tab; label: string; Icon: typeof QueueIcon }[] = [
  { key: "queue", label: "Queue", Icon: QueueIcon },
  { key: "search", label: "Search", Icon: SearchIcon },
  { key: "history", label: "History", Icon: HistoryIcon },
];

function BottomNav({ activeTab }: { activeTab: Tab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {TABS.map(({ key, label, Icon }) => (
          <Link
            key={key}
            to={key}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${activeTab === key
                ? "text-primary"
                : "text-on-surface-muted hover:text-on-surface"
              }`}
          >
            <Icon active={activeTab === key} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PatronLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();
  const activeTab = (location.pathname.split("/").pop() || "queue") as Tab;
  const didLogout = useRef(false);

  const handleLogout = useCallback(() => {
    didLogout.current = true;
    logout();
  }, [logout]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-on-surface-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login skipAutoLogin={didLogout.current} />;
  }

  return (
    <ToastProvider>
      <QueueProvider venueSlug={slug!}>
        <div className="flex min-h-screen flex-col bg-surface text-on-surface">
          <ConnectionIndicator />
          <TopBar onLogout={handleLogout} />
          <main className="flex flex-1 flex-col pb-16">
            <Outlet />
          </main>
          <BottomNav activeTab={activeTab} />
        </div>
      </QueueProvider>
    </ToastProvider>
  );
}

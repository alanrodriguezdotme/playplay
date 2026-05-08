import { useState } from "react";
import { useLocation, Outlet, Link } from "react-router";
import { Music, Search, Clock, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../hooks/useSocket";
import { useTheme, BUILT_IN_THEMES } from "../../contexts/ThemeContext";
import { useVenue } from "../../contexts/VenueContext";
import { QueueProvider } from "../../contexts/QueueContext";
import { ToastProvider } from "../../contexts/ToastContext";
import { EditProfileDialog } from "../../components/common/EditProfileDialog";
import { UserBadge } from "../../components/common/UserBadge";
import { Login } from "./Login";
import { Button } from "../../components/common/Button";

type Tab = "queue" | "search" | "history";

function ConnectionIndicator() {
  const { isConnected, hasConnected } = useSocket();
  if (isConnected || !hasConnected) return null;
  return (
    <div className="bg-warning/90 text-center text-xs font-medium text-black py-1">
      Reconnecting…
    </div>
  );
}

function TopBar({ onEditProfile }: { onEditProfile: () => void }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { venue } = useVenue();
  const [showThemes, setShowThemes] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onEditProfile}
          className="min-w-0 flex-1 text-left transition-colors hover:bg-surface-alt -mx-2 px-2 py-1"
          aria-label="Edit profile"
        >
          <h1 className="truncate text-lg font-bold text-on-surface font-family-accent">
            {venue?.name ?? "Venue"}
          </h1>
          <p className="text-xs text-on-surface-muted">
            <UserBadge user={user} />
          </p>
        </button>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="secondary"
              size="icon"
              rounded="none"
              onClick={() => setShowThemes(!showThemes)}
              aria-label="Change theme"
            >
              <Sun className="h-5 w-5" />
            </Button>
            {showThemes && (
              <div className="absolute right-0 top-full mt-1 flex flex-col gap-1 border border-border bg-surface-raised p-2 shadow-lg">
                {BUILT_IN_THEMES.map((t) => (
                  <Button
                    key={t}
                    variant="ghost"
                    size="md"
                    rounded="none"
                    active={theme === t}
                    onClick={() => {
                      setTheme(t);
                      setShowThemes(false);
                    }}
                    className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      theme === t
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-muted hover:text-on-surface hover:bg-surface-alt"
                    }`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
  { key: "queue", label: "Queue", Icon: Music },
  { key: "search", label: "Search", Icon: Search },
  { key: "history", label: "History", Icon: Clock },
];

function BottomNav({ activeTab }: { activeTab: Tab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center">
        {TABS.map(({ key, label, Icon }) => (
          <Link
            key={key}
            to={key}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 h-16 text-xs font-medium transition-colors ${
              activeTab === key
                ? "text-primary"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            <Icon size={24} strokeWidth={activeTab === key ? 2.5 : 2} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PatronLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const activeTab = (location.pathname.split("/").pop() || "queue") as Tab;
  const [showEditProfile, setShowEditProfile] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-on-surface-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <ToastProvider>
      <QueueProvider>
        <div className="flex min-h-screen flex-col bg-surface text-on-surface">
          <ConnectionIndicator />
          <TopBar onEditProfile={() => setShowEditProfile(true)} />
          <main className="flex flex-1 flex-col pb-16">
            <Outlet />
          </main>
          <BottomNav activeTab={activeTab} />
          <EditProfileDialog
            open={showEditProfile}
            onClose={() => setShowEditProfile(false)}
          />
        </div>
      </QueueProvider>
    </ToastProvider>
  );
}

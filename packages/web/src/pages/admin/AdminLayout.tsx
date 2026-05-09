import { useLocation, Link, Outlet } from "react-router";
import {
  LayoutGrid,
  Music,
  ListMusic,
  Users,
  Settings,
  Sun,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../hooks/useSocket";
import { useVenue } from "../../contexts/VenueContext";
import { QueueProvider, useQueue } from "../../contexts/QueueContext";
import { ToastProvider } from "../../contexts/ToastContext";
import { Login } from "../patron/Login";
import { AdminAudioPlayer } from "./AdminAudioPlayer";
import { useCallback, useState } from "react";
import {
  BUILT_IN_THEMES,
  THEME_LABELS,
  useTheme,
} from "../../contexts/ThemeContext";
import { Button } from "../../components/common/Button";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { UserBadge } from "../../components/common/UserBadge";

type AdminTab = "dashboard" | "queue" | "music" | "users" | "settings";

const TABS: { key: AdminTab; label: string; Icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutGrid },
  { key: "queue", label: "Queue", Icon: Music },
  { key: "music", label: "Music", Icon: ListMusic },
  { key: "users", label: "Users", Icon: Users },
  { key: "settings", label: "Settings", Icon: Settings },
];

function ConnectionIndicator() {
  const { isConnected, hasConnected } = useSocket();
  if (isConnected || !hasConnected) return null;
  return (
    <div className="bg-warning/90 text-center text-xs font-medium text-black py-1">
      Reconnecting…
    </div>
  );
}

function AdminTopBar({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { venue } = useVenue();
  const { theme, setTheme } = useTheme();
  const [showThemes, setShowThemes] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg text-on-surface font-family-accent">
              {venue?.name ?? "Venue"}
            </h1>
          </div>
          <div className="flex gap-1 items-center">
            <p className="text-xs text-on-surface-muted">
              <UserBadge user={user} />
            </p>
          </div>
        </div>
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
                    className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium transition-colors ${
                      theme === t
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-muted hover:text-on-surface hover:bg-surface-alt"
                    }`}
                  >
                    {THEME_LABELS[t]}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="icon"
            rounded="none"
            onClick={onLogout}
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ activeTab }: { activeTab: AdminTab }) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border">
      <nav className="flex flex-1 flex-col">
        {TABS.map(({ key, label, Icon }) => (
          <Link
            key={key}
            to={key}
            className={`flex items-center gap-3 p-4 text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-surface-alt text-primary"
                : "text-on-surface-muted hover:bg-surface hover:text-on-surface"
            }`}
          >
            <Icon size={20} strokeWidth={activeTab === key ? 2.5 : 2} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function BottomNav({ activeTab }: { activeTab: AdminTab }) {
  return (
    <nav className="border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex">
        {TABS.map(({ key, label, Icon }) => (
          <Link
            key={key}
            to={key}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              activeTab === key
                ? "text-primary"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            <Icon size={20} strokeWidth={activeTab === key ? 2.5 : 2} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function AudioPlayerBridge() {
  const { nowPlaying, queue } = useQueue();
  const { socket } = useSocket();
  return (
    <AdminAudioPlayer nowPlaying={nowPlaying} queue={queue} socket={socket} />
  );
}

export function AdminLayout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const location = useLocation();
  const activeTab = (location.pathname.split("/").pop() ||
    "dashboard") as AdminTab;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const requestLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const confirmLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    logout();
  }, [logout]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-on-surface-muted">Loading...</div>
      </div>
    );
  }

  if (
    !isAuthenticated ||
    (user && user.role !== "ADMIN") ||
    (user && !user.displayName)
  ) {
    return <Login isAdmin />;
  }

  return (
    <QueueProvider>
      <div className="flex min-h-screen flex-col bg-surface text-on-surface">
        <ConnectionIndicator />
        <AdminTopBar onLogout={requestLogout} />
        <div className="flex flex-1">
          <Sidebar activeTab={activeTab} />
          <main className="flex-1 overflow-y-auto pb-42 md:pb-24">
            <Outlet />
          </main>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <AudioPlayerBridge />
          <BottomNav activeTab={activeTab} />
        </div>
        <ConfirmDialog
          open={showLogoutConfirm}
          title="Log out?"
          message="You'll be signed out of the admin console."
          confirmLabel="Log out"
          variant="destructive"
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      </div>
    </QueueProvider>
  );
}

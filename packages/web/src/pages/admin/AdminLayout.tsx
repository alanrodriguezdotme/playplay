import { useLocation, Link, Outlet } from "react-router";
import {
  LayoutGrid,
  Music,
  ListMusic,
  Users,
  Settings,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../hooks/useSocket";
import { useVenue } from "../../contexts/VenueContext";
import { QueueProvider, useQueue } from "../../contexts/QueueContext";
import { ToastProvider } from "../../contexts/ToastContext";
import { Login } from "../patron/Login";
import { AdminAudioPlayer } from "./AdminAudioPlayer";
import { useState } from "react";
import { BUILT_IN_THEMES, useTheme } from "../../contexts/ThemeContext";
import { Button } from "../../components/common/Button";

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

function AdminTopBar() {
  const { user, logout } = useAuth();
  const { venue } = useVenue();
  const { theme, setTheme } = useTheme();
  const [showThemes, setShowThemes] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold text-on-surface font-family-accent">
              {venue?.name ?? "Venue"}
            </h1>
          </div>
          <div className="flex gap-1 items-center">
            <p className="text-xs text-on-surface-muted">
              {user?.displayName || "Admin"}
            </p>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              👑
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="secondary"
              size="icon"
              rounded="md"
              onClick={() => setShowThemes(!showThemes)}
              aria-label="Change theme"
            >
              <Sun className="h-4 w-4" />
            </Button>
            {showThemes && (
              <div className="absolute right-0 top-full mt-1 flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-2 shadow-lg">
                {BUILT_IN_THEMES.map((t) => (
                  <Button
                    key={t}
                    variant="ghost"
                    size="xs"
                    rounded="md"
                    active={theme === t}
                    onClick={() => {
                      setTheme(t);
                      setShowThemes(false);
                    }}
                    className="whitespace-nowrap capitalize"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" rounded="md" onClick={logout}>
            Log out
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
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const activeTab = (location.pathname.split("/").pop() ||
    "dashboard") as AdminTab;

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
    <ToastProvider>
      <QueueProvider>
        <div className="flex min-h-screen flex-col bg-surface text-on-surface">
          <ConnectionIndicator />
          <AdminTopBar />
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
        </div>
      </QueueProvider>
    </ToastProvider>
  );
}

import { useParams, useLocation, Link, Outlet } from "react-router";
import { LayoutGrid, Music, ListMusic, Users, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../hooks/useSocket";
import { QueueProvider, useQueue } from "../../contexts/QueueContext";
import { ToastProvider } from "../../contexts/ToastContext";
import { Login } from "../patron/Login";
import { AdminAudioPlayer } from "./AdminAudioPlayer";

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
  const { slug } = useParams<{ slug: string }>();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold text-on-surface">
              {slug
                ?.replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Venue"}
            </h1>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Admin
            </span>
          </div>
          <p className="text-xs text-on-surface-muted">
            {user?.displayName || "Admin"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/venue/${slug}`}
            className="rounded-md border border-border px-3 py-2 text-xs text-on-surface-muted hover:text-on-surface"
          >
            Patron View
          </Link>
          <button
            onClick={logout}
            className="rounded-md border border-border px-3 py-2 text-xs text-on-surface-muted hover:text-on-surface"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ activeTab }: { activeTab: AdminTab }) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-surface-alt">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {TABS.map(({ key, label, Icon }) => (
          <Link
            key={key}
            to={key}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === key
              ? "bg-primary/15 text-primary"
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
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${activeTab === key
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

function Unauthorized() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Unauthorized</h1>
        <p className="mt-2 text-on-surface-muted">
          You need admin access to view this page.
        </p>
        <Link
          to={`/venue/${slug}`}
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          Go to Patron View
        </Link>
      </div>
    </div>
  );
}

function AudioPlayerBridge() {
  const { nowPlaying, queue } = useQueue();
  const { socket } = useSocket();
  return (
    <AdminAudioPlayer
      nowPlaying={nowPlaying}
      queue={queue}
      socket={socket}
    />
  );
}

export function AdminLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const activeTab = (location.pathname.split("/").pop() || "dashboard") as AdminTab;

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
      <QueueProvider venueSlug={slug!}>
        <div className="flex min-h-screen flex-col bg-surface text-on-surface">
          <ConnectionIndicator />
          <AdminTopBar />
          <div className="flex flex-1">
            <Sidebar activeTab={activeTab} />
            <main className="flex-1 overflow-y-auto pb-32 md:pb-24">
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

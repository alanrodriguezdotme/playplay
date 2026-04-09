import { useState } from "react";
import { useParams, Link } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../hooks/useSocket";
import { QueueProvider, useQueue } from "../../contexts/QueueContext";
import { ToastProvider } from "../../contexts/ToastContext";
import { Login } from "../patron/Login";
import { DashboardView } from "./DashboardView";
import { QueueManagement } from "./QueueManagement";
import { MusicLibrary } from "./MusicLibrary";
import { UserManagement } from "./UserManagement";
import { SettingsView } from "./SettingsView";
import { AdminAudioPlayer } from "./AdminAudioPlayer";

type AdminTab = "dashboard" | "queue" | "music" | "users" | "settings";

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

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
      className="h-5 w-5"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function MusicIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M21 15V6" />
      <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M12 12H3" />
      <path d="M16 6H3" />
      <path d="M12 18H3" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const TABS: { key: AdminTab; label: string; Icon: typeof DashboardIcon }[] = [
  { key: "dashboard", label: "Dashboard", Icon: DashboardIcon },
  { key: "queue", label: "Queue", Icon: QueueIcon },
  { key: "music", label: "Music", Icon: MusicIcon },
  { key: "users", label: "Users", Icon: UsersIcon },
  { key: "settings", label: "Settings", Icon: SettingsIcon },
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

function Sidebar({
  activeTab,
  onTabChange,
}: {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-surface-alt">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-primary/15 text-primary"
                : "text-on-surface-muted hover:bg-surface hover:text-on-surface"
            }`}
          >
            <Icon active={activeTab === key} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              activeTab === key
                ? "text-primary"
                : "text-on-surface-muted hover:text-on-surface"
            }`}
          >
            <Icon active={activeTab === key} />
            {label}
          </button>
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
      queueLength={queue.length}
      socket={socket}
    />
  );
}

export function AdminLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

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

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardView />;
      case "queue":
        return <QueueManagement />;
      case "music":
        return <MusicLibrary />;
      case "users":
        return <UserManagement />;
      case "settings":
        return <SettingsView />;
    }
  };

  return (
    <ToastProvider>
      <QueueProvider venueSlug={slug!}>
        <div className="flex min-h-screen flex-col bg-surface text-on-surface">
          <ConnectionIndicator />
          <AdminTopBar />
          <div className="flex flex-1">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
              {renderTab()}
            </main>
          </div>
          <AudioPlayerBridge />
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </QueueProvider>
    </ToastProvider>
  );
}

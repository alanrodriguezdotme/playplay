import { Routes, Route, Navigate } from "react-router";
import { PatronLayout } from "./pages/patron/PatronLayout";
import { QueueView } from "./pages/patron/QueueView";
import { SearchView } from "./pages/patron/SearchView";
import { HistoryView } from "./pages/patron/HistoryView";
import { NowPlayingDisplay } from "./pages/display/NowPlayingDisplay";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { DashboardView } from "./pages/admin/DashboardView";
import { QueueManagement } from "./pages/admin/QueueManagement";
import { MusicLibrary } from "./pages/admin/MusicLibrary";
import { UserManagement } from "./pages/admin/UserManagement";
import { SettingsView } from "./pages/admin/SettingsView";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/queue" replace />} />
      <Route element={<PatronLayout />}>
        <Route path="/queue" element={<QueueView />} />
        <Route path="/search" element={<SearchView />} />
        <Route path="/history" element={<HistoryView />} />
      </Route>
      <Route path="/now-playing" element={<NowPlayingDisplay />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardView />} />
        <Route path="queue" element={<QueueManagement />} />
        <Route path="music" element={<MusicLibrary />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>
    </Routes>
  );
}

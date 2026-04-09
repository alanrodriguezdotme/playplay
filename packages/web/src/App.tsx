import { Routes, Route } from "react-router";
import { PatronLayout } from "./pages/patron/PatronLayout";
import { NowPlayingDisplay } from "./pages/display/NowPlayingDisplay";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-on-surface-muted">Coming soon</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="PlayPlay Venue" />} />
      <Route path="/venue/:slug" element={<PatronLayout />} />
      <Route path="/venue/:slug/now-playing" element={<NowPlayingDisplay />} />
      <Route path="/admin" element={<Placeholder title="Admin Dashboard" />} />
    </Routes>
  );
}

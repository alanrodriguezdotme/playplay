import { Routes, Route } from "react-router";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-zinc-400">Coming soon</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="PlayPlay Venue" />} />
      <Route path="/venue/:slug" element={<Placeholder title="Queue" />} />
      <Route
        path="/venue/:slug/now-playing"
        element={<Placeholder title="Now Playing" />}
      />
      <Route path="/admin" element={<Placeholder title="Admin Dashboard" />} />
    </Routes>
  );
}

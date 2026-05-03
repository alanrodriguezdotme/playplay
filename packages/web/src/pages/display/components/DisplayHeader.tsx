import { Maximize } from "lucide-react";

interface DisplayHeaderProps {
  venueSlug: string;
  isFullscreen: boolean;
  show: boolean;
  onToggleFullscreen: () => void;
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function DisplayHeader({
  venueSlug,
  isFullscreen,
  show,
  onToggleFullscreen,
}: DisplayHeaderProps) {
  if (!show && isFullscreen) return null;

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
      {show ? (
        <h1 className="text-xl font-bold text-on-surface">
          {formatSlug(venueSlug)}
        </h1>
      ) : (
        <div />
      )}
      {!isFullscreen && (
        <button
          onClick={onToggleFullscreen}
          className="rounded-lg border border-border p-2 text-on-surface-muted transition-colors hover:bg-surface-alt hover:text-on-surface"
          aria-label="Enter fullscreen"
        >
          <Maximize className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}

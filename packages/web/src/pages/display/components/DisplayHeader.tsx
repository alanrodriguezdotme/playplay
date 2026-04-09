interface DisplayHeaderProps {
  venueSlug: string;
  isFullscreen: boolean;
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
  onToggleFullscreen,
}: DisplayHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
      <h1 className="text-xl font-bold text-on-surface">
        {formatSlug(venueSlug)}
      </h1>
      {!isFullscreen && (
        <button
          onClick={onToggleFullscreen}
          className="rounded-lg border border-border p-2 text-on-surface-muted transition-colors hover:bg-surface-alt hover:text-on-surface"
          aria-label="Enter fullscreen"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      )}
    </header>
  );
}

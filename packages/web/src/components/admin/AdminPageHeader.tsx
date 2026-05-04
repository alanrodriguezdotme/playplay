import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronDown } from "lucide-react";

export function AdminPageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex items-center justify-between p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="flex items-center gap-2">
        {children}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-on-surface-muted hover:text-on-surface"
          >
            Views
            <ChevronDown className="h-3 w-3" />
          </button>
          {open && (
            <div className="absolute right-0 z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-surface-raised py-1 shadow-lg">
              <Link
                to="/"
                className="block px-3 py-2 text-xs font-medium text-on-surface-muted hover:bg-surface hover:text-on-surface"
                onClick={() => setOpen(false)}
              >
                Patron View
              </Link>
              <Link
                to="/now-playing"
                className="block px-3 py-2 text-xs font-medium text-on-surface-muted hover:bg-surface hover:text-on-surface"
                onClick={() => setOpen(false)}
              >
                Display View
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { getVenueCode } from "../../../api/auth";

interface DisplayVenueCodeProps {
  venueSlug: string;
}

export function DisplayVenueCode({ venueSlug }: DisplayVenueCodeProps) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const fetchCode = useCallback(() => {
    getVenueCode(venueSlug)
      .then((data) => {
        setCode(data.code);
        setExpiresAt(data.expiresAt);
      })
      .catch(() => {
        setCode(null);
      });
  }, [venueSlug]);

  // Fetch code on mount and refresh before expiry
  useEffect(() => {
    fetchCode();
    const interval = setInterval(fetchCode, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchCode]);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        fetchCode(); // code expired, fetch a new one
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, fetchCode]);

  if (!code) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-raised px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-primary">
        Join Code
      </div>
      <div className="font-mono text-2xl font-bold tracking-[0.2em] text-on-surface">
        {code}
      </div>
      <div className="text-xs text-on-surface-muted">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

interface DisplayVenueOtpProps {
  code: string;
  deviceHint: string;
  onExpired: () => void;
}

export function DisplayVenueOtp({
  code,
  deviceHint,
  onExpired,
}: DisplayVenueOtpProps) {
  useEffect(() => {
    const timer = setTimeout(onExpired, 60_000);
    return () => clearTimeout(timer);
  }, [onExpired]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="rounded-2xl bg-surface-raised p-8 text-center shadow-2xl">
        <p className="mb-2 text-sm text-on-surface-muted">
          {deviceHint} is requesting access
        </p>
        <p className="font-mono text-5xl font-bold tracking-[0.3em] text-primary">
          {code}
        </p>
        <p className="mt-4 text-xs text-on-surface-muted">
          Enter this code on the device to continue
        </p>
      </div>
    </div>
  );
}

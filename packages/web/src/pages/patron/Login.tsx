import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  deviceRegister,
  deviceLogin,
  getVenueInfo,
  adminLogin,
  setDisplayName,
} from "../../api/auth";
import { getDeviceId } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { ApiRequestError } from "../../api/client";
import { EmojiAvatarPicker } from "../../components/patron/EmojiAvatarPicker";
import type { AuthResponse } from "@playplay/shared";

type Step = "register" | "admin-login" | "admin-name";

function getInitialAdminStep(
  user: { displayName?: string | null; role?: string } | null,
): Step {
  if (user?.role === "ADMIN" && !user.displayName) return "admin-name";
  return "admin-login";
}

export function Login({
  isAdmin = false,
  skipAutoLogin = false,
}: { isAdmin?: boolean; skipAutoLogin?: boolean } = {}) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { login, updateUser, user: currentUser } = useAuth();

  const [step, setStep] = useState<Step>(
    isAdmin ? getInitialAdminStep(currentUser) : "register",
  );
  const [name, setName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("🎤");
  const [venueCode, setVenueCode] = useState("");
  const [requiresVenueCode, setRequiresVenueCode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const deviceId = getDeviceId();

  // Check if venue requires a code & auto-login
  useEffect(() => {
    if (!slug || autoLoginAttempted) return;
    setAutoLoginAttempted(true);

    // Fetch venue auth requirements
    if (!isAdmin) {
      getVenueInfo(slug)
        .then((info) => {
          if (info.requiresVenueCode) setRequiresVenueCode(true);
        })
        .catch(() => { });
    }

    // Auto-login with existing device
    if (!isAdmin && !skipAutoLogin) {
      deviceLogin(deviceId, slug)
        .then((res) => {
          login(res.token, res.user);
          navigate(`/venue/${slug}`);
        })
        .catch(() => {
          // Not registered yet — stay on registration form
        });
    }
  }, [
    slug,
    deviceId,
    isAdmin,
    skipAutoLogin,
    autoLoginAttempted,
    login,
    navigate,
  ]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError("");
    setLoading(true);

    try {
      const res = await deviceRegister(
        deviceId,
        slug,
        name,
        avatarEmoji,
        requiresVenueCode ? venueCode : undefined,
      );

      const authRes = res as AuthResponse;
      login(authRes.token, authRes.user);
      navigate(`/venue/${slug}`);
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        err.code === "VENUE_CODE_REQUIRED"
      ) {
        // Field should already be visible from venue-info, but handle just in case
        setRequiresVenueCode(true);
      } else if (err instanceof ApiRequestError && err.status === 409) {
        // Already registered — try login
        try {
          const loginRes = await deviceLogin(deviceId, slug);
          login(loginRes.token, loginRes.user);
          navigate(`/venue/${slug}`);
          return;
        } catch {
          // Fall through to show error
        }
      }
      setError(
        err instanceof ApiRequestError ? err.message : "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  }

  // ---- Admin login ----

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError("");
    setLoading(true);

    try {
      const res = await adminLogin(email, password, slug);
      login(res.token, res.user);

      if (!res.user.displayName) {
        setStep("admin-name");
      } else {
        navigate(`/venue/${slug}/admin`);
      }
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSetName(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError("");
    setLoading(true);

    try {
      const updated = await setDisplayName(name);
      updateUser(updated);
      navigate(`/venue/${slug}/admin`);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Failed to set name",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-3xl font-bold text-on-surface">
          PlayPlay
        </h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Patron registration */}
        {step === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <EmojiAvatarPicker value={avatarEmoji} onChange={setAvatarEmoji} />
            <label className="block">
              <span className="text-sm text-on-surface-muted">
                What should we call you?
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={30}
                required
                className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            {requiresVenueCode && (
              <label className="block">
                <span className="text-sm text-on-surface-muted">
                  Enter the code shown on the venue screen
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={venueCode}
                  onChange={(e) =>
                    setVenueCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="000000"
                  required
                  className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-center text-2xl tracking-widest text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={
                loading ||
                !name.trim() ||
                (requiresVenueCode && venueCode.length !== 6)
              }
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-on-primary transition-opacity disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Venue"}
            </button>
          </form>
        )}

        {/* Admin login */}
        {step === "admin-login" && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <label className="block">
              <span className="text-sm text-on-surface-muted">Venue Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@venue.local"
                required
                className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm text-on-surface-muted">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-on-primary transition-opacity disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* Admin display name step */}
        {step === "admin-name" && (
          <form onSubmit={handleSetName} className="space-y-4">
            <label className="block">
              <span className="text-sm text-on-surface-muted">
                What should we call you?
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={30}
                required
                className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-on-primary transition-opacity disabled:opacity-50"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

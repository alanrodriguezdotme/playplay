import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { requestOtp, verifyOtp, setDisplayName } from "../../api/auth";
import { useAuth } from "../../contexts/AuthContext";
import { ApiRequestError } from "../../api/client";

type Step = "phone" | "otp" | "display-name";

export function Login({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { login, updateUser } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError("");
    setLoading(true);

    try {
      await requestOtp(phone, slug, isAdmin ? email : undefined);
      setStep("otp");
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Failed to send OTP",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError("");
    setLoading(true);

    try {
      const res = await verifyOtp(phone, code, slug);
      login(res.token, res.user);

      if (!res.user.displayName) {
        setStep("display-name");
      } else {
        navigate(isAdmin ? `/venue/${slug}/admin` : `/venue/${slug}`);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Invalid OTP");
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
      navigate(isAdmin ? `/venue/${slug}/admin` : `/venue/${slug}`);
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

        {step === "phone" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <label className="block">
              <span className="text-sm text-on-surface-muted">
                Phone Number
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                required
                className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            {isAdmin && (
              <label className="block">
                <span className="text-sm text-on-surface-muted">
                  Venue Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@venue.local"
                  required
                  className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={loading || !phone.trim() || (isAdmin && !email.trim())}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-on-primary transition-opacity disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-center text-sm text-on-surface-muted">
              Enter the 6-digit code sent to {phone}
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
              className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-center text-2xl tracking-widest text-on-surface placeholder-on-surface-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-on-primary transition-opacity disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError("");
              }}
              className="w-full text-sm text-on-surface-muted hover:text-on-surface"
            >
              Use a different number
            </button>
          </form>
        )}

        {step === "display-name" && (
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

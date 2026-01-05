"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    // When the user clicks the reset link, Supabase will place tokens in the URL.
    // supabase-js will exchange those for a temporary session automatically.
    const init = async () => {
      setError(null);
      setInfo(null);

      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);

      // Also listen in case the session arrives a moment later
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setHasSession(!!session);
      });

      setReady(true);

      return () => {
        sub.subscription.unsubscribe();
      };
    };

    init();
  }, []);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!hasSession) {
      setError(
        "This reset link is not active. Please go back and request a new password reset email."
      );
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setInfo("Password updated successfully. Redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (err: any) {
      setError(err?.message ?? "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600">Loading reset page…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">Reset Password</h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter a new password for your account.
        </p>

        {!hasSession && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This link is missing an active reset session. Go back to{" "}
            <span className="font-medium">Login</span> and click{" "}
            <span className="font-medium">Forgot password</span> again to get a
            fresh link.
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium">New Password</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={!hasSession || loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                disabled={!hasSession || loading}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">Confirm Password</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="w-full rounded-md border px-3 py-2 outline-none focus:ring"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                disabled={!hasSession || loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                disabled={!hasSession || loading}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {info && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {info}
            </div>
          )}

          <button
            type="submit"
            disabled={!hasSession || loading}
            className="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/login")}
            className="w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back to Login
          </button>
        </form>
      </div>
    </main>
  );
}

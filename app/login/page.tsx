"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, go to intake (but only if session actually exists)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/intake");
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }

    router.replace("/intake");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Client Login</h1>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded border px-3 py-2 text-sm"
        >
          Back
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded border bg-white p-5">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}

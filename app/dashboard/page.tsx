"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-center">
      <div className="flex justify-center">
        <Image
          src="/ea-logo.jpg"
          alt="Elite Advantage Tax Enterprise"
          width={520}
          height={220}
          priority
        />
      </div>

      <h1 className="mt-6 text-2xl font-semibold">
        Welcome to Elite Advantage Tax Enterprise
      </h1>

      <p className="mt-2 text-gray-600">
        Please sign in to complete your intake. You can save your draft as you go.
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded bg-teal-700 px-4 py-2 text-white"
        >
          Client Login
        </button>

        <button
          type="button"
          onClick={() => router.push("/intake")}
          className="rounded border px-4 py-2"
        >
          Go to Intake
        </button>
      </div>
    </main>
  );
}

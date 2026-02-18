"use client";

import { useState } from "react";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/login", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Login failed" }));
      setError(data.error ?? "Login failed");
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[#cfbea6] bg-white/70 p-8 shadow-[0_14px_34px_rgba(28,20,14,0.12)] backdrop-blur-sm">
      <h1 className="text-4xl font-semibold text-stampblue">Stamp Collection</h1>
      <p className="text-sm tracking-wide text-stone-700">Use seeded account: `admin@example.com` / `password123`</p>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required autoComplete="current-password" />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary px-4 py-2 disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

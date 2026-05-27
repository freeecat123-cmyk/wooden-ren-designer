"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "ok" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "en-coming-soon" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("ok");
      setMessage(
        data?.already
          ? "You're already on the list — we'll be in touch."
          : "You're in. We'll email you when it's ready.",
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "submitting"}
        className="flex-1 rounded-lg bg-zinc-950/60 border border-amber-200/20 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-lg bg-amber-200 px-6 py-3 font-medium text-zinc-900 hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {status === "submitting" ? "Joining…" : "Get early access"}
      </button>
      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`sm:basis-full text-sm ${
            status === "ok" ? "text-amber-200" : "text-red-300"
          }`}
        >
          {message}
        </div>
      )}
    </form>
  );
}

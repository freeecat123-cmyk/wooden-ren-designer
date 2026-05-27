"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { detectWebviewApp, isInAppBrowser } from "@/lib/webview";

type Mode = "idle" | "sending" | "sent" | "error";

export function LoginButton({ className = "" }: { className?: string }) {
  const t = useTranslations("loginButton");
  const [open, setOpen] = useState(false);
  const [webviewApp, setWebviewApp] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWebviewApp(detectWebviewApp());
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-amber-900/10 hover:bg-amber-800 hover:shadow-md active:scale-[0.98] transition ${className}`}
      >
        {t("btn")}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-xl overflow-hidden z-50">
          <div className="p-4">
            {webviewApp && <WebviewWarning app={webviewApp} />}
            <MagicLinkForm />
            <div className="my-3 flex items-center gap-2 text-xs text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200" />
              <span>{t("divider")}</span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>
            <GoogleButton
              disabledReason={webviewApp ? t("googleDisabledTpl", { app: webviewApp }) : null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function WebviewWarning({ app }: { app: string }) {
  const t = useTranslations("loginButton");
  return (
    <div className="mb-3 rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900">
      <div className="font-semibold mb-1">{t("webviewWarnTpl", { app })}</div>
      <div className="leading-relaxed">
        {t("webviewBody")}
        <ul className="mt-1 ml-4 list-disc">
          <li>
            {t("webviewBullet1Pre")}
            <b>{t("webviewBullet1Strong")}</b>
            {t("webviewBullet1Suffix")}
          </li>
          <li>{t("webviewBullet2")}</li>
        </ul>
      </div>
    </div>
  );
}

function zhAuthError(
  msg: string,
  t: ReturnType<typeof useTranslations<"loginButton">>,
): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) return t("errRate");
  if (m.includes("invalid email") || m.includes("invalid format") || m.includes("invalid address")) {
    return t("errInvalid");
  }
  if (m.includes("not found") || m.includes("no user")) {
    return t("errNotFound");
  }
  if (m.includes("user not allowed") || m.includes("signup disabled")) {
    return t("errSignupDisabled");
  }
  if (m.includes("network") || m.includes("fetch") || m.includes("timeout")) {
    return t("errNetwork");
  }
  return t("errFallbackTpl", { msg });
}

export function MagicLinkForm() {
  const t = useTranslations("loginButton");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setMode("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          window.location.pathname + window.location.search,
        )}`,
      },
    });
    if (error) {
      setMode("error");
      setError(zhAuthError(error.message, t));
    } else {
      setMode("sent");
    }
  }

  if (mode === "sent") {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-sm text-emerald-900">
        <div className="font-semibold mb-1">{t("sentH")}</div>
        <div className="text-xs leading-relaxed">
          {t("sentBodyPre")}
          <b>{email}</b>
          {t("sentBodySuffix")}
          <br />
          {t("sentNoEmail")}
          <button
            type="button"
            className="underline ml-1"
            onClick={() => setMode("idle")}
          >
            {t("resend")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label className="block text-sm font-medium text-zinc-700">
        {t("magicLinkLabel")}
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        autoComplete="email"
        required
        disabled={mode === "sending"}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-zinc-100"
      />
      <button
        type="submit"
        disabled={mode === "sending"}
        className="w-full rounded-lg bg-amber-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-800 hover:shadow active:scale-[0.99] disabled:opacity-60 transition"
      >
        {mode === "sending" ? t("sending") : t("magicLinkBtn")}
      </button>
      {error && (
        <div className="text-xs text-rose-700">{error}</div>
      )}
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {t("magicLinkNote")}
      </p>
    </form>
  );
}

export function GoogleButton({ disabledReason }: { disabledReason: string | null }) {
  const t = useTranslations("loginButton");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          window.location.pathname + window.location.search,
        )}`,
      },
    });
    if (error) {
      console.error("Login error:", error);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading || !!disabledReason}
        title={disabledReason ?? undefined}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 shadow-sm hover:bg-zinc-50 hover:ring-zinc-400 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <GoogleLogo />
        <span>{loading ? t("googleRedirecting") : t("googleBtn")}</span>
      </button>
      {disabledReason && (
        <p className="mt-1 text-[11px] text-zinc-500 text-center">{disabledReason}</p>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a10.99 10.99 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

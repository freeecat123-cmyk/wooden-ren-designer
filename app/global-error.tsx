"use client";

const COPY = {
  en: {
    h: "Something went wrong",
    bodyPre: "Please retry or refresh the page. If the issue keeps happening, contact Wooden Ren at ",
    bodySuf: ".",
    retry: "Retry",
    htmlLang: "en",
  },
  zh: {
    h: "發生嚴重錯誤",
    bodyPre: "請重試，或重新整理頁面。如果一直發生，請聯絡木頭仁 ",
    bodySuf: "。",
    retry: "重試",
    htmlLang: "zh-Hant",
  },
} as const;

function detectLocale(): "en" | "zh" {
  if (typeof window === "undefined") return "zh";
  return window.location.pathname.startsWith("/en") ? "en" : "zh";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const c = COPY[detectLocale()];
  return (
    <html lang={c.htmlLang}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#fafaf7",
          color: "#27272a",
          padding: "96px 16px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 60 }}>💥</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginTop: 12 }}>
          {c.h}
        </h1>
        <p style={{ marginTop: 8, color: "#52525b" }}>
          {c.bodyPre}
          wengbinren@gmail.com{c.bodySuf}
        </p>
        <pre
          style={{
            display: "inline-block",
            marginTop: 12,
            background: "#f4f4f5",
            color: "#71717a",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {error.message || "Unknown error"}
          {error.digest ? ` · digest:${error.digest}` : ""}
        </pre>
        <div style={{ marginTop: 24 }}>
          <button
            onClick={reset}
            style={{
              background: "#18181b",
              color: "white",
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            {c.retry}
          </button>
        </div>
      </body>
    </html>
  );
}

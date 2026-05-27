import type { Metadata } from "next";
import { WaitlistForm } from "./WaitlistForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

export const metadata: Metadata = {
  title: "Wooden Ren Designer — Asian Joinery Furniture Design Tool",
  description:
    "Design furniture with traditional Japanese-Chinese joinery in seconds. AI-assisted 3D views, auto-generated cut lists, and joinery details. Coming soon to English markets.",
  alternates: {
    canonical: `${SITE_URL}/en`,
    languages: {
      "en": `${SITE_URL}/en`,
      "zh-TW": SITE_URL,
      "x-default": SITE_URL,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/en`,
    siteName: "Wooden Ren Designer",
    title: "Wooden Ren Designer — Asian Joinery Furniture Design Tool",
    description:
      "Design furniture with traditional Japanese-Chinese joinery in seconds. Coming soon.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Wooden Ren Designer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wooden Ren Designer",
    description:
      "Design furniture with traditional Japanese-Chinese joinery in seconds. Coming soon.",
    images: ["/og.png"],
  },
};

export default function ComingSoonPage() {
  return (
    <main
      lang="en"
      className="min-h-screen bg-gradient-to-b from-[#1c1410] via-[#241914] to-[#1a120d] text-zinc-100 flex flex-col"
    >
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center gap-3 text-sm text-amber-200/80">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-300/80 animate-pulse" />
            Now in private beta · English version coming soon
          </div>

          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-amber-50 leading-[1.05]">
            Furniture design,
            <br />
            with real{" "}
            <span className="italic text-amber-200">joinery</span>.
          </h1>

          <p className="mt-6 text-lg text-zinc-300 leading-relaxed max-w-xl">
            Wooden Ren Designer turns dimensions into a complete plan in seconds —
            3D views, exploded diagrams, cut lists, and traditional Japanese-Chinese
            joinery details. Built by a 200K-subscriber woodworking YouTuber for
            people who want to build, not draw.
          </p>

          <ul className="mt-8 space-y-2 text-zinc-300/90 text-base">
            <li className="flex gap-3">
              <span className="text-amber-300/80">✦</span>
              Mortise &amp; tenon, dovetail, dado — generated, not drawn
            </li>
            <li className="flex gap-3">
              <span className="text-amber-300/80">✦</span>
              Auto cut list in board feet or millimeters
            </li>
            <li className="flex gap-3">
              <span className="text-amber-300/80">✦</span>
              AI suggests proportions from a reference photo
            </li>
            <li className="flex gap-3">
              <span className="text-amber-300/80">✦</span>
              Letter / A4 PDF, ready for the shop wall
            </li>
          </ul>

          <div className="mt-12 rounded-2xl border border-amber-200/15 bg-zinc-900/40 backdrop-blur p-6 sm:p-8">
            <div className="text-amber-100/90 font-medium mb-1">
              Join the waitlist
            </div>
            <div className="text-sm text-zinc-400 mb-5">
              First 100 testers get <span className="text-amber-200">50% off for life</span>.
            </div>
            <WaitlistForm />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-zinc-500">
            <a
              href="https://www.youtube.com/@WoodenRen"
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-200 transition-colors"
            >
              YouTube · @WoodenRen
            </a>
            <a
              href="https://woodenren.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-200 transition-colors"
            >
              woodenren.com
            </a>
            <a
              href="/"
              className="hover:text-amber-200 transition-colors"
              hrefLang="zh-TW"
            >
              中文版 (繁體)
            </a>
          </div>
        </div>
      </div>

      <footer className="border-t border-amber-200/10 px-6 py-6 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} Wooden Ren Education Co., Ltd. — Keelung, Taiwan
      </footer>
    </main>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoginButton } from "@/components/auth/LoginButton";

export function StudentLoginHint() {
  const t = useTranslations("studentLoginHint");
  const { user, loading } = useAuth();
  if (loading || user) return null;

  return (
    <div className="mb-6 sm:mb-8 flex justify-center">
      <div
        className="relative max-w-2xl w-full rounded-2xl border-2 px-5 py-4 sm:px-6 sm:py-5 flex items-start gap-3 sm:gap-4"
        style={{ background: "#fff8ee", borderColor: "#d4a574" }}
      >
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={t("logoAlt")}
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white object-contain border border-[#d4a574]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#5a3812] text-sm sm:text-base">
            {t("h")}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#7c4f1a] leading-relaxed">
            {t("body")}
          </p>
          <div className="mt-2 sm:mt-3">
            <LoginButton />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useUnit } from "@/hooks/useUnit";
import { formatMm } from "@/lib/units/format";

interface PhotoResponse {
  category: string;
  length: number;
  width: number;
  height: number;
  material?: string;
  style?: string;
  legShape?: string;
  legSize?: number;
  rationale: string;
  confidence: "high" | "medium" | "low";
  warnings?: string[];
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-emerald-700 bg-emerald-50 border-emerald-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  low: "text-red-700 bg-red-50 border-red-200",
};

/** 圖片壓縮：max 1024px 邊長，jpeg quality 0.85 → 通常 <500KB */
async function compressImage(
  file: File,
  errors: { readFail: string; decodeFail: string; canvasFail: string },
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(errors.readFail));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(errors.decodeFail));
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error(errors.canvasFail));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve({ base64, mediaType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function PhotoToParamsButton() {
  const t = useTranslations("photoToParams");
  const tErr = useTranslations("photoToParams.errors");
  const unit = useUnit();

  const resolveServerError = (
    code: unknown,
    params: Record<string, unknown> | undefined,
  ): string => {
    if (typeof code !== "string" || !code) return t("errRecognize");
    try {
      // next-intl throws if key is missing; fall back to generic recognition error.
      return tErr(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code as any,
        (params ?? {}) as Record<string, string | number>,
      );
    } catch {
      return t("errRecognize");
    }
  };
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhotoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorUpgrade, setErrorUpgrade] = useState<{ url: string; label: string } | null>(null);

  const confidenceLabel = (k: string): string => {
    if (k === "high") return t("confidenceHigh");
    if (k === "medium") return t("confidenceMedium");
    if (k === "low") return t("confidenceLow");
    return k;
  };

  useEffect(() => {
    fetch("/api/photo-to-params").then(async (r) => {
      try {
        const j = await r.json();
        setAvailable(!!j.available);
      } catch {
        setAvailable(false);
      }
    }).catch(() => setAvailable(false));
  }, []);

  if (!available) return null;

  const handleFile = async (file: File) => {
    setError(null); setErrorUpgrade(null);
    setResult(null);
    setLoading(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error(t("errSelectImage"));
      if (file.size > 10 * 1024 * 1024) throw new Error(t("errSize10MB"));
      const { base64, mediaType } = await compressImage(file, {
        readFail: t("errReadFail"),
        decodeFail: t("errDecodeFail"),
        canvasFail: t("errCanvasFail"),
      });
      setPreview(`data:${mediaType};base64,${base64}`);
      const res = await fetch("/api/photo-to-params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgradeUrl) setErrorUpgrade({ url: data.upgradeUrl, label: data.upgradeLabel ?? t("upgradeFallback") });
        throw new Error(resolveServerError(data.error, data.errorParams));
      }
      setResult(data as PhotoResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errUnknown"));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    const params = new URLSearchParams();
    params.set("length", String(result.length));
    params.set("width", String(result.width));
    params.set("height", String(result.height));
    if (result.material) params.set("material", result.material);
    if (result.style) params.set("style", result.style);
    if (result.legShape) params.set("legShape", result.legShape);
    if (result.legSize) params.set("legSize", String(result.legSize));
    router.push(`/design/${result.category}?${params.toString()}`);
    setOpen(false);
    setResult(null);
    setPreview(null);
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen(false);
    setResult(null);
    setPreview(null);
    setError(null); setErrorUpgrade(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-violet-50 hover:ring-violet-400 transition"
        title={t("btnTitle")}
      >
        <span>📷</span>
        <span>{t("btnLabel")}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-base font-semibold">{t("modalH")}</h2>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>

            {!preview && !loading && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-zinc-300 rounded-lg p-8 text-center hover:border-violet-400 hover:bg-violet-50/30"
              >
                <div className="text-4xl mb-2">🖼️</div>
                <div className="text-sm text-zinc-700 mb-1">{t("dropZoneH")}</div>
                <div className="text-[11px] text-zinc-500">{t("dropZoneSub")}</div>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            {preview && (
              <div className="mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={t("previewAlt")} className="w-full max-h-48 object-contain rounded border border-zinc-200" />
              </div>
            )}

            {loading && (
              <div className="text-center py-4 text-sm text-zinc-600">
                <span className="inline-block animate-pulse">{t("loading")}</span>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-xs p-3 mb-2">
                <div>⚠️ {error}</div>
                {errorUpgrade && (
                  <a
                    href={errorUpgrade.url}
                    className="mt-1 inline-block font-semibold underline hover:text-red-900"
                  >
                    {errorUpgrade.label}
                  </a>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${CONFIDENCE_COLOR[result.confidence] ?? ""}`}>
                    {confidenceLabel(result.confidence)}
                  </span>
                  <span className="font-mono text-zinc-700">{result.category}</span>
                  <span className="font-mono text-zinc-500">
                    {result.length}×{result.width}×{result.height}mm
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {result.material && <div><span className="text-zinc-500">{t("lblMaterial")}</span>{result.material}</div>}
                  {result.style && <div><span className="text-zinc-500">{t("lblStyle")}</span>{result.style}</div>}
                  {result.legShape && <div><span className="text-zinc-500">{t("lblLegShape")}</span>{result.legShape}</div>}
                  {result.legSize && <div><span className="text-zinc-500">{t("lblLegSize")}</span>{formatMm(result.legSize, unit)}</div>}
                </div>

                <div className="text-[11px] text-zinc-700 leading-relaxed bg-zinc-50 rounded p-2 border border-zinc-200">
                  {result.rationale}
                </div>

                {result.warnings && result.warnings.length > 0 && (
                  <ul className="text-[10px] text-amber-700 list-disc list-inside">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}

                <div className="text-[10px] text-zinc-500 italic">
                  {t("estimatedWarn")}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex-1 px-3 py-2 rounded bg-violet-600 text-white text-xs font-medium hover:bg-violet-700"
                  >
                    {t("applyBtn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setPreview(null);
                      setError(null); setErrorUpgrade(null);
                    }}
                    className="px-3 py-2 rounded border border-zinc-300 text-xs hover:bg-zinc-50"
                  >
                    {t("redoBtn")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

const CONFIDENCE_LABEL: Record<string, { label: string; color: string }> = {
  high: { label: "信心高", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  medium: { label: "信心中", color: "text-amber-700 bg-amber-50 border-amber-200" },
  low: { label: "信心低", color: "text-red-700 bg-red-50 border-red-200" },
};

/** 圖片壓縮：max 1024px 邊長，jpeg quality 0.85 → 通常 <500KB */
async function compressImage(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("讀檔失敗"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("解碼失敗"));
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
        if (!ctx) return reject(new Error("canvas 失敗"));
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhotoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("請選圖片檔");
      if (file.size > 10 * 1024 * 1024) throw new Error("圖檔不能超過 10MB");
      const { base64, mediaType } = await compressImage(file);
      setPreview(`data:${mediaType};base64,${base64}`);
      const res = await fetch("/api/photo-to-params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "辨識失敗");
      setResult(data as PhotoResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知錯誤");
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
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-violet-50 hover:ring-violet-400 transition"
        title="上傳家具照，AI 推測類別/尺寸/木種/風格，自動套進設計器"
      >
        <span>📷</span>
        <span>照片轉設計</span>
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
              <h2 className="text-base font-semibold">📷 照片轉設計</h2>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>

            {!preview && !loading && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-zinc-300 rounded-lg p-8 text-center hover:border-violet-400 hover:bg-violet-50/30"
              >
                <div className="text-4xl mb-2">🖼️</div>
                <div className="text-sm text-zinc-700 mb-1">點選 / 拖入家具照片</div>
                <div className="text-[11px] text-zinc-500">jpeg / png / webp · 最大 10MB</div>
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
                <img src={preview} alt="預覽" className="w-full max-h-48 object-contain rounded border border-zinc-200" />
              </div>
            )}

            {loading && (
              <div className="text-center py-4 text-sm text-zinc-600">
                <span className="inline-block animate-pulse">🔍 AI 辨識中…（約 5-10 秒）</span>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-xs p-3 mb-2">
                ⚠️ {error}
              </div>
            )}

            {result && (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] ${CONFIDENCE_LABEL[result.confidence]?.color ?? ""}`}>
                    {CONFIDENCE_LABEL[result.confidence]?.label ?? result.confidence}
                  </span>
                  <span className="font-mono text-zinc-700">{result.category}</span>
                  <span className="font-mono text-zinc-500">
                    {result.length}×{result.width}×{result.height}mm
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {result.material && <div><span className="text-zinc-500">木種：</span>{result.material}</div>}
                  {result.style && <div><span className="text-zinc-500">風格：</span>{result.style}</div>}
                  {result.legShape && <div><span className="text-zinc-500">腳形：</span>{result.legShape}</div>}
                  {result.legSize && <div><span className="text-zinc-500">腳粗：</span>{result.legSize}mm</div>}
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
                  ⚠️ 尺寸是 AI 估的不是量的，套用後請依實際需求調整
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex-1 px-3 py-2 rounded bg-violet-600 text-white text-xs font-medium hover:bg-violet-700"
                  >
                    套用到設計器
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setPreview(null);
                      setError(null);
                    }}
                    className="px-3 py-2 rounded border border-zinc-300 text-xs hover:bg-zinc-50"
                  >
                    重來
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

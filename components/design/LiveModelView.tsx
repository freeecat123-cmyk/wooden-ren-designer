"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { FurnitureCategory, FurnitureDesign } from "@/lib/types";
import type { AssemblyPlan } from "@/lib/assembly/plan";
import type { DesignAccess } from "@/lib/design/compute-design";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { DESIGN_PREVIEW_EVENT, designSearchKey } from "@/lib/design/navigation-pending";

/**
 * 3D 即時預覽：表單一改，瀏覽器先用同一套規則（lib/design/compute-design）算出模型換上去，
 * 不等 server。server 整頁重算回來後（三視圖、材料單、報價跟著更新）就換回 server 版。
 *
 * 為什麼（2026-10-17 木頭仁：「調整參數要等好幾秒」）：原本每改一次都要
 * debounce → 改網址 → 美東 server 整頁重算 → 傳回來，實測 1～2 秒，登入後更久。
 * 模板本身最重的也只要 12ms，等的全是網路。
 *
 * 規則：
 * - 只換 3D，不動網址、不動存檔；存檔 / 匯出仍等 server 追上（StudioActionGuard）。
 * - 付費鎖 / 尺寸上限吃 server 傳下來的 access，跟 server 同一個函式判斷。
 * - 算失敗就不預覽，畫面維持 server 版，等 server 結果。
 * - 模板程式第一次改參數時才載入（閒置時預先抓），不拖慢開頁。
 */

type ComputeModules = [typeof import("@/lib/templates"), typeof import("@/lib/design/compute-design")];
let modulesPromise: Promise<ComputeModules> | null = null;
function loadCompute() {
  modulesPromise ??= Promise.all([import("@/lib/templates"), import("@/lib/design/compute-design")]);
  return modulesPromise;
}

interface Preview {
  key: string;
  design: FurnitureDesign;
  assemblyPlan: AssemblyPlan;
  joineryMode: boolean;
}

export function LiveModelView({
  type,
  locale,
  previewLocked,
  canBypassLimits,
  resolvedSearch,
  design,
  assemblyPlan,
  joineryMode,
  ...rest
}: ComponentProps<typeof LazyPerspectiveView> & {
  type: string;
  locale: string;
  /** 同 server 的 DesignAccess（拆成兩個布林，避免每次 render 新物件讓監聽重掛） */
  previewLocked: DesignAccess["previewLocked"];
  canBypassLimits: DesignAccess["canBypassLimits"];
  /** server 這次 render 用的網址參數（URLSearchParams 字串） */
  resolvedSearch: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const latestPreviewKey = useRef<string | null>(null);
  const latestNavKey = useRef<string | null>(null);
  const pending = useRef<string | null>(null);
  const frame = useRef<number | null>(null);
  const serverKey = designSearchKey(resolvedSearch);
  const serverKeyRef = useRef(serverKey);
  serverKeyRef.current = serverKey;

  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const prefetch = () => { void loadCompute().catch(() => { modulesPromise = null; }); };
    if (idle) idle(prefetch); else setTimeout(prefetch, 2000);
  }, []);

  useEffect(() => {
    const compute = async (search: string) => {
      try {
        const [templates, compute] = await loadCompute();
        if (pending.current !== null && pending.current !== search) return; // 已有更新的值
        const entry = templates.getTemplate(type as FurnitureCategory);
        if (!entry?.template) return;
        const sp: Record<string, string> = {};
        // server 的 searchParams 會丟掉空值（見 designSearchKey 註解），這裡照做才會算出一樣的東西
        new URLSearchParams(search).forEach((v, k) => { if (v !== "" && !(k in sp)) sp[k] = v; });
        const inputs = compute.resolveDesignInputs(type, entry, sp, { previewLocked, canBypassLimits });
        const built = compute.buildDesign(entry, inputs, locale);
        const plan = compute.buildAssemblyPlan(built.rawDesign, inputs.joineryMode);
        const key = designSearchKey(search);
        // 算完時值已經又變了，或 server 已經送來同一組的結果 → 不用蓋上去
        if (latestPreviewKey.current !== key || serverKeyRef.current === key) return;
        setPreview({ key, design: built.design, assemblyPlan: plan, joineryMode: inputs.joineryMode });
      } catch (e) {
        console.warn("[live-preview] fallback to server render", e instanceof Error ? e.message : e);
      }
    };
    const onPreview = (event: Event) => {
      const search = (event as CustomEvent<{ search: string }>).detail.search;
      latestPreviewKey.current = designSearchKey(search);
      pending.current = search;
      // 拖滑桿一秒幾十個事件：一個畫格只算最後一個值
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const latest = pending.current;
        if (latest !== null) void compute(latest);
      });
    };
    const onNavigate = (event: Event) => {
      latestNavKey.current = (event as CustomEvent<{ search: string }>).detail.search;
    };
    window.addEventListener(DESIGN_PREVIEW_EVENT, onPreview);
    window.addEventListener("wooden-ren:design-navigation", onNavigate);
    return () => {
      window.removeEventListener(DESIGN_PREVIEW_EVENT, onPreview);
      window.removeEventListener("wooden-ren:design-navigation", onNavigate);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [type, locale, previewLocked, canBypassLimits]);

  // server 版回來了：跟預覽同一組參數，或使用者已經沒有還沒送出的改動 → 換回 server 版。
  // 還有沒送出的改動（debounce 中）就先留著預覽，不要閃回舊模型。
  useEffect(() => {
    setPreview((current) => {
      if (!current) return current;
      if (current.key === serverKey) return null;
      if (latestPreviewKey.current === latestNavKey.current) return null;
      return current;
    });
  }, [design, serverKey]);

  const shown = preview ?? { design, assemblyPlan: assemblyPlan ?? null, joineryMode: !!joineryMode };
  return (
    <div data-live-preview={preview ? "client" : "server"} className="contents">
      <LazyPerspectiveView {...rest} design={shown.design} assemblyPlan={shown.assemblyPlan} joineryMode={shown.joineryMode} />
    </div>
  );
}

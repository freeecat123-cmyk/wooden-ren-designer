"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, RotateCcw, Check } from "lucide-react";
import { useUserPlan } from "@/hooks/useUserPlan";

interface Props {
  category: string;
  fingerprint: string;
  steps: { id: string; title: string }[];
  locale?: string;
  children: ReactNode;
}
interface RecordData { fingerprint: string; completed: string[] }

export function BuildProgress(props: Props) {
  const search = useSearchParams();
  const { userId, isLoading } = useUserPlan();
  const key = `wooden-ren:build:v1:${userId ?? "guest"}:${props.category}:${search.get("designId") ?? "new"}`;
  return <ProgressSession key={key} {...props} storageKey={key} loading={isLoading} />;
}

function ProgressSession({ steps, fingerprint, locale, children, storageKey, loading }: Props & { storageKey: string; loading: boolean }) {
  const en = locale === "en";
  const root = useRef<HTMLOListElement>(null);
  const [record, setRecord] = useState<RecordData | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (loading) return;
    const read = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        const value = raw ? JSON.parse(raw) : null;
        if (value && (typeof value.fingerprint !== "string" || !Array.isArray(value.completed) || !value.completed.every((id: unknown) => typeof id === "string"))) throw Error("Invalid progress");
        setRecord(value);
        setFailed(false);
      } catch { setFailed(true); }
      setReady(true);
    };
    read();
    const sync = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) read(); };
    const localSync = (event: Event) => { if ((event as CustomEvent).detail === storageKey) read(); };
    window.addEventListener("storage", sync);
    window.addEventListener("wooden-ren:build-progress", localSync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("wooden-ren:build-progress", localSync);
    };
  }, [storageKey, loading]);
  const completed = new Set(record?.completed.filter(id => steps.some(step => step.id === id)) ?? []);
  const changed = !!record && record.fingerprint !== fingerprint;
  const disabled = !ready || loading || changed;
  const next = steps.find(step => !completed.has(step.id));
  function save(ids: string[]) {
    const value = { fingerprint, completed: ids };
    setRecord(value);
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      setFailed(false);
      window.dispatchEvent(new CustomEvent("wooden-ren:build-progress", { detail: storageKey }));
    } catch { setFailed(true); }
  }
  const items = Children.toArray(children);
  const buttonClass = "inline-flex min-h-11 items-center gap-2 rounded border border-zinc-300 px-3 text-sm disabled:opacity-50";
  return <section aria-label={en ? "Build progress" : "製作進度"}>
    <div className="mb-4 space-y-3 border-b border-zinc-200 pb-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="status" className="text-sm">
          {changed ? (en ? "Design changed. Confirm your build progress." : "設計已變更，請確認製作進度。") : (en ? `Completed ${completed.size} / ${steps.length}` : `已完成 ${completed.size} / ${steps.length}`)}
          <p className="mt-1 text-xs text-zinc-500">{failed ? (en ? "Progress is not saved and may be lost on close." : "進度尚未儲存，關閉後可能遺失。") : (en ? "This device only" : "僅限此裝置")}</p>
        </div>
        {!changed && <button type="button" className={buttonClass} disabled={disabled || !next} onClick={() => {
          const target = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-build-step]") ?? []).find(node => node.dataset.buildStep === next?.id);
          target?.scrollIntoView({ block: "center", behavior: "instant" });
          target?.focus({ preventScroll: true });
        }}><ArrowDown size={16} />{en ? "Next unfinished step" : "下一個未完成"}</button>}
      </div>
      {changed ? <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => save([...completed])}><Check size={16} />{en ? "Keep completed steps" : "保留已完成項目"}</button>
        <button type="button" className={buttonClass} onClick={() => save([])}><RotateCcw size={16} />{en ? "Start over" : "重新開始"}</button>
      </div> : <progress className="h-2 w-full accent-emerald-700" aria-label={en ? "Completion" : "完成比例"} max={Math.max(1, steps.length)} value={completed.size} />}
    </div>
    <ol ref={root} className="space-y-3">
      {steps.map((step, i) => <li key={step.id} data-build-step={step.id} tabIndex={-1} className="rounded-lg border border-zinc-200 bg-white focus:outline-2 focus:outline-emerald-700">
        <label className="flex min-h-11 items-center gap-3 px-4 pt-2 text-sm print:hidden">
          <input type="checkbox" className="h-5 w-5 accent-emerald-700" aria-label={step.title} disabled={disabled} checked={!changed && completed.has(step.id)} onChange={event => {
            if (event.target.checked) completed.add(step.id); else completed.delete(step.id);
            save([...completed]);
          }} />{en ? "Completed" : "已完成"}
        </label>
        {items[i]}
      </li>)}
    </ol>
  </section>;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isBlankDesignQuery } from "@/lib/design/is-blank-design-query";

const STORAGE_PREFIX = "wooden-ren-designer:design-history:v1";
const MAX_HISTORY = 40;

interface HistoryState {
  past: string[];
  current: string;
  future: string[];
}

function trimPast(items: string[]): string[] {
  return items.slice(Math.max(0, items.length - MAX_HISTORY));
}

function trimFuture(items: string[]): string[] {
  return items.slice(0, MAX_HISTORY);
}

function readState(key: string): HistoryState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HistoryState>;
    if (
      !Array.isArray(parsed.past) ||
      typeof parsed.current !== "string" ||
      !Array.isArray(parsed.future)
    ) {
      return null;
    }
    return {
      past: parsed.past.filter((v): v is string => typeof v === "string"),
      current: parsed.current,
      future: parsed.future.filter((v): v is string => typeof v === "string"),
    };
  } catch {
    return null;
  }
}

function writeState(key: string, state: HistoryState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // History is a convenience feature; ignore storage quota/private-mode failures.
  }
}

export function DesignHistoryControls({
  className = "",
  buttonClassName = "",
}: {
  className?: string;
  buttonClassName?: string;
}) {
  const t = useTranslations("designHistory");
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const historyQuery = new URLSearchParams(searchParams?.toString() ?? "");
  historyQuery.delete("revision");
  historyQuery.sort();
  const search = historyQuery.toString();
  const currentUrl = search ? `${pathname}?${search}` : pathname;
  const storageKey = useMemo(() => {
    const designId = searchParams?.get("designId") ?? "draft";
    return `${STORAGE_PREFIX}:${pathname}:${designId}`;
  }, [pathname, searchParams]);
  const lastStorageKeyRef = useRef<string | null>(null);
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    current: currentUrl,
    future: [],
  });

  useEffect(() => {
    const onSaved = (event: Event) => {
      const { id, search: savedSearch, editorSearch } = (event as CustomEvent<{ id: string; search?: string; editorSearch?: string }>).detail;
      const versionedTemplate = new URLSearchParams(savedSearch).has("constructionVersion");
      const nextKey = `${STORAGE_PREFIX}:${pathname}:${id}`;
      if (nextKey === storageKey && editorSearch === undefined) return;
      const rebase = (target: string) => {
        const url = new URL(target, window.location.origin);
        // A10.15: adding a saved reference must not turn a blank v2 baseline into
        // legacy construction. Unknown/structural keys conservatively stay unchanged.
        if (versionedTemplate && url.pathname === pathname
          && isBlankDesignQuery(url.searchParams.keys())) {
          url.searchParams.set("constructionVersion", "2");
        }
        url.searchParams.set("designId", id);
        url.searchParams.delete("revision");
        url.searchParams.sort();
        return `${url.pathname}?${url.searchParams}`;
      };
      const base = readState(storageKey) ?? history;
      // Save supplies its actual navigation query, including newer unsaved edits.
      // Canonicalizing that same editor state is not an additional undo step.
      const next = { past: base.past.map(rebase), current: rebase(editorSearch === undefined ? base.current : `${pathname}?${editorSearch}`), future: base.future.map(rebase) };
      writeState(nextKey, next);
      lastStorageKeyRef.current = nextKey;
      setHistory(next);
    };
    window.addEventListener("wooden-ren:design-saved", onSaved);
    return () => window.removeEventListener("wooden-ren:design-saved", onSaved);
  }, [history, pathname, storageKey]);

  useEffect(() => {
    setHistory((prev) => {
      const loaded = readState(storageKey);
      const base =
        loaded ?? (lastStorageKeyRef.current === storageKey
          ? prev
          : { past: [], current: currentUrl, future: [] });
      lastStorageKeyRef.current = storageKey;

      if (base.current === currentUrl) {
        writeState(storageKey, base);
        return base;
      }

      const next = {
        past: trimPast([...base.past, base.current]),
        current: currentUrl,
        future: [],
      };
      writeState(storageKey, next);
      return next;
    });
  }, [currentUrl, storageKey]);

  const navigate = useCallback(
    (target: string, nextState: HistoryState) => {
      writeState(storageKey, nextState);
      setHistory(nextState);
      const url = new URL(target, window.location.origin);
      const revision = new URLSearchParams(window.location.search).get("revision");
      if (revision) url.searchParams.set("revision", revision);
      router.replace(`${url.pathname}?${url.searchParams}`, { scroll: false });
    },
    [router, storageKey],
  );

  const undo = useCallback(() => {
    const target = history.past.at(-1);
    if (!target) return;
    navigate(target, {
      past: history.past.slice(0, -1),
      current: target,
      future: trimFuture([history.current, ...history.future]),
    });
  }, [history, navigate]);

  const redo = useCallback(() => {
    const target = history.future[0];
    if (!target) return;
    navigate(target, {
      past: trimPast([...history.past, history.current]),
      current: target,
      future: history.future.slice(1),
    });
  }, [history, navigate]);

  const baseButton =
    "inline-flex min-h-[36px] items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40";
  const enabled = "border-amber-300 bg-white text-amber-800 hover:bg-amber-50";
  const disabled = "border-zinc-200 bg-zinc-50 text-zinc-400";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={undo}
        disabled={history.past.length === 0}
        className={`${baseButton} ${history.past.length > 0 ? enabled : disabled} ${buttonClassName}`}
        title={history.past.length > 0 ? t("undoTitle") : t("undoDisabled")}
      >
        <span aria-hidden>↶</span>
        <span>{t("undo")}</span>
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={history.future.length === 0}
        className={`${baseButton} ${history.future.length > 0 ? enabled : disabled} ${buttonClassName}`}
        title={history.future.length > 0 ? t("redoTitle") : t("redoDisabled")}
      >
        <span aria-hidden>↷</span>
        <span>{t("redo")}</span>
      </button>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { geometrySearch, savedEventMatches, type SavedShareEvent } from "./client-state";

export function useSavedShare(savedDesignId?: string | null, savedRevision?: string | null, hasUnsavedChanges = true) {
  const search = useSearchParams()?.toString() ?? (typeof window === "undefined" ? "" : window.location.search);
  const [localDirty, setLocalDirty] = useState(false);
  const pending = useRef<Record<string, string>>({});
  const [completed, setCompleted] = useState<(SavedShareEvent & { originId?: string | null; originRevision?: string | null }) | null>(null);
  const previousId = useRef(savedDesignId);
  useEffect(() => {
    if (previousId.current !== savedDesignId && completed?.id !== savedDesignId) {
      setCompleted(null);
      pending.current = {};
      setLocalDirty(false);
    }
    previousId.current = savedDesignId;
  }, [savedDesignId, completed?.id]);
  useEffect(() => {
    const changed = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) || !target.name || !target.form?.hasAttribute("data-design-form")) return;
      pending.current[target.name] = target instanceof HTMLInputElement && target.type === "checkbox" ? String(target.checked) : target.value;
      setLocalDirty(true);
    };
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<SavedShareEvent>).detail;
      if (!savedEventMatches(detail, window.location.search, pending.current)) return;
      pending.current = {}; setLocalDirty(false); setCompleted({ ...detail, originId: savedDesignId, originRevision: savedRevision });
    };
    document.addEventListener("input", changed, true);
    document.addEventListener("change", changed, true);
    window.addEventListener("wooden-ren:design-saved", saved);
    return () => {
      document.removeEventListener("input", changed, true);
      document.removeEventListener("change", changed, true);
      window.removeEventListener("wooden-ren:design-saved", saved);
    };
  }, [savedDesignId, savedRevision]);
  const clientMatches = completed && (completed.id === savedDesignId || completed.originId === savedDesignId) && geometrySearch(completed.search!) === geometrySearch(search);
  const useClient = clientMatches && (!savedRevision || savedRevision === completed.originRevision || savedRevision === completed.revision);
  return {
    designId: useClient ? completed.id : savedDesignId,
    revision: useClient ? completed.revision : savedRevision,
    dirty: localDirty || (hasUnsavedChanges && !clientMatches),
  };
}

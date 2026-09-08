"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FolderOpen, LayoutGrid, List, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useUserPlan } from "@/hooks/useUserPlan";
import { createClient } from "@/lib/supabase/client";
import { useUnit } from "@/hooks/useUnit";
import { formatDimensions } from "@/lib/units/format";
import { buildEditHref, categoryImage, categoryName, designName, fetchAllDesigns, normalizeCategory, selectDesigns, type DesignRow, type DesignSort } from "./design-library/library";
import { libraryCopy } from "./design-library/copy";
import styles from "./design-library/Library.module.css";

export function MyDesignsClient() {
  const locale = useLocale();
  const t = useTranslations("myDesignsPage");
  const copy = locale === "en" ? libraryCopy.en : libraryCopy["zh-TW"];
  const unit = useUnit();
  const { isLoading: planLoading, isLoggedIn, userId } = useUserPlan();
  const owner = isLoggedIn ? userId : null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [result, setResult] = useState<{ owner: string; rows: DesignRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<DesignSort>("updated");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [operation, setOperation] = useState<{ kind: "rename" | "delete"; row: DesignRow } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const mutationGeneration = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const rows = result?.owner === owner ? result.rows : [];
  const filtered = selectDesigns(rows, search, category, sort, locale);
  const categories = [...new Set(rows.map(row => normalizeCategory(row.furniture_type)))].sort();
  const recent = selectDesigns(rows, "", "", "updated", locale)[0];

  useEffect(() => {
    setResult(null);
    setError("");
    setOperation(null);
    mutationGeneration.current += 1;
    setBusy(false);
    setSearch("");
    setCategory("");
    if (planLoading || !owner) { setLoading(planLoading); return; }
    const controller = new AbortController();
    setLoading(true);
    const supabase = createClient();
    void fetchAllDesigns((from, to) => supabase.from("designs")
      .select("id, furniture_type, name, params, created_at, updated_at")
      .eq("user_id", owner).order("updated_at", { ascending: false }).order("id", { ascending: true })
      .abortSignal(controller.signal).range(from, to), controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ owner, rows: data }); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [owner, planLoading, retry]);

  useEffect(() => {
    if (!operation) return;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); trigger.current?.focus(); };
  }, [operation]);

  function openOperation(kind: "rename" | "delete", row: DesignRow, opener: HTMLElement) {
    trigger.current = opener;
    setName(row.name ?? "");
    setMutationError("");
    setOperation({ kind, row });
  }

  async function mutate() {
    if (!operation || busy || !owner) return;
    const requestOwner = owner;
    const requestGeneration = ++mutationGeneration.current;
    const { kind, row } = operation;
    const trimmed = name.trim();
    if (kind === "rename" && (!trimmed || trimmed.length > 100)) { setMutationError(copy.invalid); return; }
    setBusy(true);
    setMutationError("");
    try {
      const response = await fetch(`/api/designs/${encodeURIComponent(row.id)}`, kind === "delete"
        ? { method: "DELETE" }
        : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.error ?? copy.failure);
      if (ownerRef.current !== requestOwner || mutationGeneration.current !== requestGeneration) return;
      setResult(current => current?.owner !== requestOwner ? current : {
        owner: requestOwner,
        rows: kind === "delete" ? current.rows.filter(item => item.id !== row.id)
          : current.rows.map(item => item.id === row.id ? { ...item, name: trimmed, updated_at: data.updated_at ?? item.updated_at } : item),
      });
      setOperation(null);
    } catch (err) {
      if (ownerRef.current === requestOwner && mutationGeneration.current === requestGeneration) setMutationError(err instanceof Error ? err.message : copy.failure);
    } finally { if (mutationGeneration.current === requestGeneration) setBusy(false); }
  }

  return <main className={styles.library}>
    <header className={styles.header}>
      <div><h1>{t("h1")}</h1><p>{locale === "en" ? `${rows.length} saved designs` : `${rows.length} 份設計`}</p></div>
      <Link href="/app" className={styles.primary}><Plus size={17} aria-hidden />{locale === "en" ? "New design" : "新增設計"}</Link>
    </header>
    {!planLoading && !isLoggedIn ? <p className={styles.empty}>{t("loginRequired")}</p> : <>
      {recent && <Link href={buildEditHref(recent)} className={styles.recent}>
        <FolderOpen size={19} aria-hidden /><span>{copy.continue}<strong>{designName(recent, locale)}</strong></span>
      </Link>}
      <div className={styles.filters}>
        <label className={styles.search}><Search size={17} aria-hidden /><input type="search" aria-label={copy.search} placeholder={copy.search} value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label><span>{copy.category}</span><select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">{copy.all}</option>{categories.map(key => <option key={key} value={key}>{categoryName(key, locale)}</option>)}
        </select></label>
        <label><span>{copy.sort}</span><select value={sort} onChange={e => setSort(e.target.value as DesignSort)}><option value="updated">{copy.updated}</option><option value="name">{copy.name}</option></select></label>
        <div className={styles.modes}>
          <button type="button" aria-label={copy.grid} title={copy.grid} aria-pressed={mode === "grid"} onClick={() => setMode("grid")}><LayoutGrid size={18} aria-hidden /></button>
          <button type="button" aria-label={copy.list} title={copy.list} aria-pressed={mode === "list"} onClick={() => setMode("list")}><List size={18} aria-hidden /></button>
        </div>
      </div>
      {loading || planLoading ? <p role="status" className={styles.empty}>{t("loading")}</p> : error ? <div role="alert" className={styles.empty}>
        <p>{t("loadFailTpl", { msg: error })}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button>
      </div> : rows.length === 0 ? <div className={styles.empty}><p>{locale === "en" ? "You haven't saved any designs yet." : "尚未儲存任何設計。"}</p><Link href="/app">{t("goCatalog")}</Link></div>
        : filtered.length === 0 ? <div className={styles.empty}><p>{copy.noMatches}</p><button type="button" onClick={() => { setSearch(""); setCategory(""); }}>{copy.clear}</button></div>
        : <ul className={mode === "grid" ? styles.grid : styles.list}>
          {filtered.map(row => {
            const title = designName(row, locale);
            const src = categoryImage(row.furniture_type);
            const values = [row.params.length, row.params.width, row.params.height];
            const dims = values.every(value => typeof value === "number" && Number.isFinite(value))
              ? formatDimensions(values[0] as number, values[1] as number, values[2] as number, unit) : null;
            return <li key={row.id}>
              <Link href={buildEditHref(row)} className={styles.preview} aria-label={title}>
                {src ? <img src={src} alt={categoryName(row.furniture_type, locale)} loading="lazy" width={480} height={320} /> : <FolderOpen size={40} aria-hidden />}
                <span>{copy.sample}</span>
              </Link>
              <div className={styles.record}>
                <Link href={buildEditHref(row)}><h2>{title}</h2></Link>
                <p>{categoryName(row.furniture_type, locale)}{dims ? ` · ${dims}` : ""}</p>
                <time dateTime={row.updated_at}>{t("updatedTpl", { date: new Date(row.updated_at).toLocaleDateString(locale) })}</time>
              </div>
              <div className={styles.actions}>
                <button type="button" aria-label={`${copy.rename} ${title}`} title={copy.rename} onClick={e => openOperation("rename", row, e.currentTarget)}><Pencil size={16} aria-hidden /></button>
                <button type="button" aria-label={`${copy.delete} ${title}`} title={copy.delete} onClick={e => openOperation("delete", row, e.currentTarget)}><Trash2 size={16} aria-hidden /></button>
              </div>
            </li>;
          })}
        </ul>}
    </>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="library-dialog-title" onCancel={event => { if (busy) event.preventDefault(); else setOperation(null); }}>
      <div className={styles.dialogHeader}><h2 id="library-dialog-title">{operation?.kind === "delete" ? copy.delete : copy.rename}</h2>
        <button type="button" aria-label={copy.cancel} disabled={busy} onClick={() => setOperation(null)}><X size={18} aria-hidden /></button></div>
      {operation?.kind === "rename" ? <label>{copy.designName}<input value={name} maxLength={100} onChange={e => setName(e.target.value)} autoFocus /></label> : <p>{t("confirmDelete")}</p>}
      {mutationError && <p role="alert">{mutationError}</p>}
      <div className={styles.dialogActions}><button type="button" disabled={busy} onClick={() => setOperation(null)}>{copy.cancel}</button>
        <button type="button" disabled={busy} className={styles.primary} onClick={() => void mutate()}>{busy ? copy.progress : operation?.kind === "delete" ? copy.delete : copy.save}</button></div>
    </dialog>
  </main>;
}

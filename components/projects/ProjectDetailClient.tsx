"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { createClient } from "@/lib/supabase/client";
import { getTemplate } from "@/lib/templates";
import { formatTWD } from "@/lib/pricing/catalog";
import { MATERIALS } from "@/lib/materials";
import {
  type ProjectRow,
  type ProjectItemRow,
  type ProjectStatus,
  type ProjectLaborOpts,
} from "@/lib/projects/types";
import type { FurnitureCategory } from "@/lib/types";
import type { DesignRow } from "@/lib/projects/design-row";
import { CopyShareLinkButton } from "@/components/projects/CopyShareLinkButton";
import { estimateUnitPriceFromParams } from "@/lib/projects/estimate-price";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import { BrandingSetupGate } from "@/components/projects/BrandingSetupGate";
import { MessageThread } from "@/components/projects/MessageThread";
import type { ProjectMessage } from "@/lib/projects/fetch-quote-data";

/** 狀態 → 顏色（給 status pill 用）*/
const STATUS_COLOR: Record<ProjectStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 border-zinc-300",
  sent: "bg-sky-100 text-sky-800 border-sky-300",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  in_production: "bg-amber-100 text-amber-800 border-amber-300",
  delivered: "bg-purple-100 text-purple-800 border-purple-300",
  cancelled: "bg-rose-100 text-rose-700 border-rose-300",
};

function categoryLabel(type: string, tFurn: ReturnType<typeof useTranslations<"furniture">>): string {
  const slug = type.replace(/_/g, "-") as FurnitureCategory;
  try {
    return tFurn(slug);
  } catch {
    return getTemplate(slug)?.nameZh ?? type;
  }
}

function buildDesignHref(item: ProjectItemRow): string {
  const slug = item.furniture_type.replace(/_/g, "-");
  const p = item.params ?? {};
  const qs = new URLSearchParams();
  for (const k of ["length", "width", "height", "material", "joineryMode"]) {
    const v = (p as Record<string, unknown>)[k];
    if (v === undefined || v === null) continue;
    qs.set(k, String(v));
  }
  return `/design/${slug}${qs.toString() ? `?${qs}` : ""}`;
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const t = useTranslations("projectDetailClient");
  const tStatus = useTranslations("projectDetailClient.projectStatus");
  const tFurn = useTranslations("furniture");
  const COMMON_ROOMS = t.raw("commonRooms") as string[];
  const ungrouped = t("ungrouped");
  const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
    draft: tStatus("draft"),
    sent: tStatus("sent"),
    confirmed: tStatus("confirmed"),
    in_production: tStatus("in_production"),
    delivered: tStatus("delivered"),
    cancelled: tStatus("cancelled"),
  };
  const { isLoading: planLoading, isLoggedIn, userId } = useUserPlan();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [items, setItems] = useState<ProjectItemRow[] | null>(null);
  const [savedDesigns, setSavedDesigns] = useState<DesignRow[] | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  // 房間群組摺疊狀態（store 收起的房間，預設全展開）
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  // 多選 batch 操作（選中的 item id）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 拖拉中的 item id（給視覺 feedback）
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (planLoading) return;
    if (!isLoggedIn || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const [
          { data: pData, error: pErr },
          { data: iData, error: iErr },
          { data: dData },
          { data: mData },
        ] = await Promise.all([
          supabase.from("projects").select("*").eq("id", projectId).single(),
          supabase
            .from("project_items")
            .select("*")
            .eq("project_id", projectId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("designs")
            .select("id, furniture_type, name, params")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false }),
          supabase
            .from("project_messages")
            .select("id, sender_role, sender_name, content, created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: true }),
        ]);
        if (pErr) throw pErr;
        if (iErr) throw iErr;
        if (!cancelled) {
          setProject(pData as ProjectRow);
          setItems((iData ?? []) as ProjectItemRow[]);
          setSavedDesigns((dData ?? []) as DesignRow[]);
          setMessages((mData ?? []) as ProjectMessage[]);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, planLoading, isLoggedIn, userId]);

  const totals = useMemo(() => {
    if (!items) return { subtotal: 0, count: 0 };
    let subtotal = 0;
    let count = 0;
    for (const it of items) {
      const unit = it.unit_price_override ?? 0;
      subtotal += unit * it.quantity;
      count += it.quantity;
    }
    return { subtotal, count };
  }, [items]);

  const grouped = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, ProjectItemRow[]>();
    for (const it of items) {
      const room = it.room?.trim() || ungrouped;
      const arr = map.get(room) ?? [];
      arr.push(it);
      map.set(room, arr);
    }
    return [...map.entries()];
  }, [items]);

  const updateProject = async (patch: Partial<ProjectRow>) => {
    if (!project) return;
    const next = { ...project, ...patch };
    setProject(next);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", projectId);
      if (error) throw error;
    } catch (e) {
      window.alert(t("alertSaveFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const addItemFromDesign = async (design: DesignRow, room: string) => {
    setBusy(true);
    try {
      const supabase = createClient();
      const p = design.params as Record<string, unknown>;
      const dim = [p.length, p.width, p.height]
        .every((v) => typeof v === "number")
        ? `${p.length}×${p.width}×${p.height}`
        : "";
      const insertName =
        design.name?.trim() ||
        `${categoryLabel(design.furniture_type, tFurn)}${dim ? " " + dim : ""}`;
      const estimatedPrice = estimateUnitPriceFromParams(
        design.furniture_type,
        design.params as Record<string, unknown>,
        project?.labor_opts ?? null,
      );
      const { data, error } = await supabase
        .from("project_items")
        .insert({
          project_id: projectId,
          design_id: design.id,
          furniture_type: design.furniture_type,
          name: insertName,
          params: design.params,
          quantity: 1,
          unit_price_override: estimatedPrice,
          room: room || null,
          sort_order: items?.length ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      setItems((prev) => (prev ? [...prev, data as ProjectItemRow] : [data as ProjectItemRow]));
      setShowAdd(false);
    } catch (e) {
      window.alert(t("alertAddFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const updateItem = async (id: string, patch: Partial<ProjectItemRow>) => {
    setItems((prev) =>
      prev ? prev.map((it) => (it.id === id ? { ...it, ...patch } : it)) : prev,
    );
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_items")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    } catch (e) {
      window.alert(t("alertSaveFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm(t("alertConfirmRemoveItem"))) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("project_items").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => (prev ? prev.filter((it) => it.id !== id) : prev));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      window.alert(t("alertRemoveFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t("alertConfirmBatchTpl", { n: selectedIds.size }))) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("project_items").delete().in("id", ids);
      if (error) throw error;
      setItems((prev) => (prev ? prev.filter((it) => !selectedIds.has(it.id)) : prev));
      setSelectedIds(new Set());
    } catch (e) {
      window.alert(t("alertBatchFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  // 切換多選
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 切換房間摺疊
  const toggleRoomCollapse = (room: string) =>
    setCollapsedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });

  // 拖拉重排（同房間內。重新從 0 編 sort_order，DB 並行更新）
  const reorderInRoom = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId || !items) return;
    const sIdx = items.findIndex((it) => it.id === sourceId);
    const tIdx = items.findIndex((it) => it.id === targetId);
    if (sIdx === -1 || tIdx === -1) return;
    const sRoom = items[sIdx].room?.trim() || ungrouped;
    const tRoom = items[tIdx].room?.trim() || ungrouped;
    if (sRoom !== tRoom) return;
    // splice 重排
    const newItems = [...items];
    const [moved] = newItems.splice(sIdx, 1);
    const adjusted = sIdx < tIdx ? tIdx - 1 : tIdx;
    newItems.splice(adjusted, 0, moved);
    // 重編 sort_order = index
    const withNewOrder = newItems.map((it, i) => ({ ...it, sort_order: i }));
    setItems(withNewOrder);
    // DB updates 並行：只更新真的變動的
    setBusy(true);
    try {
      const supabase = createClient();
      const changed = withNewOrder.filter(
        (it, i) => items[i]?.id !== it.id || items[i]?.sort_order !== it.sort_order,
      );
      await Promise.all(
        changed.map((it) =>
          supabase
            .from("project_items")
            .update({ sort_order: it.sort_order })
            .eq("id", it.id),
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  // 複製專案：建一個新 project + 複製所有 items（給第二次接單或同建商案用）
  const duplicateProject = async () => {
    if (!project || !items) return;
    const newName = window.prompt(
      t("promptNewNameTitle"),
      t("promptNewNameTpl", { name: project.name }),
    );
    if (!newName?.trim()) return;
    setBusy(true);
    try {
      const supabase = createClient();
      // 1. 建新 project（不複製 share_token / 收款日期 / status 重設成 draft）
      const { data: newProj, error: pErr } = await supabase
        .from("projects")
        .insert({
          user_id: project.user_id,
          name: newName.trim(),
          customer_name: project.customer_name,
          customer_contact: project.customer_contact,
          project_address: project.project_address,
          design_concept: project.design_concept,
          status: "draft",
          deposit_rate: project.deposit_rate,
          labor_opts: project.labor_opts,
          notes: project.notes,
        })
        .select()
        .single();
      if (pErr) throw pErr;
      // 2. 複製 items
      if (items.length > 0) {
        const newItems = items.map((it) => ({
          project_id: newProj.id,
          design_id: it.design_id,
          furniture_type: it.furniture_type,
          name: it.name,
          params: it.params,
          quantity: it.quantity,
          unit_price_override: it.unit_price_override,
          room: it.room,
          sort_order: it.sort_order,
          notes: it.notes,
        }));
        const { error: iErr } = await supabase.from("project_items").insert(newItems);
        if (iErr) throw iErr;
      }
      window.location.href = `/projects/${newProj.id}`;
    } catch (e) {
      window.alert(t("alertDuplicateFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!project) return;
    if (!window.confirm(t("confirmDeleteTpl", { name: project.name }))) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      window.location.href = "/projects";
    } catch (e) {
      window.alert(t("alertDeleteFailTpl", { msg: e instanceof Error ? e.message : String(e) }));
      setBusy(false);
    }
  };

  if (planLoading || loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-sm text-zinc-500">
        {t("loading")}
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-zinc-600 text-sm">{t("loginRequired")}</p>
      </main>
    );
  }

  if (err || !project) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/projects" className="text-sm text-zinc-500 hover:underline">
          {t("backToList")}
        </Link>
        <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 text-red-700 text-sm p-4">
          {err ?? t("errFallback")}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <datalist id="project-rooms">
        {COMMON_ROOMS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <Link href="/projects" className="text-sm text-zinc-500 hover:underline">
        {t("backToList")}
      </Link>
      <QuoteAccessGate>
      <BrandingSetupGate>

      {/* 專案抬頭 */}
      <section className="mt-3 mb-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
          <input
            type="text"
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
            onBlur={(e) => updateProject({ name: e.target.value.trim() || t("untitled") })}
            className="text-2xl sm:text-3xl font-bold text-zinc-900 bg-transparent border-b-2 border-transparent hover:border-zinc-200 focus:border-zinc-400 outline-none px-1 -mx-1 min-w-0 flex-1"
          />
          <select
            value={project.status}
            onChange={(e) => updateProject({ status: e.target.value as ProjectStatus })}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[project.status]} cursor-pointer`}
            title={t("statusTitle")}
          >
            {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <LabelField
            label={t("fieldCustomerName")}
            value={project.customer_name ?? ""}
            placeholder={t("phCustomerName")}
            onSave={(v) => updateProject({ customer_name: v || null })}
          />
          <LabelField
            label={t("fieldCustomerContact")}
            value={project.customer_contact ?? ""}
            placeholder={t("phCustomerContact")}
            onSave={(v) => updateProject({ customer_contact: v || null })}
          />
          <LabelField
            label={t("fieldProjectAddress")}
            value={project.project_address ?? ""}
            placeholder={t("phProjectAddress")}
            onSave={(v) => updateProject({ project_address: v || null })}
          />
          <LabelField
            label={t("fieldDesignConcept")}
            value={project.design_concept ?? ""}
            placeholder={t("phDesignConcept")}
            onSave={(v) => updateProject({ design_concept: v || null })}
          />
        </div>
      </section>

      {/* 報價設定（影響「帶入估價」用的工資/毛利等） */}
      <LaborOptsPanel
        value={project.labor_opts}
        onSave={(opts) => updateProject({ labor_opts: opts })}
      />

      {/* 金流追蹤 + 預計完工日（業界最痛點，常被問「訂金收了嗎？」「啥時交貨？」）*/}
      <PaymentDeliveryPanel
        project={project}
        totals={totals}
        onSave={(patch) => updateProject(patch)}
      />

      <NotesPanel
        title={t("publicNotesH")}
        subtitle={t("publicNotesSub")}
        placeholder={t("phPublicNotes")}
        value={project.notes ?? ""}
        onSave={(v) => updateProject({ notes: v || null })}
      />

      <NotesPanel
        title={t("internalNotesH")}
        subtitle={t("internalNotesSub")}
        placeholder={t("phInternalNotes")}
        value={project.internal_notes ?? ""}
        onSave={(v) => updateProject({ internal_notes: v || null })}
      />

      {/* 項目列表 */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-zinc-900">{t("itemsH")}</h2>
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="px-3 py-1.5 rounded-lg bg-[#8b4513] text-white text-xs font-medium hover:bg-[#6f370f]"
          >
            {showAdd ? t("collapseBtn") : t("addBtn")}
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-3 rounded-lg bg-amber-100 border-2 border-amber-300 px-3 py-2 flex items-center gap-3 sticky top-2 z-30 shadow-sm">
            <span className="text-xs font-medium text-amber-900">
              {t("selectedCountTpl", { n: selectedIds.size })}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-zinc-700 hover:underline"
            >
              {t("cancelSelect")}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={busy}
              className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700 disabled:opacity-50"
            >
              {t("batchDelete")}
            </button>
          </div>
        )}

        {showAdd && (
          <AddItemPanel
            savedDesigns={savedDesigns ?? []}
            onAdd={addItemFromDesign}
            disabled={busy}
          />
        )}

        {grouped.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center">
            <div className="text-4xl mb-2">🪑</div>
            <p className="text-sm font-medium text-zinc-700 mb-1">{t("emptyH")}</p>
            <p className="text-xs text-zinc-500 mb-4">{t("emptyBody")}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="px-4 py-2 rounded bg-[#8b4513] text-white text-xs font-medium hover:bg-[#6f370f]"
              >
                {t("addFromSaved")}
              </button>
              <Link
                href="/"
                className="px-4 py-2 rounded border border-zinc-300 bg-white text-xs hover:bg-zinc-50"
              >
                {t("goDesign")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([room, list]) => {
              const collapsed = collapsedRooms.has(room);
              const roomTotal = list.reduce(
                (s, it) => s + (it.unit_price_override ?? 0) * it.quantity,
                0,
              );
              return (
                <div key={room}>
                  <button
                    type="button"
                    onClick={() => toggleRoomCollapse(room)}
                    className="w-full flex items-baseline justify-between gap-2 mb-2 group cursor-pointer"
                  >
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide group-hover:text-zinc-700 flex items-center gap-1.5">
                      <span className="text-zinc-400 text-[10px]">
                        {collapsed ? "▶" : "▼"}
                      </span>
                      {t("roomGroupTpl", { name: room, n: list.length })}
                    </h3>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {formatTWD(roomTotal)}
                    </span>
                  </button>
                  {!collapsed && (
                    <ul className="space-y-2">
                      {list.map((it) => (
                        <ItemRow
                          key={it.id}
                          item={it}
                          tFurn={tFurn}
                          laborOpts={project.labor_opts}
                          selected={selectedIds.has(it.id)}
                          onToggleSelect={() => toggleSelect(it.id)}
                          onUpdate={(patch) => updateItem(it.id, patch)}
                          onDelete={() => deleteItem(it.id)}
                          onDragStart={() => setDraggingId(it.id)}
                          onDragEnd={() => setDraggingId(null)}
                          onDropOn={(sourceId) => reorderInRoom(sourceId, it.id)}
                          isDragging={draggingId === it.id}
                          disabled={busy}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 總計 */}
      <section className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-5 mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-900">{t("totalsH")}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t("totalsLineTpl", { n: totals.count })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-zinc-900 font-mono">
              {formatTWD(totals.subtotal)}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {t("depositTpl", { pct: Math.round(project.deposit_rate * 100) })}
              <span className="font-mono ml-1">
                {formatTWD(Math.round(totals.subtotal * project.deposit_rate))}
              </span>
            </div>
          </div>
        </div>

        {totals.count > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-wrap gap-2 justify-end">
            {/* 主要動作：預覽 + 列印（橙底突顯）*/}
            <Link
              href={`/projects/${projectId}/quote`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded text-sm bg-amber-700 text-white hover:bg-amber-800 font-medium"
            >
              {t("previewQuote")}
            </Link>
            <Link
              href={`/projects/${projectId}/quote/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded text-sm bg-zinc-900 text-white hover:bg-zinc-700 font-medium"
            >
              {t("printQuote")}
            </Link>
            <Link
              href={`/projects/${projectId}/purchase`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50"
              title={t("purchaseTitle")}
            >
              {t("purchaseList")}
            </Link>
            <CopyShareLinkButton projectId={projectId} />
          </div>
        )}
      </section>

      <MessageThread
        projectId={projectId}
        initialMessages={messages}
        mode="craftsman"
      />

      {/* 更多操作（複製 + 危險區，收進 disclosure）*/}
      <details className="mt-12 pt-6 border-t border-zinc-200">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 list-none flex items-center gap-1">
          <span>⋯</span> {t("moreActions")}
        </summary>
        <div className="mt-3 space-y-3">
          <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
            <p className="text-[11px] text-zinc-600 mb-2">{t("duplicateNote")}</p>
            <button
              type="button"
              onClick={duplicateProject}
              disabled={busy}
              className="text-xs text-zinc-700 hover:underline disabled:opacity-50 font-medium"
            >
              {t("duplicateBtn")}
            </button>
          </div>
          <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
            <p className="text-[11px] text-rose-700 mb-2">{t("dangerZoneNote")}</p>
            <button
              type="button"
              onClick={deleteProject}
              disabled={busy}
              className="text-xs text-red-700 hover:underline disabled:opacity-50 font-medium"
            >
              {t("deleteProject")}
            </button>
          </div>
        </div>
      </details>

      {/* 行動端 sticky bottom bar：總計 + 預覽（捲到列表底也能快速操作）*/}
      {totals.count > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-zinc-200 shadow-lg p-3 flex items-center justify-between z-40 gap-3">
          <div className="min-w-0">
            <div className="text-[10px] text-zinc-500">{t("stickyCountTpl", { n: totals.count })}</div>
            <div className="text-lg font-bold font-mono text-zinc-900 truncate">
              {formatTWD(totals.subtotal)}
            </div>
          </div>
          <Link
            href={`/projects/${projectId}/quote`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 shrink-0"
          >
            {t("stickyPreview")}
          </Link>
        </div>
      )}
      {/* 行動端 sticky bottom bar 預留空間，避免最後內容被擋 */}
      {totals.count > 0 && <div className="md:hidden h-20" />}
      </BrandingSetupGate>
      </QuoteAccessGate>
    </main>
  );
}

function LabelField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const t = useTranslations("projectDetailClient");
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-500 mb-1 flex items-center gap-1.5">
        {label}
        {saved && (
          <span className="text-[10px] text-emerald-600 font-medium">{t("labelSaved")}</span>
        )}
      </span>
      <input
        type="text"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== value) {
            onSave(v.trim());
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }
        }}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-sm"
      />
    </label>
  );
}

function ItemRow({
  item,
  tFurn,
  laborOpts,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnd,
  onDropOn,
  isDragging,
  disabled,
}: {
  item: ProjectItemRow;
  tFurn: ReturnType<typeof useTranslations<"furniture">>;
  laborOpts: ProjectLaborOpts | null;
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (patch: Partial<ProjectItemRow>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: (sourceId: string) => void;
  isDragging: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("projectDetailClient");
  const p = item.params as Record<string, unknown>;
  const dim =
    [p.length, p.width, p.height].every((v) => typeof v === "number")
      ? `${p.length}×${p.width}×${p.height} mm`
      : "—";
  const matKey = typeof p.material === "string" ? p.material : "";
  const matName =
    matKey && (MATERIALS as Record<string, { nameZh: string }>)[matKey]?.nameZh;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData("text/plain");
        if (sourceId && sourceId !== item.id) onDropOn(sourceId);
      }}
      className={`rounded-xl border-2 bg-white p-3 sm:p-4 transition-all ${
        selected
          ? "border-amber-400 bg-amber-50/30"
          : "border-zinc-200 hover:border-zinc-300"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      {/* 拖拉 handle + checkbox + 內容 */}
      <div className="flex items-start gap-2 mb-2 sm:mb-0 sm:float-left sm:w-[calc(100%-280px)] sm:pr-3 min-w-0">
        <span
          className="text-zinc-400 cursor-grab select-none mt-1 hover:text-zinc-600"
          title={t("dragTitle")}
        >
          ⋮⋮
        </span>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1.5 w-3.5 h-3.5 cursor-pointer accent-amber-600"
          title={t("selectTitle")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-zinc-900 truncate">{item.name}</span>
            <span className="text-xs text-zinc-500">{categoryLabel(item.furniture_type, tFurn)}</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {dim}
            {matName ? ` · ${matName}` : ""}
          </p>
        </div>
      </div>

      {/* 第二行（手機）/ 同行（桌機）：房間/數量/單價/操作 */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:justify-end">
        <input
          type="text"
          defaultValue={item.room ?? ""}
          placeholder={t("phRoom")}
          list="project-rooms"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (item.room ?? "")) onUpdate({ room: v || null });
          }}
          className="w-20 border border-zinc-300 rounded px-2 py-1 text-xs bg-white"
        />

        <label className="flex items-center gap-1 text-xs text-zinc-600">
          ×
          <input
            type="number"
            min={1}
            max={999}
            defaultValue={item.quantity}
            onBlur={(e) => {
              const n = Math.max(1, parseInt(e.target.value) || 1);
              if (n !== item.quantity) onUpdate({ quantity: n });
            }}
            className="w-14 border border-zinc-300 rounded px-1.5 py-1 text-xs bg-white text-right"
          />
        </label>

        <UnitPriceInput item={item} laborOpts={laborOpts} onUpdate={onUpdate} />

        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          <Link
            href={buildDesignHref(item)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-700 hover:underline px-2"
          >
            {t("openItem")}
          </Link>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="text-xs text-red-600 hover:underline px-2 disabled:opacity-50"
          >
            {t("removeItem")}
          </button>
        </div>
      </div>
      <div className="clear-both" />
    </li>
  );
}

function UnitPriceInput({
  item,
  laborOpts,
  onUpdate,
}: {
  item: ProjectItemRow;
  laborOpts: ProjectLaborOpts | null;
  onUpdate: (patch: Partial<ProjectItemRow>) => void;
}) {
  const t = useTranslations("projectDetailClient");
  const [val, setVal] = useState(item.unit_price_override?.toString() ?? "");
  useEffect(() => {
    setVal(item.unit_price_override?.toString() ?? "");
  }, [item.unit_price_override]);

  const estimated = useMemo(
    () =>
      estimateUnitPriceFromParams(
        item.furniture_type,
        item.params as Record<string, unknown>,
        laborOpts,
      ),
    [item.furniture_type, item.params, laborOpts],
  );

  const hasEstimate = estimated != null && estimated > 0;
  const isEmpty = item.unit_price_override == null;
  const isDifferent =
    hasEstimate &&
    item.unit_price_override != null &&
    item.unit_price_override !== estimated;

  return (
    <label className="flex items-center gap-1 text-xs text-zinc-600">
      {t("unitPriceLbl")}
      <div className="flex flex-col items-end">
        <input
          type="number"
          min={0}
          step={100}
          value={val}
          placeholder={hasEstimate ? t("estPlaceholderTpl", { n: estimated! }) : "—"}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            const raw = val.trim();
            const n = raw === "" ? null : Math.max(0, parseFloat(raw) || 0);
            if (n !== item.unit_price_override) onUpdate({ unit_price_override: n });
          }}
          className="w-24 border border-zinc-300 rounded px-1.5 py-1 text-xs bg-white text-right font-mono"
        />
        {hasEstimate && (isEmpty || isDifferent) && (
          <button
            type="button"
            onClick={() => {
              setVal(String(estimated));
              onUpdate({ unit_price_override: estimated });
            }}
            className="mt-0.5 text-[10px] text-amber-700 hover:underline"
            title={t("useEstimateTitle")}
          >
            {isEmpty ? t("useEstimate") : t("updateEstimate")} {t("useEstimatePriceTpl", { amount: estimated.toLocaleString() })}
          </button>
        )}
      </div>
    </label>
  );
}

type LaborField = {
  key: keyof ProjectLaborOpts;
  label: string;
  step: number;
  isRate?: boolean;
  hint?: string;
};

function buildLaborGroups(
  t: ReturnType<typeof useTranslations<"projectDetailClient">>,
): Array<{ title: string; icon: string; fields: LaborField[] }> {
  return [
    {
      title: t("laborGroupWages"),
      icon: "💰",
      fields: [
        { key: "hourlyRate", label: t("fHourlyRate"), step: 50, hint: t("fHourlyRateHint") },
        { key: "marginRate", label: t("fMargin"), step: 5, isRate: true, hint: t("fMarginHint") },
      ],
    },
    {
      title: t("laborGroupMisc"),
      icon: "📦",
      fields: [
        { key: "finishingCost", label: t("fFinishing"), step: 100, hint: t("fFinishingHint") },
        { key: "shippingCost", label: t("fShipping"), step: 100, hint: t("fShippingHint") },
        { key: "installationCost", label: t("fInstall"), step: 100, hint: t("fInstallHint") },
        { key: "hardwareCost", label: t("fHardware"), step: 100, hint: t("fHardwareHint") },
      ],
    },
    {
      title: t("laborGroupTax"),
      icon: "🧾",
      fields: [
        { key: "vatRate", label: t("fVat"), step: 1, isRate: true, hint: t("fVatHint") },
        { key: "discountRate", label: t("fDiscount"), step: 1, isRate: true, hint: t("fDiscountHint") },
      ],
    },
  ];
}

function PaymentDeliveryPanel({
  project,
  totals,
  onSave,
}: {
  project: ProjectRow;
  totals: { subtotal: number; count: number };
  onSave: (patch: Partial<ProjectRow>) => void;
}) {
  const t = useTranslations("projectDetailClient");
  const depositAmount = Math.round(totals.subtotal * project.deposit_rate);
  const balanceAmount = Math.max(0, Math.round(totals.subtotal) - depositAmount);
  const depositPaid = !!project.deposit_received_at;
  const balancePaid = !!project.balance_received_at;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <details className="mb-6 rounded-2xl border-2 border-zinc-200 bg-white" open>
      <summary className="cursor-pointer list-none px-5 py-3 flex items-baseline justify-between hover:bg-zinc-50 rounded-2xl">
        <span className="font-semibold text-zinc-900 text-sm">
          {t("paymentH")}
        </span>
        <span className="text-xs">
          {depositPaid && balancePaid ? (
            <span className="text-emerald-700 font-medium">{t("paymentAllPaid")}</span>
          ) : depositPaid ? (
            <span className="text-amber-700 font-medium">{t("paymentDepositPaid")}</span>
          ) : (
            <span className="text-zinc-400">{t("paymentNoPay")}</span>
          )}
          {project.delivery_date_override && (
            <span className="ml-2 text-zinc-600">{t("paymentDeliveryTpl", { date: project.delivery_date_override })}</span>
          )}
        </span>
      </summary>
      <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 訂金 */}
        <div>
          <label className="flex items-center gap-2 text-xs text-zinc-600 mb-1">
            <input
              type="checkbox"
              checked={depositPaid}
              onChange={(e) =>
                onSave({
                  deposit_received_at: e.target.checked ? new Date().toISOString() : null,
                })
              }
              className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
            />
            <span className="font-medium">
              {t("depositLblTpl", { pct: Math.round(project.deposit_rate * 100) })}
            </span>
          </label>
          <div className="text-base font-mono font-semibold text-zinc-900">
            {formatTWD(depositAmount)}
          </div>
          {depositPaid && (
            <input
              type="date"
              value={(project.deposit_received_at ?? "").slice(0, 10)}
              onChange={(e) =>
                onSave({
                  deposit_received_at: e.target.value
                    ? new Date(e.target.value + "T00:00:00").toISOString()
                    : null,
                })
              }
              className="mt-1 text-xs border border-zinc-300 rounded px-1.5 py-0.5 bg-white"
            />
          )}
        </div>

        {/* 尾款 */}
        <div>
          <label className="flex items-center gap-2 text-xs text-zinc-600 mb-1">
            <input
              type="checkbox"
              checked={balancePaid}
              onChange={(e) =>
                onSave({
                  balance_received_at: e.target.checked ? new Date().toISOString() : null,
                })
              }
              className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
            />
            <span className="font-medium">{t("balanceLbl")}</span>
          </label>
          <div className="text-base font-mono font-semibold text-zinc-900">
            {formatTWD(balanceAmount)}
          </div>
          {balancePaid && (
            <input
              type="date"
              value={(project.balance_received_at ?? "").slice(0, 10)}
              onChange={(e) =>
                onSave({
                  balance_received_at: e.target.value
                    ? new Date(e.target.value + "T00:00:00").toISOString()
                    : null,
                })
              }
              className="mt-1 text-xs border border-zinc-300 rounded px-1.5 py-0.5 bg-white"
            />
          )}
        </div>

        {/* 預計完工日 */}
        <div>
          <label className="text-xs text-zinc-600 mb-1 block font-medium">
            {t("expectedDeliveryH")}
          </label>
          <input
            type="date"
            value={project.delivery_date_override ?? ""}
            min={today}
            onChange={(e) =>
              onSave({ delivery_date_override: e.target.value || null })
            }
            className="text-sm border border-zinc-300 rounded px-2 py-1 bg-white w-full"
          />
          <p className="text-[10px] text-zinc-400 mt-1">
            {t("expectedDeliveryHint")}
          </p>
        </div>
      </div>
    </details>
  );
}

function NotesPanel({
  title,
  subtitle,
  placeholder,
  value,
  onSave,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const t = useTranslations("projectDetailClient");
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => setV(value), [value]);
  return (
    <details className="mb-6 rounded-2xl border-2 border-zinc-200 bg-white" open={!!value.trim()}>
      <summary className="cursor-pointer list-none px-5 py-3 flex items-baseline justify-between hover:bg-zinc-50 rounded-2xl">
        <span className="font-semibold text-zinc-900 text-sm">
          {title}
          <span className="ml-2 text-xs font-normal text-zinc-500">({subtitle})</span>
        </span>
        {saved && <span className="text-[10px] text-emerald-600 font-medium">{t("labelSaved")}</span>}
      </summary>
      <div className="px-5 pb-5 pt-1">
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            if (v !== value) {
              onSave(v.trim());
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }
          }}
          placeholder={placeholder}
          rows={3}
          className="w-full border border-zinc-300 rounded px-3 py-2 bg-white text-sm leading-relaxed resize-y"
        />
      </div>
    </details>
  );
}

function LaborOptsPanel({
  value,
  onSave,
}: {
  value: ProjectLaborOpts | null;
  onSave: (opts: ProjectLaborOpts | null) => void;
}) {
  const t = useTranslations("projectDetailClient");
  const LABOR_GROUPS = buildLaborGroups(t);
  const defaultPrefix = t("defaultPrefix");
  const opts = value ?? {};
  const editedCount = value ? Object.keys(value).length : 0;
  const isEdited = editedCount > 0;

  const handleChange = (key: keyof ProjectLaborOpts, raw: string, isRate: boolean) => {
    const trimmed = raw.trim();
    const next = { ...opts };
    if (trimmed === "") {
      delete next[key];
    } else {
      const n = parseFloat(trimmed);
      if (!Number.isFinite(n)) return;
      next[key] = isRate ? n / 100 : n;
    }
    onSave(Object.keys(next).length === 0 ? null : next);
  };

  return (
    <details className="mb-6 rounded-2xl border-2 border-zinc-200 bg-white" open={isEdited}>
      <summary className="cursor-pointer list-none px-5 py-3 flex items-baseline justify-between hover:bg-zinc-50 rounded-2xl">
        <span className="font-semibold text-zinc-900 text-sm">
          {t("laborOptsH")}
          <span className="ml-2 text-xs font-normal text-zinc-500">
            {t("laborOptsSub")}
          </span>
        </span>
        <span className="text-xs text-zinc-400">
          {isEdited ? (
            <span className="text-amber-700 font-medium">{t("customizedTpl", { n: editedCount })}</span>
          ) : (
            t("useDefault")
          )}
        </span>
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-4">
        {LABOR_GROUPS.map((group) => (
          <div key={group.title}>
            <h4 className="text-[11px] font-semibold text-zinc-700 mb-2 flex items-center gap-1">
              <span>{group.icon}</span>
              {group.title}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {group.fields.map((f) => {
                const v = opts[f.key];
                const display =
                  v == null ? "" : f.isRate ? Math.round(v * 100).toString() : v.toString();
                return (
                  <label key={f.key} className="flex flex-col text-xs">
                    <span className="text-zinc-500 mb-1">{f.label}</span>
                    <input
                      type="number"
                      step={f.step}
                      defaultValue={display}
                      placeholder={f.hint?.replace(defaultPrefix, "")}
                      onBlur={(e) => handleChange(f.key, e.target.value, !!f.isRate)}
                      className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-sm font-mono"
                    />
                    {f.hint && (
                      <span className="text-[10px] text-zinc-400 mt-0.5">{f.hint}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {isEdited && (
          <div className="pt-2 border-t border-zinc-200 flex justify-end">
            <button
              type="button"
              onClick={() => onSave(null)}
              className="text-xs text-zinc-500 hover:underline"
            >
              {t("resetDefault")}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

function AddItemPanel({
  savedDesigns,
  onAdd,
  disabled,
}: {
  savedDesigns: DesignRow[];
  onAdd: (design: DesignRow, room: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("projectDetailClient");
  const tFurn = useTranslations("furniture");
  const [room, setRoom] = useState("");
  if (savedDesigns.length === 0) {
    return (
      <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900">
        {t("noSavedDesigns1")}
        <Link href="/" className="underline mx-1">{t("noSavedDesignsLink")}</Link>
        {t("noSavedDesigns2")}
      </div>
    );
  }
  return (
    <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-amber-900">{t("addPanelHTpl")}</h3>
        <label className="text-xs text-amber-900 flex items-center gap-1">
          {t("addPanelRoom")}
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder={t("addPanelRoomPh")}
            list="project-rooms"
            className="w-28 border border-amber-300 rounded px-2 py-1 text-xs bg-white"
          />
        </label>
      </div>
      <ul className="space-y-1.5 max-h-64 overflow-y-auto">
        {savedDesigns.map((d) => {
          const p = d.params as Record<string, unknown>;
          const dim =
            [p.length, p.width, p.height].every((v) => typeof v === "number")
              ? `${p.length}×${p.width}×${p.height}`
              : "—";
          return (
            <li key={d.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAdd(d, room.trim())}
                className="w-full flex items-baseline gap-2 text-left px-3 py-2 rounded bg-white hover:bg-amber-100 border border-amber-100 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-zinc-900 truncate flex-1">
                  {d.name?.trim() || categoryLabel(d.furniture_type, tFurn)}
                </span>
                <span className="text-xs text-zinc-500 shrink-0">
                  {categoryLabel(d.furniture_type, tFurn)} · {dim}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

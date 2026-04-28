"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUserPlan } from "@/hooks/useUserPlan";
import { createClient } from "@/lib/supabase/client";
import { getTemplate } from "@/lib/templates";
import { formatTWD } from "@/lib/pricing/catalog";
import { MATERIALS } from "@/lib/materials";
import {
  PROJECT_STATUS_LABEL,
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

const COMMON_ROOMS = [
  "主臥室",
  "次臥室",
  "兒童房",
  "客房",
  "書房",
  "客廳",
  "餐廳",
  "廚房",
  "玄關",
  "衛浴",
  "陽台",
  "儲藏室",
  "辦公室",
];

function categoryLabel(type: string): string {
  const slug = type.replace(/_/g, "-") as FurnitureCategory;
  return getTemplate(slug)?.nameZh ?? type;
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
  const { isLoading: planLoading, isLoggedIn, userId } = useUserPlan();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [items, setItems] = useState<ProjectItemRow[] | null>(null);
  const [savedDesigns, setSavedDesigns] = useState<DesignRow[] | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

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
      const room = it.room?.trim() || "未分組";
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
      window.alert(`儲存失敗：${e instanceof Error ? e.message : String(e)}`);
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
        `${categoryLabel(design.furniture_type)}${dim ? " " + dim : ""}`;
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
      window.alert(`加入失敗：${e instanceof Error ? e.message : String(e)}`);
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
      window.alert(`儲存失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm("確定移除這個項目？")) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("project_items").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => (prev ? prev.filter((it) => it.id !== id) : prev));
    } catch (e) {
      window.alert(`移除失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!project) return;
    if (
      !window.confirm(
        `確定刪除專案「${project.name}」？所有項目也會一起刪除，無法復原。`,
      )
    )
      return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      window.location.href = "/projects";
    } catch (e) {
      window.alert(`刪除失敗：${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  };

  if (planLoading || loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-sm text-zinc-500">
        載入中…
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-zinc-600 text-sm">請先登入才能查看專案。</p>
      </main>
    );
  }

  if (err || !project) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/projects" className="text-sm text-zinc-500 hover:underline">
          ← 回專案列表
        </Link>
        <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 text-red-700 text-sm p-4">
          {err ?? "找不到此專案，可能已刪除或你沒有權限。"}
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
        ← 回專案列表
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
            onBlur={(e) => updateProject({ name: e.target.value.trim() || "(未命名)" })}
            className="text-2xl sm:text-3xl font-bold text-zinc-900 bg-transparent border-b-2 border-transparent hover:border-zinc-200 focus:border-zinc-400 outline-none px-1 -mx-1 min-w-0 flex-1"
          />
          <select
            value={project.status}
            onChange={(e) => updateProject({ status: e.target.value as ProjectStatus })}
            className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white"
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
            label="客戶名稱"
            value={project.customer_name ?? ""}
            placeholder="例：林先生 / 王太太"
            onSave={(v) => updateProject({ customer_name: v || null })}
          />
          <LabelField
            label="客戶聯絡"
            value={project.customer_contact ?? ""}
            placeholder="電話 / Email / Line"
            onSave={(v) => updateProject({ customer_contact: v || null })}
          />
          <LabelField
            label="案場地址"
            value={project.project_address ?? ""}
            placeholder="例：台北市大安區..."
            onSave={(v) => updateProject({ project_address: v || null })}
          />
          <LabelField
            label="設計概念（一句話）"
            value={project.design_concept ?? ""}
            placeholder="例：日式侘寂、北歐淺色、自然紋理為主"
            onSave={(v) => updateProject({ design_concept: v || null })}
          />
        </div>
      </section>

      {/* 報價設定（影響「帶入估價」用的工資/毛利等） */}
      <LaborOptsPanel
        value={project.labor_opts}
        onSave={(opts) => updateProject({ labor_opts: opts })}
      />

      {/* 項目列表 */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-zinc-900">家具項目</h2>
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="px-3 py-1.5 rounded-lg bg-[#8b4513] text-white text-xs font-medium hover:bg-[#6f370f]"
          >
            {showAdd ? "收合" : "+ 加入家具"}
          </button>
        </div>

        {showAdd && (
          <AddItemPanel
            savedDesigns={savedDesigns ?? []}
            onAdd={addItemFromDesign}
            disabled={busy}
          />
        )}

        {grouped.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            還沒有家具項目。先去設計幾件家具並儲存，再回來加入這個專案。
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([room, list]) => (
              <div key={room}>
                <h3 className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">
                  📐 {room}（{list.length} 件）
                </h3>
                <ul className="space-y-2">
                  {list.map((it) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      laborOpts={project.labor_opts}
                      onUpdate={(patch) => updateItem(it.id, patch)}
                      onDelete={() => deleteItem(it.id)}
                      disabled={busy}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 總計 */}
      <section className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-5 mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-900">整套報價</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {totals.count} 件 · 單價以下方各項議價後價格為準（未填單價的項目以 0 計）
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-zinc-900 font-mono">
              {formatTWD(totals.subtotal)}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              訂金 {Math.round(project.deposit_rate * 100)}%：
              <span className="font-mono ml-1">
                {formatTWD(Math.round(totals.subtotal * project.deposit_rate))}
              </span>
            </div>
          </div>
        </div>

        {totals.count > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-wrap gap-2 justify-end">
            <Link
              href={`/projects/${projectId}/quote`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50"
            >
              👀 預覽報價
            </Link>
            <Link
              href={`/projects/${projectId}/quote/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50"
            >
              🖨️ 列印 / 存 PDF
            </Link>
            <Link
              href={`/projects/${projectId}/purchase`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50"
              title="按材質聚合所有家具的木料板才"
            >
              🛒 採購清單
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

      {/* 危險區 */}
      <section className="mt-12 pt-6 border-t border-zinc-200">
        <button
          type="button"
          onClick={deleteProject}
          disabled={busy}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          刪除整個專案
        </button>
      </section>
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
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-500 mb-1">{label}</span>
      <input
        type="text"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v.trim())}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-sm"
      />
    </label>
  );
}

function ItemRow({
  item,
  laborOpts,
  onUpdate,
  onDelete,
  disabled,
}: {
  item: ProjectItemRow;
  laborOpts: ProjectLaborOpts | null;
  onUpdate: (patch: Partial<ProjectItemRow>) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const p = item.params as Record<string, unknown>;
  const dim =
    [p.length, p.width, p.height].every((v) => typeof v === "number")
      ? `${p.length}×${p.width}×${p.height} mm`
      : "—";
  const matKey = typeof p.material === "string" ? p.material : "";
  const matName =
    matKey && (MATERIALS as Record<string, { nameZh: string }>)[matKey]?.nameZh;

  return (
    <li className="rounded-xl border-2 border-zinc-200 bg-white p-3 sm:p-4 grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 sm:gap-3 items-center">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-zinc-900 truncate">{item.name}</span>
          <span className="text-xs text-zinc-500">{categoryLabel(item.furniture_type)}</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          {dim}
          {matName ? ` · ${matName}` : ""}
        </p>
      </div>

      <input
        type="text"
        defaultValue={item.room ?? ""}
        placeholder="房間"
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

      <div className="flex items-center gap-1.5">
        <Link
          href={buildDesignHref(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-700 hover:underline px-2"
        >
          開啟
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="text-xs text-red-600 hover:underline px-2 disabled:opacity-50"
        >
          移除
        </button>
      </div>
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
      單價
      <div className="flex flex-col items-end">
        <input
          type="number"
          min={0}
          step={100}
          value={val}
          placeholder={hasEstimate ? `估 ${estimated}` : "—"}
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
            title="用模板與預設工資估算"
          >
            {isEmpty ? "帶入" : "更新為"}估價 ${estimated.toLocaleString()}
          </button>
        )}
      </div>
    </label>
  );
}

const LABOR_FIELDS: Array<{
  key: keyof ProjectLaborOpts;
  label: string;
  step: number;
  isRate?: boolean;
  hint?: string;
}> = [
  { key: "hourlyRate", label: "時薪 NT$/hr", step: 50, hint: "預設 500（資深師傅）" },
  { key: "marginRate", label: "毛利 %", step: 5, isRate: true, hint: "預設 30%" },
  { key: "finishingCost", label: "塗裝 NT$", step: 100, hint: "預設 1500" },
  { key: "shippingCost", label: "運費 NT$", step: 100, hint: "預設 0（自取）" },
  { key: "installationCost", label: "安裝 NT$", step: 100, hint: "預設 0" },
  { key: "hardwareCost", label: "五金 NT$", step: 100, hint: "預設 0" },
  { key: "vatRate", label: "稅率 %", step: 1, isRate: true, hint: "預設 0（不開發票）" },
  { key: "discountRate", label: "折扣 %", step: 1, isRate: true, hint: "0 = 不打折" },
];

function LaborOptsPanel({
  value,
  onSave,
}: {
  value: ProjectLaborOpts | null;
  onSave: (opts: ProjectLaborOpts | null) => void;
}) {
  const opts = value ?? {};
  const isEdited = value != null && Object.keys(value).length > 0;

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
          ⚙️ 報價設定
          <span className="ml-2 text-xs font-normal text-zinc-500">
            （影響「帶入估價」用的工資、毛利、稅率等）
          </span>
        </span>
        <span className="text-xs text-zinc-400">
          {isEdited ? "已自訂" : "用系統預設"}
        </span>
      </summary>
      <div className="px-5 pb-5 pt-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LABOR_FIELDS.map((f) => {
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
                placeholder={f.hint?.replace("預設 ", "")}
                onBlur={(e) => handleChange(f.key, e.target.value, !!f.isRate)}
                className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-sm font-mono"
              />
              {f.hint && (
                <span className="text-[10px] text-zinc-400 mt-0.5">{f.hint}</span>
              )}
            </label>
          );
        })}
        {isEdited && (
          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-zinc-200 flex justify-end">
            <button
              type="button"
              onClick={() => onSave(null)}
              className="text-xs text-zinc-500 hover:underline"
            >
              重設為系統預設
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
  const [room, setRoom] = useState("");
  if (savedDesigns.length === 0) {
    return (
      <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900">
        你還沒有任何儲存的設計。先去
        <Link href="/" className="underline mx-1">家具列表</Link>
        挑一個、調好尺寸後在頁面右上「💾 儲存設計」，再回來加入這個專案。
      </div>
    );
  }
  return (
    <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-amber-900">從儲存的設計加入</h3>
        <label className="text-xs text-amber-900 flex items-center gap-1">
          房間
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="例：玄關 / 客廳"
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
                  {d.name?.trim() || categoryLabel(d.furniture_type)}
                </span>
                <span className="text-xs text-zinc-500 shrink-0">
                  {categoryLabel(d.furniture_type)} · {dim}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

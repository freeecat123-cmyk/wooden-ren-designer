"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";

interface WhitelistRow {
  id: string;
  email: string;
  source: string | null;
  note: string | null;
  created_at: string;
}

interface CsvPreviewRow {
  email: string;
  name?: string;
  source?: string;
  note?: string;
}

const SOURCES = ["manual", "hahow", "omia", "woodenrenclass"];

export function WhitelistAdminClient() {
  const [rows, setRows] = useState<WhitelistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // 單筆新增表單
  const [newEmail, setNewEmail] = useState("");
  const [newSource, setNewSource] = useState<string>("manual");
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // CSV 預覽
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[] | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/whitelist", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q) ||
        (r.source ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  async function handleAddSingle() {
    if (!newEmail.trim()) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: newEmail,
          source: newSource,
          note: newNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "add failed");
      setFlash(`✅ 新增 ${json.added ?? 1} 筆`);
      setNewEmail("");
      setNewNote("");
      await load();
    } catch (e) {
      setFlash(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: CsvPreviewRow[] = (result.data ?? [])
          .map((row) => ({
            email: (row.email ?? "").trim(),
            name: row.name?.trim() || undefined,
            source: row.source?.trim() || undefined,
            note: row.note?.trim() || undefined,
          }))
          .filter((r) => r.email);
        setCsvPreview(parsed);
        setFlash(`📄 解析 ${parsed.length} 筆，請確認後匯入`);
      },
      error: (err) => {
        setFlash(`❌ CSV 解析失敗：${err.message}`);
      },
    });
  }

  async function handleImportCsv() {
    if (!csvPreview || csvPreview.length === 0) return;
    setCsvImporting(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvPreview }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "import failed");
      setFlash(
        `✅ 匯入完成：${json.added ?? 0} 筆${
          json.upgradeError ? `（已註冊用戶升級失敗：${json.upgradeError}）` : ""
        }`,
      );
      setCsvPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      setFlash(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCsvImporting(false);
    }
  }

  async function handleDelete(email: string) {
    if (!window.confirm(`確定要從白名單移除 ${email}？\n（已升級的學員不會被自動降級）`)) return;
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "delete failed");
      setFlash(`✅ 已移除 ${email}`);
      await load();
    } catch (e) {
      setFlash(`❌ ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <a href="/" className="text-sm text-zinc-500 hover:underline">
          ← 回首頁
        </a>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2 text-zinc-900">
          白名單管理
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          加入此名單的 email，註冊後自動開通 student 方案（功能等同 pro）。
          已註冊但 plan=free 的同 email 也會在新增時同步升級。
        </p>
      </header>

      {flash && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {flash}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          載入失敗：{error}
        </div>
      )}

      {/* === 新增區塊 === */}
      <section className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* 單筆新增 */}
        <div className="border border-zinc-200 rounded-lg p-4 bg-white">
          <h2 className="font-semibold text-zinc-900 mb-3">新增單筆</h2>
          <div className="flex flex-col gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3 py-2 rounded border border-zinc-300 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className="flex-1 px-3 py-2 rounded border border-zinc-300 text-sm"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="備註（選填）"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 px-3 py-2 rounded border border-zinc-300 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAddSingle}
              disabled={busy || !newEmail.trim()}
              className="px-4 py-2 rounded bg-emerald-700 text-white text-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? "新增中…" : "新增"}
            </button>
          </div>
        </div>

        {/* CSV 匯入 */}
        <div className="border border-zinc-200 rounded-lg p-4 bg-white">
          <h2 className="font-semibold text-zinc-900 mb-3">批量匯入 CSV</h2>
          <p className="text-xs text-zinc-500 mb-2">
            欄位：<code className="font-mono">email,name,source</code>（其它欄位忽略）
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-zinc-100 file:text-zinc-700 file:cursor-pointer"
          />
          {csvPreview && (
            <div className="mt-3">
              <div className="text-xs text-zinc-600 mb-2">
                預覽前 5 筆（共 {csvPreview.length} 筆）：
              </div>
              <ul className="text-xs text-zinc-700 space-y-0.5 max-h-32 overflow-auto pr-2">
                {csvPreview.slice(0, 5).map((r, i) => (
                  <li key={i} className="font-mono truncate">
                    {r.email} · {r.source ?? "manual"} · {r.name ?? r.note ?? "-"}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={csvImporting}
                className="mt-3 px-4 py-2 rounded bg-emerald-700 text-white text-sm hover:bg-emerald-800 disabled:opacity-50"
              >
                {csvImporting ? "匯入中…" : `確認匯入 ${csvPreview.length} 筆`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* === 搜尋 + 列表 === */}
      <section className="border border-zinc-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="🔍 搜尋 email / 來源 / 備註"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 rounded border border-zinc-300 text-sm"
          />
          <span className="text-sm text-zinc-500">
            共 {filtered.length} 筆 / 全部 {rows.length} 筆
          </span>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded border border-zinc-300 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            🔄 重新載入
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600 text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">來源</th>
                <th className="text-left px-4 py-2 font-medium">備註</th>
                <th className="text-left px-4 py-2 font-medium">建立時間</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500">
                    載入中…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500">
                    {search ? "查無符合" : "白名單還是空的——上方先加幾筆吧"}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100 hover:bg-amber-50/30">
                    <td className="px-4 py-2 font-mono text-zinc-800">{r.email}</td>
                    <td className="px-4 py-2 text-zinc-600">{r.source ?? "-"}</td>
                    <td className="px-4 py-2 text-zinc-600">{r.note ?? "-"}</td>
                    <td className="px-4 py-2 text-zinc-500 text-xs">
                      {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(r.email)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

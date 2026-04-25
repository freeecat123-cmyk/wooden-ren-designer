import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { AutoSubmitCheckbox } from "@/components/AutoSubmitCheckbox";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { ThreeViewLayout, MaterialList } from "@/lib/render/svg-views";
import { LazyPerspectiveView } from "@/components/LazyPerspectiveView";
import { MATERIALS } from "@/lib/materials";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import {
  JoineryDetail,
  JOINERY_LABEL,
  JOINERY_DESCRIPTION,
} from "@/lib/joinery/details";
import { ToolList } from "@/components/ToolList";
import { BuildSteps } from "@/components/BuildSteps";
import { DesignFormShell } from "@/components/design/DesignFormShell";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DesignPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry) notFound();

  if (!entry.template) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 回家具列表
        </Link>
        <h1 className="text-2xl font-bold mt-4">{entry.nameZh}</h1>
        <p className="mt-3 p-4 bg-amber-50 text-amber-800 rounded-lg">
          這個家具模板還在開發中，目前先支援「方凳」。
        </p>
      </main>
    );
  }

  const spStr = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const length = parseInt(spStr("length") ?? "") || entry.defaults.length;
  const width = parseInt(spStr("width") ?? "") || entry.defaults.width;
  const height = parseInt(spStr("height") ?? "") || entry.defaults.height;
  const material = (spStr("material") as MaterialId) ?? "maple";

  const options: Record<string, string | number | boolean> = {};
  const optionSchema = entry.optionSchema ?? [];
  for (const spec of optionSchema) {
    const raw = spStr(spec.key);
    if (raw === undefined || raw === "") {
      options[spec.key] = spec.defaultValue;
      continue;
    }
    if (spec.type === "number") {
      const n = Number(raw);
      options[spec.key] = Number.isFinite(n) ? n : spec.defaultValue;
    } else if (spec.type === "checkbox") {
      options[spec.key] = raw === "true" || raw === "on" || raw === "1";
    } else {
      options[spec.key] = raw;
    }
  }

  // 預設為「組裝版」（無榫卯，螺絲＋白膠組裝）。想要傳統榫接設計要明確加 joineryMode=true
  // 保留舊 URL 相容：beginnerMode=false 視為開啟榫接模式
  const joineryMode =
    spStr("joineryMode") === "true" ||
    spStr("joineryMode") === "1" ||
    spStr("beginnerMode") === "false";
  const rawDesign = entry.template({ length, width, height, material, options });
  const design = joineryMode ? rawDesign : toBeginnerMode(rawDesign);

  const printQuery = new URLSearchParams({
    length: String(length),
    width: String(width),
    height: String(height),
    material,
  });
  for (const spec of optionSchema) {
    printQuery.set(spec.key, String(options[spec.key]));
  }
  if (joineryMode) printQuery.set("joineryMode", "true");

  return (
    <main className="max-w-7xl mx-auto px-6 py-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 hover:underline">
        <span>←</span> 回家具列表
      </Link>

      <header className="mt-2 mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{entry.nameZh}</h1>
          <p className="mt-0.5 text-xs text-zinc-500 flex flex-wrap items-center gap-2">
            <span>{entry.description}</span>
            <span className="font-mono text-zinc-700">· {length} × {width} × {height} mm</span>
            <span>· {MATERIALS[material].nameZh}</span>
            <span>· {design.parts.length} 件</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/design/${type}/quote?${printQuery.toString()}`}
            target="_blank"
            className="px-3 py-1.5 bg-emerald-700 text-white rounded text-xs hover:bg-emerald-800"
          >
            💰 產生報價
          </Link>
          <Link
            href={`/design/${type}/print?${printQuery.toString()}`}
            target="_blank"
            className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs hover:bg-zinc-700 transition"
          >
            🖨️ 列印 / PDF
          </Link>
        </div>
      </header>

      {/* 主視覺：左邊參數（sticky）↔ 右邊 3D + 三視圖 */}
      <section className="grid lg:grid-cols-[5fr_7fr] gap-4">
        <div className="lg:sticky lg:top-4 self-start">
          <ParameterForm
            type={type}
            defaults={{ length, width, height, material }}
            optionSchema={optionSchema}
            optionValues={options}
            joineryMode={joineryMode}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 flex items-center gap-2">
              <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
              透視圖（3D · 拖曳旋轉）
            </div>
            <LazyPerspectiveView design={design} />
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-200 text-xs font-semibold text-zinc-700 flex items-center gap-2">
              <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
              工程三視圖
              <span className="ml-auto text-[10px] font-normal text-zinc-400">
                標示為組裝後肩到肩可見尺寸
              </span>
            </div>
            <div className="p-3">
              <ThreeViewLayout design={design} />
            </div>
          </div>
        </div>
      </section>

      {/* 下半：施工備料（按需展開） */}
      <details className="mt-4 rounded-lg border border-zinc-200 bg-white overflow-hidden" open>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            🪵 材料單
            <span className="text-[10px] font-normal text-zinc-400">{design.parts.length} 件 · 切料尺寸已含榫頭</span>
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200">
          <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500">
            <span>切料尺寸已含榫頭凸出長度。母榫（凹）不影響零件外形尺寸。</span>
            <Link
              href={`/design/${type}/cut-plan?${printQuery.toString()}`}
              target="_blank"
              className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] hover:bg-amber-700"
            >
              🪚 裁切計算器
            </Link>
          </div>
          <MaterialList design={design} />
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            {joineryMode ? "🪚 榫卯細節圖" : "🔩 組裝接合說明"}
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          {joineryMode ? (
            <JoinerySection design={design} />
          ) : (
            <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-5 text-sm text-emerald-900 leading-relaxed">
              <p className="font-semibold mb-2">📐 無榫卯組裝方式（擇一或混用）</p>
              <ul className="space-y-1.5 list-disc list-inside ml-1">
                <li><b>斜孔螺絲</b>—— 板材垂直接合（頂板↔側板、層板↔側板）。用斜孔器夾具鑽 15° 斜孔，螺絲從隱藏面鎖入，外觀看不到螺絲頭。</li>
                <li><b>木釘拼接</b>—— 板材拼寬或結構補強，用木板打孔定位器 + 8mm 木釘。</li>
                <li><b>DOMINO 圓榫</b>—— 想要更接近榫接強度可用 DOMINO 系統（機具另備）。</li>
                <li><b>木工螺絲 + 白膠</b>—— 框架類（椅腳↔牙板、橫撐↔椅腳）最簡單。先鑽先導孔避免劈裂。</li>
                <li><b>所有接點務必上白膠</b>—— 機械緊固 + 膠合才是真正牢固。螺絲木釘只是夾緊工具。</li>
              </ul>
              <p className="mt-3 text-xs text-emerald-700">
                建議工具：斜孔器夾具、木板打孔定位器、電鑽、鑽頭組、PVA 木工膠、F 夾具×4、砂紙 120/240/400。
              </p>
              <p className="mt-2 text-xs text-emerald-600">
                如需傳統榫卯設計（含榫頭榫眼細節圖、工序更精緻）請勾選左側「榫接模式」。
              </p>
            </div>
          )}
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            🛠️ 工具清單
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <ToolList design={design} />
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800 flex items-center gap-2">
            <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
            📋 製作工序
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <BuildSteps design={design} />
        </div>
      </details>
    </main>
  );
}

function JoineryRulesCallout() {
  return (
    <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-4 text-xs text-amber-900 leading-relaxed mb-5">
      <p className="font-semibold mb-1.5">
        榫卯比例規則（本設計依此推算 — FWW / Popular Woodworking / Woodcraft / Rockler 共識）
      </p>
      <ul className="space-y-0.5 list-disc list-inside">
        <li>
          <b>方榫厚</b> = <b>被開榫眼的母件（柱腳）厚度的 1/3</b>（例 1.5" 柱腳 → 1/2" 榫厚）；
          若公件較薄則取 <b>min(公件厚 − 兩側肩各 6mm, 母厚/3)</b>
        </li>
        <li>
          <b>方榫長</b>：盲榫 = 柱腳寬的 <b>2/3</b>；通榫 = 母件厚度（穿透，常加 <b>楔片</b>防脫）
        </li>
        <li>
          <b>方榫寬</b> = 牙板寬 <b>−上下肩各 6mm</b>（固定量非比例）；
          榫寬 &gt; 5×榫厚或牙板 &gt; 125mm 時拆 <b>雙榫</b>（twin tenon）
        </li>
        <li>
          <b>帶肩榫肩長</b> = 主榫長 <b>1/3</b>；肩榫永遠在主榫<b>上方</b>，補滿桌面通榫孔縫 + 防旋轉
        </li>
        <li>
          <b>企口榫</b>：舌厚 = 板厚 <b>1/3</b>（18mm 板 → 6mm 舌）、兩側肩各 6mm；
          <b>凹槽深度 = 舌長 + 1mm</b>（必留漲縮餘量，否則濕季撕裂）
        </li>
        <li>
          <b>鳩尾榫</b>：硬木 <b>1:8</b>（≈7.1°）、軟木 <b>1:6</b>（≈9.5°）；
          兩端必為「銷」（pin）不是「尾」，承拉力
        </li>
        <li>
          <b>半搭榫</b>：兩件各削 <b>1/2</b> 板厚；垂直半搭強度 = 整體 1/2，水平半搭僅 1/8
        </li>
        <li>
          <b>指接榫</b>：指厚 = 板厚 <b>1/2</b>；指數 4–9 個常見，比例 1:1 或 1:2 都可
        </li>
        <li>
          <b>圓棒榫</b>：木釘徑 = 板厚 <b>1/3</b>（不超過 1/2）；長 = 徑 × 1.5 + 1/16" 餘量；
          沿邊每尺 4–6 支
        </li>
        <li>
          <b>配合容差</b>（mortise ↔ tenon）：緊 0.05–0.13mm｜<b>標準 0.13–0.25mm</b>｜鬆 0.25–0.38mm
        </li>
      </ul>
    </div>
  );
}

function JoinerySection({ design }: { design: FurnitureDesign }) {
  const usages = extractJoineryUsages(design);
  if (usages.length === 0) {
    return <p className="text-sm text-zinc-500">這個設計沒有可顯示的榫卯。</p>;
  }
  return (
    <div className="space-y-6">
      <JoineryRulesCallout />
      {usages.map((u, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-4"
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h3 className="font-semibold">
              {JOINERY_LABEL[u.type]}{" "}
              <span className="text-xs font-normal text-zinc-500">
                · {u.partNameZh} ↔ {u.motherPartNames.length > 0 ? u.motherPartNames.join(" / ") : "母件"} · 共 {u.count} 處
              </span>
            </h3>
            <p className="text-xs text-zinc-500">
              榫頭 {u.tenon.length} × {u.tenon.width} × {u.tenon.thickness} mm
            </p>
          </div>
          <p className="text-xs text-zinc-600 mb-3">{JOINERY_DESCRIPTION[u.type]}</p>
          <JoineryDetail
            type={u.type}
            params={{
              tenonLength: u.tenon.length,
              tenonWidth: u.tenon.width,
              tenonThickness: u.tenon.thickness,
              motherThickness: u.estimatedMotherThickness,
              childThickness: u.childThickness,
              childWidth: u.childWidth,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ParameterForm({
  type,
  defaults,
  optionSchema,
  optionValues,
  joineryMode,
}: {
  type: string;
  defaults: { length: number; width: number; height: number; material: MaterialId };
  optionSchema: OptionSpec[];
  optionValues: Record<string, string | number | boolean>;
  joineryMode: boolean;
}) {
  return (
    <DesignFormShell
      action={`/design/${type}`}
      className="p-5 bg-zinc-50 rounded-lg ring-1 ring-zinc-200"
    >
      <label className="mb-5 flex items-start gap-3 p-3 rounded-lg bg-amber-50 ring-1 ring-amber-200 cursor-pointer">
        <input
          type="checkbox"
          name="joineryMode"
          value="true"
          defaultChecked={joineryMode}
          className="mt-0.5 h-4 w-4 accent-amber-600"
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-amber-900">🪵 榫接模式（傳統榫卯）</div>
          <div className="text-xs text-amber-700 mt-0.5">
            開啟後使用傳統榫卯接合（含榫頭榫眼細節圖 + 精緻工序）。不勾選則為**組裝版**（螺絲、木釘、DOMINO、斜孔系統，無榫卯）——施作更快，結構強度約榫接版 60–70%，日常家具夠用。
          </div>
        </div>
      </label>
      <div className="mb-4 pb-3 border-b border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
          <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
          整體尺寸
        </h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <NumberInput name="length" label="長 (mm)" defaultValue={defaults.length} />
        <NumberInput name="width" label="寬 (mm)" defaultValue={defaults.width} />
        <NumberInput name="height" label="高 (mm)" defaultValue={defaults.height} />
        <label className="flex flex-col text-xs">
          <span className="text-zinc-600 mb-1">木材</span>
          <select
            name="material"
            defaultValue={defaults.material}
            className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
          >
            {Object.values(MATERIALS).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameZh}
              </option>
            ))}
          </select>
        </label>
      </div>

      {optionSchema.length > 0 && (
        <>
          <div className="mb-3 pb-2 border-b border-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-0.5 h-4 bg-amber-500 rounded-full" />
              細部設定
            </h3>
          </div>
          <GroupedOptionFields
            optionSchema={optionSchema}
            optionValues={optionValues}
          />
        </>
      )}

      <p className="text-[11px] text-zinc-500 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        改參數 0.5 秒後自動更新設計
      </p>
    </DesignFormShell>
  );
}

const GROUP_META: Record<
  string,
  { label: string; icon: string; bar: string }
> = {
  top:        { label: "桌面 / 座板",   icon: "🪵", bar: "bg-sky-400"     },
  // 三層櫃：上中下（從上到下排序）
  "zone-top": { label: "上層",         icon: "▲", bar: "bg-sky-500"     },
  "zone-mid": { label: "中層",         icon: "■", bar: "bg-sky-400"     },
  "zone-bot": { label: "下層",         icon: "▼", bar: "bg-sky-300"     },
  // 三欄櫃：左中右（由左到右排序）
  "col-left":  { label: "左欄",        icon: "◀", bar: "bg-violet-500"  },
  "col-mid":   { label: "中欄",        icon: "●", bar: "bg-violet-400"  },
  "col-right": { label: "右欄",        icon: "▶", bar: "bg-violet-300"  },
  leg:        { label: "桌腳 / 椅腳",   icon: "🦵", bar: "bg-rose-400"    },
  apron:      { label: "牙板",         icon: "━", bar: "bg-amber-400"   },
  stretcher:  { label: "橫撐 / 連腳料",  icon: "║", bar: "bg-emerald-400" },
  back:       { label: "椅背 / 背板",   icon: "◧", bar: "bg-teal-400"    },
  drawer:     { label: "抽屜",         icon: "▦", bar: "bg-violet-400"  },
  door:       { label: "門",           icon: "▯", bar: "bg-fuchsia-400" },
  misc:       { label: "其他",         icon: "⚙", bar: "bg-zinc-400"    },
};

const GROUP_ORDER = [
  "top",
  "zone-top",
  "zone-mid",
  "zone-bot",
  "col-left",
  "col-mid",
  "col-right",
  "leg",
  "apron",
  "stretcher",
  "back",
  "drawer",
  "door",
  "misc",
];

function isVisible(
  _spec: OptionSpec,
  _values: Record<string, string | number | boolean>,
): boolean {
  // 常駐顯示所有子選項，不用勾父 checkbox 才出來
  return true;
}

function GroupedOptionFields({
  optionSchema,
  optionValues,
}: {
  optionSchema: OptionSpec[];
  optionValues: Record<string, string | number | boolean>;
}) {
  const visibleSchema = optionSchema.filter((s) => isVisible(s, optionValues));
  const grouped = new Map<string, OptionSpec[]>();
  for (const spec of visibleSchema) {
    const g = spec.group ?? "misc";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(spec);
  }
  const keysInOrder = GROUP_ORDER.filter((k) => grouped.has(k)).concat(
    Array.from(grouped.keys()).filter((k) => !GROUP_ORDER.includes(k)),
  );
  return (
    <div className="mb-5 rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
      {keysInOrder.map((g) => {
        const meta = GROUP_META[g] ?? GROUP_META.misc;
        const specs = grouped.get(g)!;
        return (
          <details
            key={g}
            open
            className="group"
          >
            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none hover:bg-zinc-50 select-none">
              <span className={`w-1 h-4 rounded-full ${meta.bar}`} />
              <span className="text-sm font-semibold text-zinc-800">
                {meta.label}
              </span>
              <span className="text-[10px] text-zinc-400">
                {specs.length} 項
              </span>
              <span className="ml-auto text-xs text-zinc-400 group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2.5">
              {specs.map((spec) => {
                const isWide = spec.type === "checkbox" && spec.wide;
                return (
                  <div
                    key={spec.key}
                    className={isWide ? "col-span-2 md:col-span-3 lg:col-span-4" : ""}
                  >
                    <OptionField spec={spec} value={optionValues[spec.key]} />
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function OptionField({
  spec,
  value,
}: {
  spec: OptionSpec;
  value: string | number | boolean;
}) {
  if (spec.type === "number") {
    return (
      <label className="flex flex-col text-xs">
        <span className="text-zinc-700 mb-1">
          {spec.label}
          {spec.unit && <span className="text-zinc-400 ml-1">·{spec.unit}</span>}
        </span>
        <input
          type="number"
          name={spec.key}
          defaultValue={String(value)}
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1}
          className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
        />
        {spec.help && <span className="mt-1 text-[10px] text-zinc-500">{spec.help}</span>}
      </label>
    );
  }
  if (spec.type === "select") {
    return (
      <label className="flex flex-col text-xs">
        <span className="text-zinc-700 mb-1">{spec.label}</span>
        <select
          name={spec.key}
          defaultValue={String(value)}
          className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
        >
          {spec.choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {spec.help && <span className="mt-1 text-[10px] text-zinc-500">{spec.help}</span>}
      </label>
    );
  }
  // checkbox — auto-submit so conditional sub-options appear immediately on toggle
  return (
    <AutoSubmitCheckbox
      name={spec.key}
      defaultChecked={Boolean(value)}
      label={spec.label}
      help={spec.help}
    />
  );
}

function NumberInput({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={20}
        max={4000}
        step={5}
        inputMode="numeric"
        pattern="[0-9]*"
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
      />
    </label>
  );
}

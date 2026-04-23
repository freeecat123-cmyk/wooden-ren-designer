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
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 hover:underline">
        <span>←</span> 回家具列表
      </Link>

      <header className="mt-4 mb-8">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{entry.nameZh}</h1>
            <p className="mt-1 text-sm text-zinc-600 max-w-2xl">{entry.description}</p>
          </div>
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
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm hover:bg-zinc-700 transition"
          >
            🖨️ 列印 / PDF
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 font-mono">
            {length} × {width} × {height} mm
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200">
            {MATERIALS[material].nameZh}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
            {design.parts.length} 件零件
          </span>
        </div>
      </header>

      <ParameterForm
        type={type}
        defaults={{ length, width, height, material }}
        optionSchema={optionSchema}
        optionValues={options}
        joineryMode={joineryMode}
      />

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          透視圖（3D）
        </h2>
        <LazyPerspectiveView design={design} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          工程三視圖
        </h2>
        <ThreeViewLayout design={design} />
        <p className="mt-3 text-xs text-zinc-500">
          ⚠️ 標示為組裝後可見尺寸（肩到肩）。實際切料尺寸含榫頭，請看下方材料單。
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          材料單
        </h2>
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <MaterialList design={design} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          切料尺寸已含榫頭凸出長度。母榫（凹）不影響零件外形尺寸。
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          {joineryMode ? "榫卯細節圖" : "組裝接合說明"}
        </h2>
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
              如需傳統榫卯設計（含榫頭榫眼細節圖、工序更精緻）請勾選上方「榫接模式」。
            </p>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          工具清單
        </h2>
        <ToolList design={design} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full" />
          製作工序
        </h2>
        <BuildSteps design={design} />
      </section>
    </main>
  );
}

function JoineryRulesCallout() {
  return (
    <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-4 text-xs text-amber-900 leading-relaxed mb-5">
      <p className="font-semibold mb-1.5">榫卯比例規則（本設計依此推算，Fine Woodworking / Popular Woodworking 共識）</p>
      <ul className="space-y-0.5 list-disc list-inside">
        <li><b>榫頭厚</b> = <b>被開榫眼的母件（柱腳）厚度的 1/3</b>（例 1.5" 柱腳 → 1/2" 榫頭）；若公件較薄則受限於 <b>公件厚 − 兩側肩 6mm</b></li>
        <li><b>盲榫長</b> = 柱腳寬的 <b>2/3</b>；<b>通榫長</b> = 母件厚度（穿透）</li>
        <li><b>榫寬</b> = 牙板寬 <b>−上下肩各 6mm</b>（固定量，非比例）；牙板寬 &gt; 125mm 時建議拆雙榫</li>
        <li><b>帶肩榫肩長</b> = 主榫長的 <b>1/3</b>；肩榫永遠在主榫<b>上方</b>（補滿桌面通榫孔留下的缺口 + 防旋轉）</li>
        <li><b>企口榫舌厚</b> = 板厚的 <b>1/3</b>（18mm 板 → 6mm 舌）；兩側肩各 6mm。凹槽深度 ≈ 舌長，典型 8–12mm</li>
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
    <form
      method="get"
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

      <button
        type="submit"
        className="px-5 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700 text-sm font-medium"
      >
        重新生成
      </button>
    </form>
  );
}

const GROUP_META: Record<string, { label: string; tone: string }> = {
  leg:       { label: "桌腳 / 椅腳",   tone: "bg-rose-100    ring-rose-200    text-rose-900"    },
  top:       { label: "桌面 / 座板",   tone: "bg-sky-100     ring-sky-200     text-sky-900"     },
  apron:     { label: "牙板",         tone: "bg-amber-100   ring-amber-200   text-amber-900"   },
  stretcher: { label: "橫撐 / 連腳料",  tone: "bg-emerald-100 ring-emerald-200 text-emerald-900" },
  drawer:    { label: "抽屜",         tone: "bg-violet-100  ring-violet-200  text-violet-900"  },
  door:      { label: "門",           tone: "bg-fuchsia-100 ring-fuchsia-200 text-fuchsia-900" },
  back:      { label: "椅背 / 背板",   tone: "bg-teal-100    ring-teal-200    text-teal-900"    },
  misc:      { label: "其他",         tone: "bg-zinc-100    ring-zinc-200    text-zinc-800"    },
};

const GROUP_ORDER = [
  "top",
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
    <div className="space-y-3 mb-5">
      {keysInOrder.map((g) => {
        const meta = GROUP_META[g] ?? GROUP_META.misc;
        const specs = grouped.get(g)!;
        return (
          <div
            key={g}
            className={`rounded-lg ring-1 p-3 ${meta.tone}`}
          >
            <div className="text-xs font-semibold mb-2 opacity-80">
              {meta.label}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {specs.map((spec) => (
                <OptionField
                  key={spec.key}
                  spec={spec}
                  value={optionValues[spec.key]}
                />
              ))}
            </div>
          </div>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, FurnitureDesign, MaterialId } from "@/lib/types";
import { ThreeViewLayout, MaterialList } from "@/lib/render/svg-views";
import { PerspectiveView } from "@/components/PerspectiveView";
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
  searchParams: Promise<{
    length?: string;
    width?: string;
    height?: string;
    material?: string;
  }>;
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

  const length = parseInt(sp.length ?? "") || entry.defaults.length;
  const width = parseInt(sp.width ?? "") || entry.defaults.width;
  const height = parseInt(sp.height ?? "") || entry.defaults.height;
  const material = (sp.material as MaterialId) ?? "taiwan-cypress";

  const design = entry.template({ length, width, height, material });

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 回家具列表
      </Link>

      <header className="mt-3 mb-8 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">{entry.nameZh}</h1>
          <p className="mt-1 text-sm text-zinc-600">{entry.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-500">
            {length} × {width} × {height} mm · {MATERIALS[material].nameZh}
          </p>
          <Link
            href={`/design/${type}/print?length=${length}&width=${width}&height=${height}&material=${material}`}
            target="_blank"
            className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs hover:bg-zinc-700"
          >
            🖨️ 列印 / PDF
          </Link>
        </div>
      </header>

      <ParameterForm
        type={type}
        defaults={{ length, width, height, material }}
      />

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">透視圖（3D）</h2>
        <PerspectiveView design={design} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">工程三視圖</h2>
        <ThreeViewLayout design={design} />
        <p className="mt-3 text-xs text-zinc-500">
          ⚠️ 標示為組裝後可見尺寸（肩到肩）。實際切料尺寸含榫頭，請看下方材料單。
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">材料單</h2>
        <div className="rounded-lg border border-zinc-200 overflow-hidden">
          <MaterialList design={design} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          切料尺寸已含榫頭凸出長度。母榫（凹）不影響零件外形尺寸。
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">榫卯細節圖</h2>
        <JoinerySection design={design} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">工具清單</h2>
        <ToolList design={design} />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">製作工序</h2>
        <BuildSteps design={design} />
      </section>
    </main>
  );
}

function JoinerySection({ design }: { design: FurnitureDesign }) {
  const usages = extractJoineryUsages(design);
  if (usages.length === 0) {
    return <p className="text-sm text-zinc-500">這個設計沒有可顯示的榫卯。</p>;
  }
  return (
    <div className="space-y-6">
      {usages.map((u, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 bg-white p-4"
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h3 className="font-semibold">
              {JOINERY_LABEL[u.type]}{" "}
              <span className="text-xs font-normal text-zinc-500">
                · {u.partNameZh} ↔ 鄰接零件 · 共 {u.count} 處
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
}: {
  type: string;
  defaults: { length: number; width: number; height: number; material: MaterialId };
}) {
  return (
    <form
      method="get"
      action={`/design/${type}`}
      className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-zinc-50 rounded-lg"
    >
      <NumberInput name="length" label="長 (mm)" defaultValue={defaults.length} />
      <NumberInput name="width" label="寬 (mm)" defaultValue={defaults.width} />
      <NumberInput name="height" label="高 (mm)" defaultValue={defaults.height} />
      <label className="flex flex-col text-xs">
        <span className="text-zinc-600 mb-1">木材</span>
        <select
          name="material"
          defaultValue={defaults.material}
          className="border border-zinc-300 rounded px-2 py-1.5 bg-white"
        >
          {Object.values(MATERIALS).map((m) => (
            <option key={m.id} value={m.id}>
              {m.nameZh}
            </option>
          ))}
        </select>
      </label>
      <div className="col-span-2 md:col-span-4">
        <button
          type="submit"
          className="px-4 py-2 bg-zinc-900 text-white rounded hover:bg-zinc-700 text-sm"
        >
          重新生成
        </button>
      </div>
    </form>
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
        min={50}
        max={3000}
        step={10}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white"
      />
    </label>
  );
}

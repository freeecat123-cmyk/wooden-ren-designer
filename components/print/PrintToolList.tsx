import type { FurnitureDesign } from "@/lib/types";
import { deriveRequiredTools } from "@/lib/tools/derive";
import { buildShopUrl } from "@/lib/tools/utm";
import { qrSvg } from "@/lib/render/qr";
import type { ToolPriority } from "@/lib/tools/catalog";

const PRIORITY_LABEL: Record<ToolPriority, string> = {
  required: "必備工具",
  recommended: "建議工具",
  optional: "可選工具",
};

export async function PrintToolList({ design }: { design: FurnitureDesign }) {
  const tools = deriveRequiredTools(design);

  // Pre-render QR SVG for each tool that has a shopUrl
  const qrByToolId = new Map<string, string>();
  await Promise.all(
    tools.map(async (rt) => {
      if (!rt.tool.shopUrl) return;
      const url = buildShopUrl(rt.tool.shopUrl, design.id);
      const svg = await qrSvg(url, { size: 80 });
      qrByToolId.set(rt.tool.id, svg);
    }),
  );

  const grouped: Record<ToolPriority, typeof tools> = {
    required: [],
    recommended: [],
    optional: [],
  };
  for (const t of tools) grouped[t.priority].push(t);

  return (
    <div className="space-y-4">
      {(Object.keys(grouped) as ToolPriority[]).map((priority) => {
        const items = grouped[priority];
        if (items.length === 0) return null;
        return (
          <div key={priority} className="print-keep">
            <h3 className="text-base font-semibold mb-2 border-b border-zinc-300 pb-1">
              {PRIORITY_LABEL[priority]}（{items.length} 項）
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {items.map((rt) => {
                const url = rt.tool.shopUrl
                  ? buildShopUrl(rt.tool.shopUrl, design.id)
                  : null;
                const qr = qrByToolId.get(rt.tool.id);
                return (
                  <div
                    key={rt.tool.id}
                    className="flex gap-3 border border-zinc-300 rounded p-2 print-keep"
                  >
                    {qr && (
                      <div
                        className="shrink-0"
                        style={{ width: 80, height: 80 }}
                        dangerouslySetInnerHTML={{ __html: qr }}
                      />
                    )}
                    <div className="flex-1 min-w-0 text-xs leading-snug">
                      <div className="font-semibold text-sm">
                        {rt.tool.nameZh}
                      </div>
                      <div className="text-zinc-600 mt-0.5">{rt.reason}</div>
                      {url ? (
                        <div className="mt-1">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-900 underline"
                          >
                            查看商品 →
                          </a>
                          <div className="text-[9px] text-zinc-400 break-all mt-0.5 font-mono">
                            {url}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-zinc-400">尚未上架</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

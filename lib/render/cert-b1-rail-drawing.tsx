import { certB1Assembly, certB1FrontProfile } from "@/lib/templates/cert-b1";
import { mortiseLocalBox } from "@/lib/render/svg-views";

/** Own drawing generated from the same geometry as the model, not a source-image trace. */
export function CertB1RailDrawing() {
  const rail = certB1Assembly().parts.find(p => p.id === "front-rail")!;
  const cut = mortiseLocalBox(rail, rail.mortises[0]);
  // Stable serialization across server/client math implementations (0.0001mm).
  const outline = certB1FrontProfile().map(([x, z]) => `${(198 + x).toFixed(4)},${(90 + z).toFixed(4)}`).join(" ");
  const notchWidth = cut.hy * 2, notchHeight = cut.hz * 2;
  return <svg xmlns="http://www.w3.org/2000/svg" width="470mm" height="180mm" viewBox="0 0 470 180"
    role="img" aria-label="自行繪製的前曲線橫檔板身放樣圖，不含榫頭">
    <rect width="470" height="180" fill="white" />
    <g fill="#18181b" fontFamily="sans-serif" fontSize="4">
      <text x="25" y="14" fontSize="6">木作藍圖｜乙級第一題・前曲線橫檔</text>
      <text x="25" y="23">板身放樣圖・不含榫頭・單位 mm</text>
      <g stroke="#18181b" strokeWidth="0.4" fill="none" strokeLinejoin="round">
        <polygon points={outline} />
        <path d={`M420,64 H${420 + notchWidth} V60 H438 V120 H420 Z`} />
      </g>
      <g stroke="#52525b" strokeWidth="0.2" fill="none">
        <path d="M25,57 V36 M371,57 V36 M25,40 H371 M23,42 L27,38 M369,42 L373,38" />
        <path d="M374,60 H393 M374,120 H393 M389,60 V120 M387,62 L391,58 M387,122 L391,118" />
        <path d="M25,123 V147 M95,123 V147 M25,143 H95 M23,145 L27,141 M93,145 L97,141" />
        <path d="M301,123 V147 M371,123 V147 M301,143 H371 M299,145 L303,141 M369,145 L373,141" />
        <path d="M420,123 V147 M438,123 V147 M420,143 H438 M418,145 L422,141 M436,145 L440,141" />
        <path d="M102,117 L120,150 H143 M120,101 L139,134 H160" />
        <path d="M423,62 L411,45 H398" />
        <path d="M198,55 V126" strokeDasharray="3 1 0.5 1" />
      </g>
      <text x="198" y="37" textAnchor="middle">{rail.visible.length}</text>
      <text x="395" y="92">{rail.visible.width}</text>
      <text x="60" y="140" textAnchor="middle">70</text>
      <text x="336" y="140" textAnchor="middle">70</text>
      <text x="429" y="140" textAnchor="middle">{rail.visible.thickness}</text>
      <text x="145" y="151">R15</text><text x="162" y="135">R15</text>
      <text x="398" y="42">{notchWidth} × {notchHeight}</text>
      <text x="198" y="53" textAnchor="middle">板面</text>
      <text x="429" y="155" textAnchor="middle">端面</text>
      <text x="25" y="168">榫接另行核定；本圖不代表完整施工包。實尺寸輸出 470 × 180 mm，列印勿縮放。</text>
    </g>
  </svg>;
}

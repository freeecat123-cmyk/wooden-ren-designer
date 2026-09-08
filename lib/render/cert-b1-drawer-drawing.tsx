import { certB1Assembly } from "@/lib/templates/cert-b1";
import { mortiseLocalBox } from "@/lib/render/svg-views";

export function certB1DrawerMachining() {
  const parts = certB1Assembly().parts;
  const front = parts.find(p => p.id === "drawer-1-front")!;
  const side = parts.find(p => p.id === "drawer-1-side-left")!;
  const hole = front.mortises.find(m => m.shape === "round")!;
  function groove(label: string) {
    const m = side.mortises.find(m => m.label?.includes(label))!;
    const b = mortiseLocalBox(side, m);
    return { top: side.visible.width / 2 + b.cz - b.hz, height: b.hz * 2, depth: b.hy * 2 };
  }
  return {
    front: { length: front.visible.length, height: front.visible.width, thickness: front.visible.thickness,
      holeX: front.visible.length / 2 + hole.origin.x, holeY: front.visible.width / 2 + hole.origin.z, diameter: hole.length },
    side: { diagramLength: side.visible.length, height: side.visible.width, thickness: side.visible.thickness,
      outer: groove("滑條槽"), inner: groove("底板槽") },
  };
}

function HorizontalDimension({ x, y, length, label }: { x: number; y: number; length: number; label: string | number }) {
  return <g><path d={`M${x},${y - 3} v6 M${x + length},${y - 3} v6 M${x},${y} h${length}`} stroke="#52525b" strokeWidth="0.2" fill="none" />
    <text x={x + length / 2} y={y - 2} textAnchor="middle">{label}</text></g>;
}

export function CertB1DrawerDrawing({ kind }: { kind: "front" | "side" }) {
  const { front: f, side: s } = certB1DrawerMachining();
  const height = kind === "front" ? 210 : 345;
  return <svg xmlns="http://www.w3.org/2000/svg" width="470mm" height={`${height}mm`} viewBox={`0 0 470 ${height}`}
    role="img" aria-label={kind === "front" ? "抽屜前板指孔加工圖" : "抽屜側板雙面開槽圖"}>
    <rect width="470" height={height} fill="white" />
    <g fill="#18181b" fontFamily="sans-serif" fontSize="4">
      <text x="25" y="15" fontSize="6">木作藍圖｜乙級第一題・{kind === "front" ? "抽屜前板指孔" : "抽屜側板雙面開槽"}</text>
      <text x="25" y="25">自行繪製・單位 mm・鳩尾榫另行核定</text>
      {kind === "front" ? <>
        <HorizontalDimension x={25} y={43} length={f.length} label={f.length} />
        <g fill="none" stroke="#18181b" strokeWidth="0.4">
          <rect x="25" y="55" width={f.length} height={f.height} />
          <circle cx={25 + f.holeX} cy={55 + f.holeY} r={f.diameter / 2} />
          <path d={`M${25 + f.holeX},50 V${60 + f.height} M20,${55 + f.holeY} H${30 + f.length}`} strokeWidth="0.2" strokeDasharray="3 1 0.5 1" />
          <path d={`M${25 + f.holeX + 7},${55 + f.holeY - 7} l20,-20 h20`} strokeWidth="0.2" />
          <path d={`M375,55 v${f.height} M371,55 h8 M371,${55 + f.height} h8`} strokeWidth="0.2" />
        </g>
        <text x={25 + f.holeX + 50} y={55 + f.holeY - 25}>Ø{f.diameter} 貫穿</text>
        <text x="381" y={55 + f.height / 2}>{f.height}</text>
        <HorizontalDimension x={25} y={173} length={f.holeX} label={`孔心距左緣 ${f.holeX}`} />
        <text x="25" y="186">孔心距上緣 {f.holeY}；板厚 {f.thickness}。</text>
        <text x="25" y="199">本張僅核對指孔；底板槽、端部鳩尾接合不在本圖的已核範圍。</text>
      </> : <>
        {[{ title: "外側面・滑條槽", groove: s.outer, y: 55 }, { title: "內側面・底板槽", groove: s.inner, y: 205 }].map(({ title, groove, y }) =>
          <g key={title}>
            <text x="25" y={y - 8}>{title}</text>
            <g fill="none" stroke="#18181b" strokeWidth="0.35">
              <rect x="25" y={y} width={s.diagramLength} height={s.height} />
              <rect x="25" y={y + groove.top} width={s.diagramLength} height={groove.height} fill="#f4f4f5" />
              <path d={`M375,${y} v${s.height} M371,${y} h8 M371,${y + s.height} h8`} strokeWidth="0.2" />
            </g>
            <text x="381" y={y + s.height / 2}>{s.height}</text>
            <text x="30" y={y + groove.top - 5}>上緣至槽 {groove.top}；槽寬 {groove.height}；深 {groove.depth}</text>
            <HorizontalDimension x={25} y={y + s.height + 12} length={s.diagramLength} label="全長待端榫核定（非切料長）" />
          </g>)}
        <text x="420" y="47">端面</text>
        <path d={`M420,55 H${420 + s.thickness} V${55 + s.inner.top} h${-s.inner.depth} v${s.inner.height} h${s.inner.depth} V${55 + s.height} H420 V${55 + s.outer.top + s.outer.height} h${s.outer.depth} v${-s.outer.height} h${-s.outer.depth} Z`}
          stroke="#18181b" strokeWidth="0.4" fill="none" />
        <HorizontalDimension x={420} y={173} length={s.thickness} label={s.thickness} />
        <text x="25" y="335">左右側板鏡像配對；槽的端點及鳩尾留料另行核定，本圖不可作為完整切料單。</text>
      </>}
    </g>
  </svg>;
}

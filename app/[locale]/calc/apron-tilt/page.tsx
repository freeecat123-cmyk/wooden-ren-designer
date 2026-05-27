"use client";

import { useState } from "react";
import Link from "next/link";

export default function ApronTiltCalc() {
  const [angle, setAngle] = useState(10);
  const [legHeight, setLegHeight] = useState(425);

  const tanA = Math.tan((angle * Math.PI) / 180);
  const splayMm = legHeight * tanA;
  const splayDx = splayMm / Math.SQRT2;
  const slope = splayDx / legHeight;
  const apronTilt = (Math.atan(slope) * 180) / Math.PI;

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← 回首頁
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-1">外斜腳家具 · 牙條斜度計算器</h1>
      <p className="text-sm text-zinc-600 mb-6">
        4 隻腳對角線 splay 的家具，apron / 牙條的斜度不是腳的整體斜度，
        而是「前/側視看到的腳投影斜度」。
      </p>

      {/* 輸入 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <label className="flex flex-col">
          <span className="text-sm text-zinc-700 mb-1">腳整體外斜角度（°）</span>
          <input
            type="number"
            min={0}
            max={45}
            step={1}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="border border-zinc-300 rounded px-3 py-2 text-lg font-mono"
          />
          <span className="text-xs text-zinc-400 mt-1">α — 腳跟垂直線的夾角</span>
        </label>
        <label className="flex flex-col">
          <span className="text-sm text-zinc-700 mb-1">腳高（mm）</span>
          <input
            type="number"
            min={100}
            max={2000}
            step={10}
            value={legHeight}
            onChange={(e) => setLegHeight(Number(e.target.value))}
            className="border border-zinc-300 rounded px-3 py-2 text-lg font-mono"
          />
          <span className="text-xs text-zinc-400 mt-1">H — 從地面到腳頂</span>
        </label>
      </div>

      {/* 主要結果 */}
      <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-5 mb-6">
        <div className="text-xs text-amber-900 mb-1">apron 該斜的角度</div>
        <div className="text-5xl font-bold text-amber-900 font-mono">
          {apronTilt.toFixed(2)}°
        </div>
        <div className="text-xs text-amber-800 mt-2">
          arctan(tan({angle}°) / √2)
        </div>
      </div>

      {/* 過程 */}
      <details open className="border border-zinc-200 rounded-lg p-4 mb-6 bg-zinc-50">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
          📐 計算過程（每步有白話解釋）
        </summary>
        <div className="mt-3 space-y-4 text-sm">
          {/* Step 1 */}
          <div className="border-l-4 border-amber-300 pl-3">
            <div className="font-semibold text-zinc-700 mb-1">
              Step 1：腳底比腳頂往外跑了多少？
            </div>
            <div className="font-mono text-zinc-800 mb-1">
              splayMm = H × tan(α) = {legHeight} × tan({angle}°) ={" "}
              <strong>{splayMm.toFixed(2)}</strong> mm
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              想像腳是直角三角形：腳高 H 是直立的一邊，斜出去的角度 α 在腳頂。<br />
              <code className="bg-zinc-200 px-1">tan(α) = 對邊/鄰邊 = 腳底跑多遠 / 腳高</code>
              <br />
              所以「腳底跑出去的距離」= H × tan(α)。這是「斜對角線」方向的總距離。
            </div>
          </div>

          {/* Step 2 */}
          <div className="border-l-4 border-amber-300 pl-3">
            <div className="font-semibold text-zinc-700 mb-1">
              Step 2：對角線距離分到「左右」跟「前後」各多少？
            </div>
            <div className="font-mono text-zinc-800 mb-1">
              splayDx = splayDz = splayMm / √2 = {splayMm.toFixed(2)} / 1.414 ={" "}
              <strong>{splayDx.toFixed(2)}</strong> mm
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              對角線方向 = 45° 角，所以對角線位移要拆成「X 軸（左右）」跟「Z 軸（前後）」兩個分量。<br />
              <code className="bg-zinc-200 px-1">分量 = 對角線 × cos(45°) = 對角線 / √2</code>
              <br />
              X、Z 各分到 splayMm/√2。例如腳對角線跑 75mm，分到左右各 53mm，前後也 53mm。
            </div>
          </div>

          {/* Step 3 */}
          <div className="border-l-4 border-amber-300 pl-3">
            <div className="font-semibold text-zinc-700 mb-1">
              Step 3：從前面看，腳的視覺斜率是多少？
            </div>
            <div className="font-mono text-zinc-800 mb-1">
              slope = splayDx / H = {splayDx.toFixed(2)} / {legHeight} ={" "}
              <strong>{slope.toFixed(4)}</strong>
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              站在家具正前方看，只看得到「前後」方向的斜（左右方向被「壓扁」看不出來）。<br />
              <code className="bg-zinc-200 px-1">斜率 = 水平位移 / 垂直高度</code>
              <br />
              所以前視看到的斜率 = splayDx ÷ 腳高。這個值約 0.23 表示「腳每升 1mm 高，往前跑 0.23mm」。
            </div>
          </div>

          {/* Step 4 */}
          <div className="border-l-4 border-amber-400 pl-3 bg-amber-50/50 -ml-1">
            <div className="font-semibold text-zinc-700 mb-1">
              Step 4：把斜率轉回角度
            </div>
            <div className="font-mono text-zinc-800 mb-1">
              apron tilt = arctan(slope) = arctan({slope.toFixed(4)}) ={" "}
              <strong>{apronTilt.toFixed(2)}°</strong>
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              <code className="bg-zinc-200 px-1">arctan</code> 是 tan 的反運算：知道斜率（對邊/鄰邊比），算出角度。<br />
              這就是 apron 該斜的角度——跟前視看到的腳完全平行，視覺對齊。
            </div>
          </div>

          {/* 結論 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs text-emerald-900">
            <strong>一句話總結：</strong>腳整體斜 {angle}°，但從前面看只看到 {apronTilt.toFixed(1)}°
            的斜（被 √2 「壓扁」了）。Apron 也是從前面看到的斜面，所以它要斜 {apronTilt.toFixed(1)}° 才對齊。
          </div>
        </div>
      </details>

      {/* 對照表 */}
      <details className="border border-zinc-200 rounded-lg p-4 mb-6">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
          📊 常用角度對照表
        </summary>
        <table className="w-full mt-3 text-sm font-mono">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-500">
              <th className="text-left py-1">腳 splay α</th>
              <th className="text-right py-1">apron tilt</th>
            </tr>
          </thead>
          <tbody>
            {[3, 5, 8, 10, 12, 15, 18, 20].map((a) => {
              const t = (Math.atan(Math.tan((a * Math.PI) / 180) / Math.SQRT2) * 180) / Math.PI;
              return (
                <tr key={a} className="border-b border-zinc-100">
                  <td className="py-1">{a}°</td>
                  <td className="text-right py-1">{t.toFixed(2)}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      {/* 為什麼 */}
      <details className="border border-zinc-200 rounded-lg p-4 text-sm text-zinc-700">
        <summary className="cursor-pointer font-semibold">💡 為什麼要除以 √2？</summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>圓凳 / 圓桌的 4 隻腳是往「對角線」（往 4 個角的斜方向）外踢，不是只往前後或只往左右。</p>
          <p>所以腳底總共往對角線跑了 splayMm 距離，分到「左右（X）」跟「前後（Z）」兩個方向，每個方向只跑 splayMm/√2。</p>
          <p>從正面看（只看前後 Z 方向），腳的視覺斜度就是 (splayMm/√2) ÷ 腳高 = tan(α)/√2，比腳的整體斜度小 √2 倍。</p>
          <p>Apron 是橫的、跟腳同一個觀察平面，所以它要斜的角度 = 前/側視看到的腳斜度 = arctan(tan(α)/√2)。</p>
        </div>
      </details>
    </main>
  );
}

"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useUnit } from "@/hooks/useUnit";
import { formatInchFraction } from "@/lib/units/format";

export default function ApronTiltCalc() {
  const t = useTranslations("apronTilt");
  const unitPref = useUnit();
  const [angle, setAngle] = useState(10);
  const [legHeight, setLegHeight] = useState(425);
  const showInchHelper = unitPref === "inch";

  const tanA = Math.tan((angle * Math.PI) / 180);
  const splayMm = legHeight * tanA;
  const splayDx = splayMm / Math.SQRT2;
  const slope = splayDx / legHeight;
  const apronTilt = (Math.atan(slope) * 180) / Math.PI;

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        {t("backHome")}
      </Link>

      <h1 className="text-2xl font-bold mt-3 mb-1">{t("h1")}</h1>
      <p className="text-sm text-zinc-600 mb-6">{t("intro")}</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <label className="flex flex-col">
          <span className="text-sm text-zinc-700 mb-1">{t("inputAngleLabel")}</span>
          <input
            type="number"
            min={0}
            max={45}
            step={1}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="border border-zinc-300 rounded px-3 py-2 text-lg font-mono"
          />
          <span className="text-xs text-zinc-400 mt-1">{t("inputAngleHint")}</span>
        </label>
        <label className="flex flex-col">
          <span className="text-sm text-zinc-700 mb-1">
            {t("inputLegHeightLabel")}
            {showInchHelper && (
              <span className="text-zinc-400 font-normal ml-1">(in)</span>
            )}
          </span>
          <input
            type="number"
            min={100}
            max={2000}
            step={10}
            value={legHeight}
            onChange={(e) => setLegHeight(Number(e.target.value))}
            className="border border-zinc-300 rounded px-3 py-2 text-lg font-mono"
          />
          {showInchHelper && Number.isFinite(legHeight) && (
            <span className="text-[10px] text-zinc-500 tabular-nums mt-0.5">
              ≈ {formatInchFraction(legHeight)}
            </span>
          )}
          <span className="text-xs text-zinc-400 mt-1">{t("inputLegHeightHint")}</span>
        </label>
      </div>

      <div className="border-2 border-amber-400 bg-amber-50 rounded-lg p-5 mb-6">
        <div className="text-xs text-amber-900 mb-1">{t("resultLabel")}</div>
        <div className="text-5xl font-bold text-amber-900 font-mono">
          {apronTilt.toFixed(2)}°
        </div>
        <div className="text-xs text-amber-800 mt-2">
          {t("resultFormulaTpl", { angle })}
        </div>
      </div>

      <details open className="border border-zinc-200 rounded-lg p-4 mb-6 bg-zinc-50">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
          {t("calcProcessSummary")}
        </summary>
        <div className="mt-3 space-y-4 text-sm">
          <div className="border-l-4 border-amber-300 pl-3">
            <div className="font-semibold text-zinc-700 mb-1">{t("step1H")}</div>
            <div className="font-mono text-zinc-800 mb-1">
              {t("step1FormulaTpl", { h: legHeight, angle })}{" "}
              <strong>{splayMm.toFixed(2)}</strong> mm
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              {t("step1Body1")}
              <br />
              <code className="bg-zinc-200 px-1">{t("step1Body2")}</code>
              <br />
              {t("step1Body3")}
            </div>
          </div>

          <div className="border-l-4 border-amber-300 pl-3">
            <div className="font-semibold text-zinc-700 mb-1">{t("step2H")}</div>
            <div className="font-mono text-zinc-800 mb-1">
              {t("step2FormulaTpl", { splay: splayMm.toFixed(2) })}{" "}
              <strong>{splayDx.toFixed(2)}</strong> mm
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              {t("step2Body1")}
              <br />
              <code className="bg-zinc-200 px-1">{t("step2Body2")}</code>
              <br />
              {t("step2Body3")}
            </div>
          </div>

          <div className="border-l-4 border-amber-300 pl-3">
            <div className="font-semibold text-zinc-700 mb-1">{t("step3H")}</div>
            <div className="font-mono text-zinc-800 mb-1">
              {t("step3FormulaTpl", { dx: splayDx.toFixed(2), h: legHeight })}{" "}
              <strong>{slope.toFixed(4)}</strong>
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              {t("step3Body1")}
              <br />
              <code className="bg-zinc-200 px-1">{t("step3Body2")}</code>
              <br />
              {t("step3Body3")}
            </div>
          </div>

          <div className="border-l-4 border-amber-400 pl-3 bg-amber-50/50 -ml-1">
            <div className="font-semibold text-zinc-700 mb-1">{t("step4H")}</div>
            <div className="font-mono text-zinc-800 mb-1">
              {t("step4FormulaTpl", { slope: slope.toFixed(4) })}{" "}
              <strong>{apronTilt.toFixed(2)}°</strong>
            </div>
            <div className="text-xs text-zinc-600 leading-relaxed">
              <code className="bg-zinc-200 px-1">{t("step4Body1prefix")}</code>
              {t("step4Body1suffix")}
              <br />
              {t("step4Body2")}
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs text-emerald-900">
            {t.rich("conclusionTpl", {
              angle,
              tilt: apronTilt.toFixed(1),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </div>
        </div>
      </details>

      <details className="border border-zinc-200 rounded-lg p-4 mb-6">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
          {t("tableSummary")}
        </summary>
        <table className="w-full mt-3 text-sm font-mono">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-500">
              <th className="text-left py-1">{t("thLegSplay")}</th>
              <th className="text-right py-1">{t("thApronTilt")}</th>
            </tr>
          </thead>
          <tbody>
            {[3, 5, 8, 10, 12, 15, 18, 20].map((a) => {
              const tilt =
                (Math.atan(Math.tan((a * Math.PI) / 180) / Math.SQRT2) * 180) /
                Math.PI;
              return (
                <tr key={a} className="border-b border-zinc-100">
                  <td className="py-1">{a}°</td>
                  <td className="text-right py-1">{tilt.toFixed(2)}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <details className="border border-zinc-200 rounded-lg p-4 text-sm text-zinc-700">
        <summary className="cursor-pointer font-semibold">{t("whySummary")}</summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>{t("whyP1")}</p>
          <p>{t("whyP2")}</p>
          <p>{t("whyP3")}</p>
          <p>{t("whyP4")}</p>
        </div>
      </details>
    </main>
  );
}

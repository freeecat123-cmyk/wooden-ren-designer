"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import {
  EMPTY_CUSTOMER,
  loadCustomerHistory,
  saveCustomer,
  type CustomerInfo,
} from "./customer";

interface Props {
  /** 初始值（來自 URL query） */
  initial: CustomerInfo;
  /** hidden input 的 prefix（對應 URL param key） */
  fieldPrefix?: string;
  /**
   * 程式呼叫 setData 時通知外層（套用歷史 chip、清空按鈕）。
   */
  onApply?: (next: CustomerInfo) => void;
}

const PREFIX_DEFAULT = "customer";

export function CustomerForm({ initial, fieldPrefix = PREFIX_DEFAULT, onApply }: Props) {
  const t = useTranslations("customerForm");
  const [data, setData] = useState<CustomerInfo>(initial);
  const [history, setHistory] = useState<CustomerInfo[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHistory(loadCustomerHistory());
    setHydrated(true);
  }, []);

  const field =
    (key: keyof CustomerInfo) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setData((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const applyHistoryByIndex = (idx: number) => {
    if (!Number.isFinite(idx) || idx < 0 || idx >= history.length) return;
    setData(history[idx]);
    onApply?.(history[idx]);
  };

  const clearAll = () => {
    setData(EMPTY_CUSTOMER);
    onApply?.(EMPTY_CUSTOMER);
  };

  const removeFromHistory = (idx: number) => {
    if (!Number.isFinite(idx) || idx < 0 || idx >= history.length) return;
    const next = history.filter((_, i) => i !== idx);
    setHistory(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "wooden-ren-designer:customers:v1",
        JSON.stringify(next),
      );
    }
  };

  const handleBlurSave = () => {
    saveCustomer(data);
  };

  const name = (key: string) => `${fieldPrefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;

  const applyTitle = (c: CustomerInfo) =>
    t("historyApplyTitleTpl", {
      name: c.name,
      phone: c.phone ? t("historyPhoneSep", { phone: c.phone }) : "",
      tax: c.taxId ? t("historyTaxSep", { tax: c.taxId }) : "",
    });

  return (
    <fieldset>
      <legend className="text-xs text-zinc-700 mb-1.5 font-medium">
        {t("legend")}
      </legend>
      {hydrated && history.length > 0 && (
        <div className="mb-3 p-2 rounded-md bg-sky-50 border border-sky-200">
          <div className="text-[10px] text-sky-700 font-medium mb-1.5">
            {t("historyHTpl", { n: history.length })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((c, i) => (
              <span
                key={i}
                className="group inline-flex items-center gap-1 text-xs bg-white border border-sky-300 rounded-full pl-3 pr-1 py-0.5 hover:bg-sky-100 hover:border-sky-500 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => applyHistoryByIndex(i)}
                  className="font-medium text-zinc-800"
                  title={applyTitle(c)}
                >
                  {c.taxId ? "🏢 " : ""}
                  {c.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeFromHistory(i)}
                  className="w-4 h-4 rounded-full text-zinc-400 hover:bg-red-100 hover:text-red-600 text-[10px] leading-none flex items-center justify-center"
                  title={t("removeTitle")}
                  aria-label={t("removeAria")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field
          label={t("fieldName")}
          name={name("Name")}
          value={data.name}
          onChange={field("name")}
          onBlur={handleBlurSave}
        />
        <Field
          label={t("fieldContact")}
          name={name("Contact")}
          value={data.contact}
          onChange={field("contact")}
          onBlur={handleBlurSave}
        />
        <Field
          label={t("fieldPhone")}
          name={name("Phone")}
          value={data.phone}
          onChange={field("phone")}
          onBlur={handleBlurSave}
        />
        <Field
          label={t("fieldAddress")}
          name={name("Address")}
          value={data.address}
          onChange={field("address")}
          onBlur={handleBlurSave}
          colSpan2
        />
        <Field
          label={t("fieldTaxId")}
          name={name("TaxId")}
          value={data.taxId}
          onChange={field("taxId")}
          onBlur={handleBlurSave}
        />
        <Field
          label={t("fieldEmail")}
          name={name("Email")}
          value={data.email}
          onChange={field("email")}
          onBlur={handleBlurSave}
          colSpan2
        />
      </div>
      <button
        type="button"
        onClick={clearAll}
        className="mt-2 text-[11px] text-zinc-700 hover:text-zinc-900 hover:underline"
      >
        {t("clear")}
      </button>
    </fieldset>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  onBlur,
  colSpan2,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  colSpan2?: boolean;
}) {
  return (
    <label className={`flex flex-col text-xs ${colSpan2 ? "md:col-span-2" : ""}`}>
      <span className="text-zinc-600 mb-1">{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-sm"
      />
    </label>
  );
}

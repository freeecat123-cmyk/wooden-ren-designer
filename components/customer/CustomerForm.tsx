"use client";

import { useEffect, useState, type ChangeEvent } from "react";
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
}

const PREFIX_DEFAULT = "customer";

export function CustomerForm({ initial, fieldPrefix = PREFIX_DEFAULT }: Props) {
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

  const applyHistory = (e: ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value);
    if (!Number.isFinite(idx) || idx < 0 || idx >= history.length) return;
    setData(history[idx]);
  };

  const clearAll = () => setData(EMPTY_CUSTOMER);

  // 表單 submit 前先把 data 存進 history（實際 submit 由外層 form 處理）
  const handleBlurSave = () => {
    saveCustomer(data);
  };

  const name = (key: string) => `${fieldPrefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;

  return (
    <fieldset>
      <legend className="text-xs text-zinc-500 mb-1.5 font-medium flex items-center justify-between">
        <span>客戶資料（報價單「客戶 TO」欄會帶入）</span>
        {hydrated && history.length > 0 && (
          <select
            onChange={applyHistory}
            className="text-xs border border-zinc-300 rounded px-2 py-0.5 bg-white"
            defaultValue=""
          >
            <option value="">↺ 套用近期客戶…</option>
            {history.map((c, i) => (
              <option key={i} value={i}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
        )}
      </legend>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Field
          label="公司 / 姓名"
          name={name("Name")}
          value={data.name}
          onChange={field("name")}
          onBlur={handleBlurSave}
        />
        <Field
          label="聯絡人"
          name={name("Contact")}
          value={data.contact}
          onChange={field("contact")}
          onBlur={handleBlurSave}
        />
        <Field
          label="電話"
          name={name("Phone")}
          value={data.phone}
          onChange={field("phone")}
          onBlur={handleBlurSave}
        />
        <Field
          label="送貨地址"
          name={name("Address")}
          value={data.address}
          onChange={field("address")}
          onBlur={handleBlurSave}
          colSpan2
        />
        <Field
          label="統一編號"
          name={name("TaxId")}
          value={data.taxId}
          onChange={field("taxId")}
          onBlur={handleBlurSave}
        />
        <Field
          label="Email"
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
        className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-800 hover:underline"
      >
        清除客戶資料
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

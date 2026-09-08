"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { designSearchKey } from "@/lib/design/navigation-pending";

function hasPendingInput(form: HTMLFormElement) {
  if (form.dataset.designBaseline) {
    const baseline = JSON.parse(form.dataset.designBaseline) as Record<string, unknown>;
    const data = new FormData(form);
    return Object.entries(baseline).some(([key, expected]) => {
      const fields = Array.from(form.elements).filter(element => "name" in element && element.name === key);
      if (!fields.some(element => !element.matches(":disabled"))) return false;
      const actual = data.get(key);
      if (typeof expected === "boolean") {
        const checkbox = fields.find(element => element instanceof HTMLInputElement && element.type === "checkbox");
        return (checkbox instanceof HTMLInputElement ? checkbox.checked : actual === "true") !== expected;
      }
      if (typeof expected === "number") return actual === null || actual === "" || Number(actual) !== expected;
      return String(actual ?? "") !== String(expected);
    });
  }
  return Array.from(form.elements).some(element => {
    if (element instanceof HTMLInputElement) {
      if (element.matches(":disabled") || element.type === "hidden" || !element.name) return false;
      return ["checkbox", "radio"].includes(element.type)
        ? element.checked !== element.defaultChecked
        : element.value !== element.defaultValue;
    }
    if (element instanceof HTMLSelectElement && !element.matches(":disabled")) {
      const defaults = Array.from(element.options).filter(option => option.defaultSelected);
      const expected = defaults.length ? defaults : [element.options[0]];
      return Array.from(element.selectedOptions).map(option => option.value).join("\0")
        !== expected.filter(Boolean).map(option => option.value).join("\0");
    }
    return element instanceof HTMLTextAreaElement && !element.matches(":disabled") && element.value !== element.defaultValue;
  });
}

/** Never let a toolbar action consume the model from before a pending form edit. */
export function StudioActionGuard({ children, locale, resolvedSearch = "" }: { children: ReactNode; locale: string; resolvedSearch?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [waiting, setWaiting] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);
  const navigationPending = navigationTarget !== null && navigationTarget !== designSearchKey(resolvedSearch);
  useEffect(() => {
    if (navigationTarget === designSearchKey(resolvedSearch)) setNavigationTarget(null);
  }, [navigationTarget, resolvedSearch]);
  useEffect(() => {
    const changed = (event: Event) => setNavigationTarget((event as CustomEvent<{ search: string }>).detail.search);
    window.addEventListener("wooden-ren:design-navigation", changed);
    return () => window.removeEventListener("wooden-ren:design-navigation", changed);
  }, []);
  return <div ref={root} onClickCapture={event => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-studio-output], [data-studio-persistence]")) return;
    const form = root.current?.querySelector<HTMLFormElement>("form[data-design-form]");
    if (!navigationPending && (!form || !hasPendingInput(form))) { setWaiting(false); return; }
    event.preventDefault();
    event.stopPropagation();
    setWaiting(true);
    if (!navigationPending && form?.reportValidity()) form.dispatchEvent(new Event("wooden-ren:flush-design", { bubbles: true }));
  }}>
    {waiting && <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      {locale === "en" ? "Apply the parameter changes before saving or exporting. Once the model updates, try again." : "請先完成參數更新；模型更新後，再按一次儲存或匯出。"}
    </p>}
    {children}
  </div>;
}

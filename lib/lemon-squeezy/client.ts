/**
 * Lemon Squeezy REST API client
 * 對外露出最小幾個 method（建 checkout / 查 sub），其他直接 fetch。
 */

import { LEMONSQUEEZY_API_BASE, LEMONSQUEEZY_API_KEY } from "./config";

export class LemonSqueezyError extends Error {
  constructor(
    public status: number,
    public body: string,
    message?: string,
  ) {
    super(message ?? `LS API ${status}`);
  }
}

async function lsRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${LEMONSQUEEZY_API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${LEMONSQUEEZY_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new LemonSqueezyError(res.status, body);
  }
  return (await res.json()) as T;
}

export const lemonSqueezy = {
  get: <T = unknown>(path: string) => lsRequest<T>(path, { method: "GET" }),
  post: <T = unknown>(path: string, body: unknown) =>
    lsRequest<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body: unknown) =>
    lsRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = unknown>(path: string) =>
    lsRequest<T>(path, { method: "DELETE" }),
};

import { createClient } from "@/lib/supabase/server";
import { ShareError } from "./service";

export const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function shareResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer",
  } });
}
export function shareFailure(error: unknown) {
  return error instanceof ShareError ? shareResponse({ error: error.code }, error.status) : shareResponse({ error: "sharing_unavailable" }, 503);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ShareError(403, "invalid_origin");
  }
}
export async function shareOwner() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new ShareError(401, "unauthenticated");
  return user.id;
}
export async function creationBody(request: Request): Promise<{ designId: string; expectedUpdatedAt: string }> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ShareError(400, "invalid_body");
  const reader = request.body?.getReader();
  if (!reader) throw new ShareError(400, "invalid_body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new ShareError(413, "body_too_large"); }
    chunks.push(value);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ShareError(400, "invalid_json"); }
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !["designId", "expectedUpdatedAt"].includes(key)) ||
    !uuid(body.designId) || typeof body.expectedUpdatedAt !== "string" || body.expectedUpdatedAt.length > 64 || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
    throw new ShareError(400, "invalid_body");
  }
  return body;
}

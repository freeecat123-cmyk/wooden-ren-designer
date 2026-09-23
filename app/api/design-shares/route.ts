import { createPublication, ShareError } from "@/lib/design-sharing/service";
import { createShareStore, listOwnedPublications } from "@/lib/design-sharing/store";
import { creationBody, sameOrigin, shareFailure, shareOwner, shareResponse, uuid } from "@/lib/design-sharing/http";
import { checkIpRateLimit } from "@/lib/api/ip-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const owner = await shareOwner();
    const body = await creationBody(request);
    const limit = await checkIpRateLimit({ prefix: "design-share-owner", ip: owner, perDay: 30 });
    if (!limit.ok) return shareResponse({ error: "rate_limited" }, 429);
    const publication = await createPublication(createShareStore(), owner, body.designId, body.expectedUpdatedAt);
    return shareResponse({ ...publication, url: `/shared-design/${publication.token}` }, 201);
  } catch (error) { return shareFailure(error); }
}
export async function GET(request: Request) {
  try {
    const owner = await shareOwner();
    const id = new URL(request.url).searchParams.get("designId");
    if (!uuid(id)) throw new ShareError(400, "invalid_id");
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new ShareError(400, "invalid_offset");
    return shareResponse(await listOwnedPublications(owner, id, offset));
  } catch (error) { return shareFailure(error); }
}

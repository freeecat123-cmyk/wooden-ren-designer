import { resolvePublication, revokePublication } from "@/lib/design-sharing/service";
import { createShareStore } from "@/lib/design-sharing/store";
import { sameOrigin, shareFailure, shareOwner, shareResponse } from "@/lib/design-sharing/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, context: Context) {
  try { return shareResponse(await resolvePublication(createShareStore(), (await context.params).token)); }
  catch (error) { return shareFailure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const owner = await shareOwner();
    await revokePublication(createShareStore(), owner, (await context.params).token);
    return shareResponse({ ok: true });
  } catch (error) { return shareFailure(error); }
}

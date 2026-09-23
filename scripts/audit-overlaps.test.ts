import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("fails for a new collision inside a historically exempt furniture variant", () => {
  let result: { status?: number; stderr?: Buffer } | undefined;
  try {
    execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/audit-overlaps.ts", "--inject-collision"], { stdio: "pipe" });
  } catch (error) { result = error as typeof result; }
  expect(result?.status).toBe(1);
  expect(result?.stderr?.toString()).toContain("top × audit-injected-duplicate: new pair");
}, 20_000);

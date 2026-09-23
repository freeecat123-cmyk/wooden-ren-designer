/**
 * Locale-aware navigation primitives — use these instead of `next/link`,
 * `next/navigation`'s redirect/router in client/server components when you
 * want links to inherit the current locale.
 *
 * Phase 2 onwards: replace `import Link from "next/link"` with
 * `import { Link } from "@/i18n/navigation"`.
 */
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

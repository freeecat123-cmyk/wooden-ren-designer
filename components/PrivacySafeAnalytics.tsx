"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const sharedPath = /^\/(?:[^/]+\/)?shared-design(?:\/|$)/;

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    // Check both the queued event URL and the current route after client navigation.
    const pathname = new URL(event.url, window.location.origin).pathname;
    if (sharedPath.test(decodeURIComponent(pathname)) || sharedPath.test(decodeURIComponent(window.location.pathname))) return null;
    return event;
  } catch {
    return null;
  }
}

export function PrivacySafeAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}

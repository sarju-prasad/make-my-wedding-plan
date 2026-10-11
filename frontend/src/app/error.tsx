"use client";

import { useEffect } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";

/**
 * App Router's catch-all error boundary — without this, an uncaught render
 * error (e.g. formatWeddingDate() hitting a timezone its own browser's Intl
 * can't construct, before that was guarded) crashed straight to Next's
 * default unstyled error screen instead of anything resembling this app.
 * Must be "use client" (Next.js requirement for error.tsx) and sits above
 * every route this app has, so it can't assume any page-specific layout or
 * data is available — just the shared AuthLayout card shell.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No client-side error-reporting pipeline exists yet — this is the only
    // visibility into a crash a real user actually hit.
    console.error(error);
  }, [error]);

  return (
    <AuthLayout title="Something went wrong">
      <div className="flex flex-col items-center gap-space-md text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">
          An unexpected error occurred. Trying again usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
        >
          Try again
        </button>
      </div>
    </AuthLayout>
  );
}

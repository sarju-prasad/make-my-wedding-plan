"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/marketing/Icon";
import { logoutUser, type User } from "@/lib/api";

/**
 * Shared by every post-auth page (`/weddings`, `/weddings/[weddingId]`, and
 * future ones) so sign-out behavior and the logo/user-controls layout can't
 * drift between pages. `weddingContext`, when given, renders as a breadcrumb
 * next to the logo (e.g. the couple's names on the wedding overview page).
 * `showSearch` renders the search field from the approved design — disabled,
 * since no search feature exists yet; a placeholder that looked live would
 * be a fake affordance, not an honest "coming soon" state.
 *
 * A page with a fixed left sidebar (see WeddingSidebar) is responsible for
 * its own `lg:pl-72` offset on a wrapper around both this header and its
 * main content — not this component, since it isn't `fixed` and its normal
 * padding already composes correctly once that wrapper shifts it right.
 */
export function AppHeader({
  user,
  weddingContext,
  showSearch = false,
}: {
  user: User | null;
  weddingContext?: string;
  showSearch?: boolean;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await logoutUser().catch(() => undefined);
    router.push("/");
  }

  return (
    <header className="flex items-center justify-between gap-space-md border-b border-surface-container-high px-margin-mobile py-space-md lg:px-margin">
      <div className="flex min-w-0 items-center gap-space-md">
        <Link href="/weddings" className="flex shrink-0 items-center gap-space-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="font-headline-sm text-[15px] leading-none font-bold text-on-primary">
              M
            </span>
          </div>
          <span className="font-headline-sm text-headline-sm tracking-tight text-primary hidden sm:inline">
            Make My Wedding Plan
          </span>
        </Link>
        {weddingContext && (
          <>
            <span className="hidden text-on-surface-variant sm:inline">/</span>
            <span className="font-label-lg text-label-lg truncate text-on-surface">
              {weddingContext}
            </span>
          </>
        )}
      </div>
      {showSearch && (
        <div className="hidden max-w-md flex-1 md:flex">
          <div className="relative w-full">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] text-outline"
            />
            <input
              type="text"
              disabled
              placeholder="Search guests, vendors, timeline runs…"
              aria-label="Search (coming soon)"
              title="Coming soon"
              className="font-body-sm text-body-sm w-full cursor-not-allowed rounded-xl bg-surface-container-low py-2 pr-space-md pl-10 text-on-surface placeholder:text-outline"
            />
          </div>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-space-md">
        {user && (
          <span className="font-body-sm text-body-sm hidden text-on-surface-variant sm:inline">
            Signed in as {user.name}
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="rounded-lg bg-surface-container-high px-space-md py-space-sm font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

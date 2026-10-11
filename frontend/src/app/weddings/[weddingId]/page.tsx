"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { RetryNotice } from "@/components/layout/RetryNotice";
import { WeddingSidebar } from "@/components/layout/WeddingSidebar";
import { Icon } from "@/components/marketing/Icon";
import { EventsPreview } from "@/components/wedding/EventsPreview";
import { MembersSection } from "@/components/wedding/MembersSection";
import {
  ApiError,
  getCurrentUser,
  getWedding,
  toErrorMessage,
  type User,
  type Wedding,
} from "@/lib/api";
import { countdownLabel, daysUntilWedding, formatWeddingDate } from "@/lib/date";

interface QuickAction {
  key: string;
  label: string;
  icon: string;
}

// None of these modules exist yet (see doc/project_status.md) — every quick
// action surfaces a "coming soon" state instead of linking anywhere, per this
// task's explicit scope limit. Events has its own real section below instead
// of a "coming soon" entry here now that it's built.
const QUICK_ACTIONS: QuickAction[] = [
  { key: "guests", label: "Guests", icon: "group" },
  { key: "tasks", label: "Tasks", icon: "checklist" },
  { key: "vendors", label: "Vendors", icon: "storefront" },
  { key: "expenses", label: "Expenses", icon: "account_balance_wallet" },
  { key: "website", label: "Wedding Website", icon: "language" },
];

function ComingSoonButton({
  icon,
  label,
  className = "",
}: {
  icon: string;
  label: string;
  className?: string;
}) {
  const [announced, setAnnounced] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setAnnounced(true)}
      className={`flex flex-col items-center gap-1 rounded-xl bg-surface-container-lowest p-space-md text-center shadow-sm transition-all hover:bg-surface-container-high ${className}`}
    >
      <Icon name={icon} className="text-[24px] text-on-surface-variant" />
      <span className="font-label-sm text-label-sm font-medium text-on-surface">{label}</span>
      <span className="font-label-sm text-label-sm text-primary" role="status">
        {announced ? "Coming soon" : ""}
      </span>
    </button>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl animate-pulse flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin">
      <div className="h-36 rounded-2xl bg-surface-container-lowest shadow-sm" />
      <div className="h-28 rounded-xl bg-surface-container-lowest shadow-sm" />
      <div className="h-40 rounded-xl bg-surface-container-lowest shadow-sm" />
      <div className="grid grid-cols-3 gap-space-md sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-container-lowest shadow-sm" />
        ))}
      </div>
    </div>
  );
}

export default function WeddingOverviewPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ weddingId: string }>();
  const weddingId = params.weddingId;

  const [user, setUser] = useState<User | null>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Re-runs whenever `weddingId` changes (e.g. switching weddings via
      // WeddingSidebar, which Next.js serves from the same mounted component
      // instance rather than remounting) — without resetting these first,
      // the previous wedding's details would stay rendered as if they were
      // the new one's until the fetch resolves, with no loading state to
      // show in between. Same fix as edit/page.tsx's own load().
      setLoading(true);
      setLoadError(null);
      setWedding(null);
      setUser(null);
      try {
        const [{ user: currentUser }, { wedding: currentWedding }] = await Promise.all([
          getCurrentUser(),
          getWedding(weddingId),
        ]);
        if (cancelled) return;
        setUser(currentUser);
        setWedding(currentWedding);
      } catch (err) {
        if (cancelled) return;
        // Only an actually-unauthenticated session bounces to sign-in — a
        // missing/forbidden/malformed wedding id, or a transient server
        // error, shows the retry state below instead (see weddings/page.tsx
        // for the same reasoning).
        if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
          router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setLoadError(toErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, weddingId, reloadCount]);

  const weddingContext = wedding
    ? `${wedding.couple.partnerOneName} & ${wedding.couple.partnerTwoName}`
    : undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <WeddingSidebar weddingId={weddingId} />
        <div className="lg:pl-72">
          <AppHeader user={user} weddingContext={weddingContext} showSearch />
          <OverviewSkeleton />
        </div>
      </div>
    );
  }

  if (loadError || !wedding) {
    return (
      <div className="min-h-screen bg-surface">
        <WeddingSidebar weddingId={weddingId} />
        <div className="lg:pl-72">
          <AppHeader user={user} weddingContext={weddingContext} showSearch />
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-margin-mobile">
            <RetryNotice
              message={loadError ?? "Unable to load your wedding."}
              onRetry={() => {
                setLoading(true);
                setReloadCount((n) => n + 1);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const days = daysUntilWedding(wedding.weddingDate, wedding.timezone);

  return (
    <div className="min-h-screen bg-surface">
      <WeddingSidebar weddingId={weddingId} />
      <div className="lg:pl-72">
        <AppHeader user={user} weddingContext={weddingContext} showSearch />

        <main className="mx-auto flex max-w-5xl flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin">
          <section className="rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm lg:p-space-xl">
            <div className="flex flex-col gap-space-md md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-space-xs">
                <div className="flex flex-wrap items-center gap-space-sm">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">
                    {wedding.couple.partnerOneName} &amp; {wedding.couple.partnerTwoName}
                  </h1>
                  {days !== null && (
                    <span className="rounded-full bg-secondary-fixed px-space-md py-1 font-label-sm text-label-sm font-bold tracking-wide text-on-secondary-fixed uppercase">
                      {countdownLabel(days)}
                    </span>
                  )}
                </div>
                <p className="font-body-lg text-body-lg text-on-surface-variant">{wedding.name}</p>
                <p className="font-body-md text-body-md flex flex-wrap items-center gap-2 text-on-surface-variant">
                  <Icon name="calendar_month" className="text-[18px] text-outline" />
                  <span>{formatWeddingDate(wedding.weddingDate, wedding.timezone)}</span>
                  <span className="text-outline">&middot;</span>
                  <Icon name="location_on" className="text-[18px] text-outline" />
                  <span>{wedding.location.address}</span>
                </p>
                {wedding.description && (
                  <p className="font-body-md text-body-md mt-space-xs text-on-surface-variant">
                    {wedding.description}
                  </p>
                )}
              </div>
              <Link
                href={`/weddings/${weddingId}/edit`}
                className="group inline-flex shrink-0 items-center gap-2.5 self-start rounded-lg bg-primary px-space-lg py-2.5 font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:bg-primary-container hover:shadow-lg"
              >
                <Icon
                  name="edit_calendar"
                  className="text-[19px] transition-transform group-hover:rotate-12"
                />
                <span>Edit Wedding</span>
              </Link>
            </div>
          </section>

          <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <h2 className="font-headline-sm text-headline-sm mb-space-md text-on-surface">
              Wedding details
            </h2>
            <dl className="grid grid-cols-1 gap-space-md sm:grid-cols-3">
              <div>
                <dt className="font-label-sm text-label-sm text-outline uppercase">Date</dt>
                <dd className="font-body-md text-body-md text-on-surface">
                  {formatWeddingDate(wedding.weddingDate, wedding.timezone)}
                </dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-outline uppercase">Venue</dt>
                <dd className="font-body-md text-body-md text-on-surface">
                  {wedding.location.address}
                </dd>
              </div>
              <div>
                <dt className="font-label-sm text-label-sm text-outline uppercase">Timezone</dt>
                <dd className="font-body-md text-body-md text-on-surface">{wedding.timezone}</dd>
              </div>
            </dl>
          </section>

          {user && <MembersSection weddingId={weddingId} currentUserId={user.id} />}

          <EventsPreview weddingId={weddingId} />

          <section className="flex flex-col gap-space-md">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Quick actions</h2>
            <div className="grid grid-cols-3 gap-space-md sm:grid-cols-6">
              {QUICK_ACTIONS.map((action) => (
                <ComingSoonButton key={action.key} icon={action.icon} label={action.label} />
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

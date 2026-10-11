"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { RetryNotice } from "@/components/layout/RetryNotice";
import { WeddingSidebar } from "@/components/layout/WeddingSidebar";
import { Icon } from "@/components/marketing/Icon";
import { EventStatusBadge } from "@/components/wedding/EventStatusBadge";
import {
  ApiError,
  getCurrentUser,
  getWedding,
  getEvents,
  toErrorMessage,
  type User,
  type Wedding,
  type WeddingEvent,
} from "@/lib/api";
import { formatEventDateParts, formatEventTimeRange } from "@/lib/date";

function EventCard({ weddingId, event }: { weddingId: string; event: WeddingEvent }) {
  const dateParts = formatEventDateParts(event.startsAt, event.timezone);
  const timeRange = formatEventTimeRange(event.startsAt, event.endsAt, event.timezone);
  const venueLabel = [event.venue?.name, event.venue?.address].filter(Boolean).join(", ");

  return (
    <Link
      href={`/weddings/${weddingId}/events/${event.id}`}
      className="group flex flex-col items-start gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-sm transition-all hover:bg-surface-container-low/40 hover:shadow-md md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-space-lg sm:flex-row sm:items-center">
        {dateParts && (
          <div className="flex h-18 min-w-[90px] shrink-0 flex-col items-center justify-center rounded-lg bg-surface-container px-space-md text-center">
            <span className="font-label-sm text-label-sm font-bold tracking-wider text-primary uppercase">
              {dateParts.monthDay}
            </span>
            <span className="font-headline-md text-headline-md leading-none font-semibold text-on-surface">
              {dateParts.weekday}
            </span>
            <span className="hidden text-[10px] tracking-wider text-on-surface-variant uppercase sm:block">
              {dateParts.year}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface transition-colors group-hover:text-primary">
              {event.name}
            </h2>
            <EventStatusBadge status={event.status} />
          </div>
          <div className="font-body-sm text-body-sm flex flex-wrap items-center gap-x-space-md gap-y-1 text-on-surface-variant">
            {timeRange && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="schedule" className="text-[16px] text-secondary" />
                {timeRange} · {event.timezone}
              </span>
            )}
            {venueLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="location_on" className="text-[16px] text-primary" />
                {venueLabel}
              </span>
            )}
          </div>
          {event.description && (
            <p className="font-body-md text-body-md line-clamp-1 max-w-3xl text-on-surface-variant">
              {event.description}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 self-end md:self-center">
        <span className="font-label-lg text-label-lg inline-flex items-center gap-1 text-primary transition-all group-hover:translate-x-0.5">
          View Details
          <Icon name="arrow_forward" className="text-[18px]" />
        </span>
      </div>
    </Link>
  );
}

export default function EventsListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ weddingId: string }>();
  const weddingId = params.weddingId;

  const [user, setUser] = useState<User | null>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [events, setEvents] = useState<WeddingEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [{ user: currentUser }, { wedding: currentWedding }, { items }] = await Promise.all([
          getCurrentUser(),
          getWedding(weddingId),
          getEvents(weddingId, 100),
        ]);
        if (cancelled) return;
        setUser(currentUser);
        setWedding(currentWedding);
        setEvents(items);
      } catch (err) {
        if (cancelled) return;
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

  return (
    <div className="min-h-screen bg-surface">
      <WeddingSidebar weddingId={weddingId} />
      <div className="lg:pl-72">
        <AppHeader user={user} weddingContext={weddingContext} />

        {loading && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="font-body-md text-body-md text-on-surface-variant">Loading events…</p>
          </div>
        )}

        {!loading && (loadError || !events) && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-margin-mobile">
            <RetryNotice
              message={loadError ?? "Unable to load events."}
              onRetry={() => setReloadCount((n) => n + 1)}
            />
          </div>
        )}

        {!loading && events && !loadError && (
          <main className="mx-auto flex max-w-5xl flex-col gap-space-lg px-margin-mobile py-space-xl lg:px-margin">
            <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs">
              <Link
                href={`/weddings/${weddingId}`}
                className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary"
              >
                Wedding Overview
              </Link>
              <Icon name="chevron_right" className="text-[16px] text-outline" />
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                Events
              </span>
            </nav>

            <div className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
                  Events
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Plan and manage all the important moments of your wedding.
                </p>
              </div>
              <Link
                href={`/weddings/${weddingId}/events/new`}
                className="inline-flex shrink-0 items-center justify-center gap-space-xs self-start rounded-lg bg-primary-container px-space-lg py-2.5 font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-secondary"
              >
                <Icon name="add" className="text-[18px]" />
                <span>Add Event</span>
              </Link>
            </div>

            {events.length === 0 ? (
              <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-space-md rounded-2xl bg-surface-container-lowest px-6 py-20 text-center shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-primary">
                  <Icon name="event_available" className="text-[32px]" />
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  No events planned yet
                </h2>
                <p className="font-body-md text-body-md max-w-md text-on-surface-variant">
                  Start organizing your wedding celebrations by adding your first event. You&apos;ll
                  be able to manage time, venues, and run-of-show details.
                </p>
                <Link
                  href={`/weddings/${weddingId}/events/new`}
                  className="inline-flex items-center gap-space-xs rounded-lg bg-primary-container px-space-lg py-2.5 font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-secondary"
                >
                  <Icon name="add_circle" className="text-[18px]" />
                  <span>Add Your First Event</span>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-space-md">
                {events.map((event) => (
                  <EventCard key={event.id} weddingId={weddingId} event={event} />
                ))}
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

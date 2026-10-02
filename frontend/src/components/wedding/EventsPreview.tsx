"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/marketing/Icon";
import { getEvents, toErrorMessage, type WeddingEvent } from "@/lib/api";
import { formatEventDateParts } from "@/lib/date";

// A compact preview, not the full list — enough to show what's coming up and
// invite drilling into /events for the rest, same role MembersSection plays
// for the Members feature on this same page.
const PREVIEW_LIMIT = 4;

function MiniEventCard({ weddingId, event }: { weddingId: string; event: WeddingEvent }) {
  const dateParts = formatEventDateParts(event.startsAt, event.timezone);
  const venueLabel = event.venue?.name ?? event.venue?.address;

  return (
    <Link
      href={`/weddings/${weddingId}/events/${event.id}`}
      className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-md transition-all hover:bg-surface-container"
    >
      {dateParts && (
        <span className="font-label-sm text-label-sm font-bold text-primary uppercase">
          {dateParts.monthDay}
        </span>
      )}
      <p className="font-headline-sm text-headline-sm truncate text-on-surface">{event.name}</p>
      {venueLabel && (
        <p className="font-body-sm text-body-sm truncate text-on-surface-variant">{venueLabel}</p>
      )}
    </Link>
  );
}

export function EventsPreview({ weddingId }: { weddingId: string }) {
  // Upcoming events to preview — not just the chronologically-first ones
  // overall, which would show stale past ceremonies once a wedding has more
  // already-occurred events than fit in the preview.
  const [events, setEvents] = useState<WeddingEvent[] | null>(null);
  const [hasAnyEvents, setHasAnyEvents] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadError(null);
      try {
        // No "upcoming only" filter exists on the backend yet, and a wedding
        // realistically has few enough events that fetching the real page-
        // size ceiling and filtering here is cheap (same precedent as the
        // full Events list page's own getEvents(weddingId, 100) call).
        const { items, pagination } = await getEvents(weddingId, 100);
        if (cancelled) return;
        const now = Date.now();
        const upcoming = items
          .filter((event) => new Date(event.startsAt).getTime() >= now)
          .slice(0, PREVIEW_LIMIT);
        setEvents(upcoming);
        setHasAnyEvents(items.length > 0);
        setTotalItems(pagination.totalItems);
      } catch (err) {
        if (!cancelled) setLoadError(toErrorMessage(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [weddingId, reloadCount]);

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="mb-space-md flex items-center justify-between gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Events</h2>
        <div className="flex shrink-0 items-center gap-space-md">
          {hasAnyEvents && (
            <Link
              href={`/weddings/${weddingId}/events`}
              className="font-label-md text-label-md text-primary hover:underline"
            >
              View all events ({totalItems})
            </Link>
          )}
          <Link
            href={`/weddings/${weddingId}/events/new`}
            className="font-label-sm text-label-sm rounded-lg bg-primary-container px-space-md py-1.5 text-on-primary shadow-sm transition-all hover:bg-primary"
          >
            + Add Event
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col items-start gap-space-sm">
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setEvents(null);
              setReloadCount((n) => n + 1);
            }}
            className="font-label-sm text-label-sm rounded-lg bg-surface-container-high px-space-md py-1.5 text-on-surface transition-all hover:bg-surface-container"
          >
            Try again
          </button>
        </div>
      )}

      {!loadError && !events && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Loading events…</p>
      )}

      {!loadError && events && events.length === 0 && !hasAnyEvents && (
        <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low text-primary">
            <Icon name="event_available" className="text-[28px]" />
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">No events added yet</h3>
          <p className="font-body-sm text-body-sm max-w-md text-on-surface-variant">
            Schedule your wedding&apos;s ceremonies — Haldi, Mehndi, the wedding day, reception, and
            more.
          </p>
          <Link
            href={`/weddings/${weddingId}/events/new`}
            className="rounded-lg bg-surface-container-lowest px-space-md py-space-sm font-label-lg text-label-lg text-on-surface shadow-sm transition-all hover:bg-surface-container-high"
          >
            + Add your first event
          </Link>
        </div>
      )}

      {!loadError && events && events.length === 0 && hasAnyEvents && (
        <p className="font-body-sm text-body-sm py-space-lg text-center text-on-surface-variant">
          No upcoming events — every planned event has already passed.
        </p>
      )}

      {!loadError && events && events.length > 0 && (
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
          {events.map((event) => (
            <MiniEventCard key={event.id} weddingId={weddingId} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

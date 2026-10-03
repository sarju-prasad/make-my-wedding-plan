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
  getEvent,
  getWedding,
  toErrorMessage,
  type User,
  type Wedding,
  type WeddingEvent,
} from "@/lib/api";
import {
  countdownLabel,
  daysUntilWedding,
  formatEventDateParts,
  formatEventTimeRange,
} from "@/lib/date";

export default function EventDetailsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ weddingId: string; eventId: string }>();
  const weddingId = params.weddingId;
  const eventId = params.eventId;

  const [user, setUser] = useState<User | null>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [{ user: currentUser }, { wedding: currentWedding }, { event: currentEvent }] =
          await Promise.all([
            getCurrentUser(),
            getWedding(weddingId),
            getEvent(weddingId, eventId),
          ]);
        if (cancelled) return;
        setUser(currentUser);
        setWedding(currentWedding);
        setEvent(currentEvent);
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
  }, [router, pathname, weddingId, eventId, reloadCount]);

  const weddingContext = wedding
    ? `${wedding.couple.partnerOneName} & ${wedding.couple.partnerTwoName}`
    : undefined;

  const dateParts = event ? formatEventDateParts(event.startsAt, event.timezone) : null;
  const timeRange = event ? formatEventTimeRange(event.startsAt, event.endsAt, event.timezone) : "";
  const countdownDays = event ? daysUntilWedding(event.startsAt, event.timezone) : null;
  const hasVenue = event ? Boolean(event.venue?.name || event.venue?.address) : false;

  return (
    <div className="min-h-screen bg-surface">
      <WeddingSidebar weddingId={weddingId} />
      <div className="lg:pl-72">
        <AppHeader user={user} weddingContext={weddingContext} />

        {loading && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="font-body-md text-body-md text-on-surface-variant">Loading event…</p>
          </div>
        )}

        {!loading && (loadError || !event) && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-margin-mobile">
            <RetryNotice
              message={loadError ?? "Unable to load this event."}
              onRetry={() => setReloadCount((n) => n + 1)}
            />
          </div>
        )}

        {!loading && event && !loadError && (
          <main className="mx-auto flex max-w-5xl flex-col gap-space-lg px-margin-mobile py-space-xl lg:px-margin">
            <div className="flex flex-col gap-space-sm">
              <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs">
                <Link
                  href={`/weddings/${weddingId}`}
                  className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary"
                >
                  Wedding Overview
                </Link>
                <Icon name="chevron_right" className="text-[16px] text-outline" />
                <Link
                  href={`/weddings/${weddingId}/events`}
                  className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary"
                >
                  Events
                </Link>
                <Icon name="chevron_right" className="text-[16px] text-outline" />
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {event.name}
                </span>
              </nav>
              <Link
                href={`/weddings/${weddingId}/events`}
                className="font-label-sm text-label-sm inline-flex items-center gap-1 self-start text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <Icon name="arrow_back" className="text-[16px]" />
                <span>Back to Events List</span>
              </Link>
            </div>

            <div className="flex items-center gap-space-sm">
              <h1 className="font-headline-lg text-headline-lg text-on-surface">{event.name}</h1>
              <EventStatusBadge status={event.status} className="px-3 py-1" />
            </div>

            <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
              <div className="flex flex-col gap-space-lg lg:col-span-8">
                {event.description && (
                  <article className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                    <h2 className="font-headline-sm text-headline-sm flex items-center gap-space-xs text-on-surface">
                      <Icon name="auto_stories" className="text-[20px] text-primary" />
                      <span>Overview</span>
                    </h2>
                    <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant">
                      {event.description}
                    </p>
                  </article>
                )}

                <article className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="font-headline-sm text-headline-sm flex items-center gap-space-xs text-on-surface">
                      <Icon name="calendar_today" className="text-[20px] text-secondary" />
                      <span>Date &amp; Schedule</span>
                    </h2>
                    {countdownDays !== null && (
                      <span className="font-label-sm text-label-sm font-bold text-primary">
                        {countdownLabel(countdownDays)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-space-md rounded-lg bg-surface p-space-md sm:grid-cols-3">
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Date
                      </p>
                      <p className="font-body-lg text-body-lg mt-0.5 font-semibold text-on-surface">
                        {dateParts
                          ? `${dateParts.weekday}, ${dateParts.monthDay}, ${dateParts.year}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Time
                      </p>
                      <p className="font-body-lg text-body-lg mt-0.5 font-semibold text-on-surface">
                        {timeRange || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Timezone
                      </p>
                      <p className="font-body-lg text-body-lg mt-0.5 font-semibold text-on-surface">
                        {event.timezone}
                      </p>
                    </div>
                  </div>
                </article>

                {hasVenue && (
                  <article className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                    <h2 className="font-headline-sm text-headline-sm flex items-center gap-space-xs text-on-surface">
                      <Icon name="pin_drop" className="text-[20px] text-primary" />
                      <span>Venue</span>
                    </h2>
                    {event.venue?.name && (
                      <p className="font-headline-sm text-headline-sm text-on-surface">
                        {event.venue.name}
                      </p>
                    )}
                    {event.venue?.address && (
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {event.venue.address}
                      </p>
                    )}
                    {event.venue?.googleMapsUrl && (
                      <a
                        href={event.venue.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-label-md text-label-md inline-flex w-fit items-center gap-1 text-primary hover:underline"
                      >
                        <Icon name="map" className="text-[16px]" />
                        <span>Open in Google Maps</span>
                      </a>
                    )}
                  </article>
                )}
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

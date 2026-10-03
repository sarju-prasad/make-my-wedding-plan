"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { TextField } from "@/components/auth/TextField";
import { AppHeader } from "@/components/layout/AppHeader";
import { RetryNotice } from "@/components/layout/RetryNotice";
import { WeddingSidebar } from "@/components/layout/WeddingSidebar";
import { Icon } from "@/components/marketing/Icon";
import {
  ApiError,
  createEvent,
  getCurrentUser,
  getWedding,
  mapValidationError,
  toErrorMessage,
  type User,
  type Wedding,
} from "@/lib/api";
import { addDays, combineDateTimeWithOffset } from "@/lib/date";

interface EventFormState {
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
}

// Maps the backend's dotted Zod issue paths (error-mappers.ts's
// formatZodIssues) to this form's flat field keys.
const FIELD_PATH_MAP: Record<string, string> = {
  name: "name",
  description: "description",
  startsAt: "date",
  endsAt: "endTime",
  timezone: "timezone",
  "venue.name": "venueName",
  "venue.address": "venueAddress",
};

export default function CreateEventPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ weddingId: string }>();
  const weddingId = params.weddingId;

  const [user, setUser] = useState<User | null>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<EventFormState>({
    name: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    timezone: "",
    venueName: "",
    venueAddress: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [{ user: currentUser }, { wedding: currentWedding }] = await Promise.all([
          getCurrentUser(),
          getWedding(weddingId),
        ]);
        if (cancelled) return;
        setUser(currentUser);
        setWedding(currentWedding);
        // The wedding's own timezone is a sensible default for a new event —
        // most ceremonies happen at (or near) the main venue — but it's just
        // a starting point: each event has its own independent `timezone`
        // field, since a destination-wedding couple might host one ceremony
        // somewhere else entirely.
        setForm((prev) => ({ ...prev, timezone: currentWedding.timezone }));
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
  }, [router, pathname, weddingId]);

  function updateField<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setFieldErrors({});

    const startsAt = combineDateTimeWithOffset(form.date, form.startTime, form.timezone);
    if (!startsAt) {
      setFieldErrors({ timezone: "Enter a valid IANA timezone, e.g. Asia/Kolkata." });
      return;
    }

    let endsAt: string | undefined;
    if (form.endTime) {
      endsAt = combineDateTimeWithOffset(form.date, form.endTime, form.timezone) ?? undefined;
      // There's no separate end-date field, so an end time that's numerically
      // earlier than the start time (e.g. start 10 PM, end 1 AM) means an
      // ordinary overnight event, not an invalid one — roll it to the next
      // calendar day instead of rejecting a perfectly normal reception/
      // Sangeet time range the backend itself has no same-day requirement for.
      if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        endsAt =
          combineDateTimeWithOffset(addDays(form.date, 1), form.endTime, form.timezone) ??
          undefined;
      }
    }

    const venueName = form.venueName.trim();
    const venueAddress = form.venueAddress.trim();
    const venue =
      venueName || venueAddress
        ? {
            ...(venueName ? { name: venueName } : {}),
            ...(venueAddress ? { address: venueAddress } : {}),
          }
        : undefined;
    const description = form.description.trim();

    setSubmitting(true);
    try {
      await createEvent(weddingId, {
        name: form.name,
        startsAt,
        ...(endsAt ? { endsAt } : {}),
        timezone: form.timezone,
        ...(description ? { description } : {}),
        ...(venue ? { venue } : {}),
      });
      // The events list re-fetches on every mount, same redirect-then-refetch
      // pattern as create-wedding and Edit Wedding — the new event shows up
      // without any shared/cached state to update here.
      router.push(`/weddings/${weddingId}/events`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const { fieldErrors: fe, message } = mapValidationError(err, FIELD_PATH_MAP);
      setFieldErrors(fe);
      setError(message);
      setSubmitting(false);
    }
  }

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
            <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>
          </div>
        )}

        {!loading && loadError && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-margin-mobile">
            <RetryNotice message={loadError} onRetry={() => window.location.reload()} />
          </div>
        )}

        {!loading && !loadError && (
          <main className="mx-auto max-w-3xl px-margin-mobile py-space-xl lg:px-margin">
            <nav aria-label="Breadcrumb" className="mb-space-sm flex items-center gap-space-xs">
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
                Add Event
              </span>
            </nav>

            <div className="mb-space-lg flex flex-col gap-space-xs">
              <h1 className="font-headline-xl text-headline-xl tracking-tight text-on-surface">
                Add Wedding Event
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Add an event to your wedding schedule with accurate ceremony details.
              </p>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-space-xl">
              <fieldset className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <legend className="font-label-sm text-label-sm mb-1 flex items-center gap-space-xs uppercase tracking-wider text-primary">
                  <span>1. Event Details</span>
                </legend>
                <TextField
                  label="Event name"
                  name="name"
                  value={form.name}
                  onChange={(v) => updateField("name", v)}
                  required
                  disabled={submitting}
                  error={fieldErrors.name}
                  placeholder="e.g. Sangeet Night, Mehendi Soirée"
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="description"
                      className="font-label-lg text-label-lg text-on-surface"
                    >
                      Description{" "}
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        (optional)
                      </span>
                    </label>
                    <span className="font-label-sm text-label-sm text-outline">
                      {form.description.length} / 2000 characters
                    </span>
                  </div>
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    maxLength={2000}
                    rows={3}
                    disabled={submitting}
                    placeholder="Describe the celebration, dress code notes, or run of show…"
                    aria-invalid={fieldErrors.description ? true : undefined}
                    aria-describedby={fieldErrors.description ? "description-error" : undefined}
                    className={`w-full resize-none rounded-lg border bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:outline-none disabled:opacity-60 ${
                      fieldErrors.description
                        ? "border-error focus:border-error focus:ring-error/20"
                        : "border-outline-variant focus:border-primary focus:ring-primary/20"
                    }`}
                  />
                  {fieldErrors.description && (
                    <span
                      id="description-error"
                      role="alert"
                      className="font-body-sm text-body-sm text-error"
                    >
                      {fieldErrors.description}
                    </span>
                  )}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <legend className="font-label-sm text-label-sm mb-1 flex items-center gap-space-xs uppercase tracking-wider text-primary">
                  <span>2. Date &amp; Time</span>
                </legend>
                <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
                  <TextField
                    label="Date"
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={(v) => updateField("date", v)}
                    required
                    disabled={submitting}
                    error={fieldErrors.date}
                  />
                  <TextField
                    label="Start time"
                    type="time"
                    name="startTime"
                    value={form.startTime}
                    onChange={(v) => updateField("startTime", v)}
                    required
                    disabled={submitting}
                  />
                  <TextField
                    label="End time"
                    type="time"
                    name="endTime"
                    value={form.endTime}
                    onChange={(v) => updateField("endTime", v)}
                    disabled={submitting}
                    error={fieldErrors.endTime}
                    hint="Optional — before the start time means it ends the next day"
                  />
                </div>
                <TextField
                  label="Timezone"
                  name="timezone"
                  value={form.timezone}
                  onChange={(v) => updateField("timezone", v)}
                  required
                  disabled={submitting}
                  error={fieldErrors.timezone}
                  hint="An IANA timezone, e.g. Asia/Kolkata — defaults to the wedding's own"
                />
              </fieldset>

              <fieldset className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <legend className="font-label-sm text-label-sm mb-1 flex items-center gap-space-xs uppercase tracking-wider text-primary">
                  <span>3. Venue</span>
                </legend>
                <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                  <TextField
                    label="Venue name"
                    name="venueName"
                    value={form.venueName}
                    onChange={(v) => updateField("venueName", v)}
                    disabled={submitting}
                    error={fieldErrors.venueName}
                    hint="Optional"
                    placeholder="e.g. The Grand Ballroom"
                  />
                  <TextField
                    label="Venue address"
                    name="venueAddress"
                    value={form.venueAddress}
                    onChange={(v) => updateField("venueAddress", v)}
                    disabled={submitting}
                    error={fieldErrors.venueAddress}
                    hint="Optional"
                    placeholder="e.g. Lake Pichola, Udaipur"
                  />
                </div>
              </fieldset>

              {error && (
                <p className="font-body-sm text-body-sm text-error" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-space-md pb-space-sm">
                <button
                  type="button"
                  onClick={() => router.push(`/weddings/${weddingId}/events`)}
                  disabled={submitting}
                  className="h-11 rounded-lg bg-surface-container px-space-lg font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 min-w-45 items-center justify-center gap-space-xs rounded-lg bg-primary-container px-space-xl font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-secondary disabled:opacity-60"
                >
                  {submitting && (
                    <Icon name="progress_activity" className="animate-spin text-[20px]" />
                  )}
                  <span>{submitting ? "Creating Event…" : "Create Event"}</span>
                </button>
              </div>
            </form>
          </main>
        )}
      </div>
    </div>
  );
}

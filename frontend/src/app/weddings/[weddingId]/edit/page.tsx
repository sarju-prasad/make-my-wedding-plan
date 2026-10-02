"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { TextField } from "@/components/auth/TextField";
import { AppHeader } from "@/components/layout/AppHeader";
import { RetryNotice } from "@/components/layout/RetryNotice";
import { WeddingSidebar } from "@/components/layout/WeddingSidebar";
import { Icon } from "@/components/marketing/Icon";
import { VenueAddressField, type VenueLocation } from "@/components/wedding/VenueAddressField";
import {
  ApiError,
  getCurrentUser,
  getWedding,
  listMembers,
  mapValidationError,
  toErrorMessage,
  updateWedding,
  type User,
  type Wedding,
} from "@/lib/api";
import { daysUntilDateInZone, formatCurrentTimeInZone, toLocalDateInputValue } from "@/lib/date";

interface EditFormState {
  name: string;
  description: string;
  partnerOneName: string;
  partnerTwoName: string;
  weddingDate: string;
  timezone: string;
  location: VenueLocation;
}

function toFormState(wedding: Wedding): EditFormState {
  return {
    name: wedding.name,
    description: wedding.description ?? "",
    partnerOneName: wedding.couple.partnerOneName,
    partnerTwoName: wedding.couple.partnerTwoName,
    weddingDate: toLocalDateInputValue(wedding.weddingDate, wedding.timezone),
    timezone: wedding.timezone,
    location: { ...wedding.location },
  };
}

// A coordinate round-tripped through Google Places' `lat()`/`lng()` can
// differ from the originally-stored value by float noise (e.g. 24.5762 vs
// 24.57619999999998) even when the user re-picked the exact same address —
// treat anything under this as "the same place" rather than flagging the
// form as dirty (and silently re-saving a drifted value) over it.
const COORDINATE_EPSILON = 1e-6;

function coordinatesEqual(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < COORDINATE_EPSILON;
}

/**
 * Used for the dirty-check (Cancel's discard-changes prompt), not rendering:
 * every string field is compared trimmed, since that's what actually gets
 * sent on save (handleSave trims `description`; the backend trims every
 * other string field itself), so whitespace-only edits — or re-picking the
 * same venue and getting a float-noise-different coordinate back — don't
 * trigger a false "you have unsaved changes" prompt.
 */
function formsEqual(a: EditFormState, b: EditFormState): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.description.trim() === b.description.trim() &&
    a.partnerOneName.trim() === b.partnerOneName.trim() &&
    a.partnerTwoName.trim() === b.partnerTwoName.trim() &&
    a.weddingDate === b.weddingDate &&
    a.timezone.trim() === b.timezone.trim() &&
    a.location.address.trim() === b.location.address.trim() &&
    coordinatesEqual(a.location.latitude, b.location.latitude) &&
    coordinatesEqual(a.location.longitude, b.location.longitude)
  );
}

// Maps the backend's dotted Zod issue paths (error-mappers.ts's
// formatZodIssues) to this form's flat field keys, so a 422 response
// highlights the actual input the user needs to fix.
const FIELD_PATH_MAP: Record<string, string> = {
  name: "name",
  description: "description",
  weddingDate: "weddingDate",
  timezone: "timezone",
  "couple.partnerOneName": "partnerOneName",
  "couple.partnerTwoName": "partnerTwoName",
  "location.address": "location",
  "location.latitude": "location",
  "location.longitude": "location",
};

function DiscardChangesModal({
  onContinueEditing,
  onDiscard,
}: {
  onContinueEditing: () => void;
  onDiscard: () => void;
}) {
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const discardButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    continueButtonRef.current?.focus();

    // Only two focusable elements, both known up front, so a trap just has
    // to cycle Tab/Shift+Tab between them instead of walking the DOM for
    // every focusable descendant — this is the app's first modal, so there's
    // no existing focus-trap utility to reuse.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onContinueEditing();
        return;
      }
      if (e.key !== "Tab") return;
      const first = continueButtonRef.current;
      const last = discardButtonRef.current;
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onContinueEditing]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-space-md backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-2xl">
        <div className="mb-space-sm flex items-center gap-space-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-on-secondary-fixed">
            <Icon name="warning" className="text-[22px]" />
          </div>
          <h2
            id="discard-modal-title"
            className="font-headline-sm text-headline-sm text-on-surface"
          >
            Discard changes?
          </h2>
        </div>
        <p className="font-body-md text-body-md mb-space-lg text-on-surface-variant">
          You have unsaved changes to this wedding&apos;s details. If you leave now, those changes
          will be lost.
        </p>
        <div className="flex items-center justify-end gap-space-sm">
          <button
            ref={continueButtonRef}
            type="button"
            onClick={onContinueEditing}
            className="rounded-lg bg-surface-container px-space-md py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Continue Editing
          </button>
          <button
            ref={discardButtonRef}
            type="button"
            onClick={onDiscard}
            className="rounded-lg bg-primary px-space-md py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditWeddingPage() {
  const router = useRouter();
  const params = useParams<{ weddingId: string }>();
  const weddingId = params.weddingId;

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialForm, setInitialForm] = useState<EditFormState | null>(null);
  const [form, setForm] = useState<EditFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Re-runs whenever `weddingId` changes (e.g. browser back/forward
      // between two different weddings' edit pages, which Next.js serves
      // from the same mounted component instance). Without resetting these,
      // the previous wedding's form would stay rendered and *editable*
      // while the new one loads — and since handleSave always reads the
      // current `weddingId`, a save fired in that window would PATCH the
      // new wedding with the old one's still-displayed field values.
      setLoading(true);
      setLoadError(null);
      setForm(null);
      setInitialForm(null);
      setIsAdmin(false);
      try {
        const [{ user: currentUser }, { wedding: currentWedding }, { items: members }] =
          await Promise.all([getCurrentUser(), getWedding(weddingId), listMembers(weddingId, 100)]);
        if (cancelled) return;
        setUser(currentUser);
        setIsAdmin(members.some((m) => m.userId === currentUser.id && m.role === "ADMIN"));
        const nextForm = toFormState(currentWedding);
        setForm(nextForm);
        setInitialForm(nextForm);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
          router.replace("/sign-in");
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
  }, [router, weddingId, reloadCount]);

  function updateField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    // Clear a field's own error as soon as it's edited, rather than leaving
    // a stale "This field is required" visible under a field the user has
    // already fixed until the next full submit resets every error at once.
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const isDirty = form !== null && initialForm !== null && !formsEqual(form, initialForm);

  // Covers real browser navigation (closing the tab, typing a new URL,
  // refreshing) while dirty — the DiscardChangesModal only guards the
  // page's own Cancel button, since the sidebar/breadcrumb/sign-out links
  // are shared components used across the whole app and intercepting their
  // same-app client-side navigation too would need a broader navigation-
  // guard mechanism than this one page should introduce on its own.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleCancel() {
    if (isDirty) {
      setShowDiscardModal(true);
      return;
    }
    router.push(`/weddings/${weddingId}`);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form || submitting) return;

    setError(null);
    setFieldErrors({});

    const { address, latitude, longitude } = form.location;
    if (!address || latitude === null || longitude === null) {
      setFieldErrors({ location: "Please select a venue address from the suggestions." });
      return;
    }

    setSubmitting(true);
    try {
      await updateWedding(weddingId, {
        name: form.name,
        description: form.description.trim(),
        couple: { partnerOneName: form.partnerOneName, partnerTwoName: form.partnerTwoName },
        weddingDate: form.weddingDate,
        timezone: form.timezone,
        location: { address, latitude, longitude },
      });
      // The overview page re-fetches the wedding on every mount (same
      // pattern as create-wedding's redirect), so its details and countdown
      // reflect this save without any shared/cached state to update here.
      router.push(`/weddings/${weddingId}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNAUTHORIZED") {
        router.replace("/sign-in");
        return;
      }
      const { fieldErrors: fe, message } = mapValidationError(err, FIELD_PATH_MAP);
      setFieldErrors(fe);
      setError(message);
      setSubmitting(false);
    }
  }

  const weddingContext = form ? `${form.partnerOneName} & ${form.partnerTwoName}` : undefined;
  const countdownDays = form ? daysUntilDateInZone(form.weddingDate, form.timezone) : null;
  const localTime = form ? formatCurrentTimeInZone(form.timezone) : null;

  return (
    <div className="min-h-screen bg-surface">
      <WeddingSidebar weddingId={weddingId} />
      <div className="lg:pl-72">
        <AppHeader user={user} weddingContext={weddingContext} />

        {loading && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Loading wedding details…
            </p>
          </div>
        )}

        {!loading && (loadError || !form) && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-margin-mobile">
            <RetryNotice
              message={loadError ?? "Unable to load your wedding."}
              onRetry={() => {
                setLoading(true);
                setReloadCount((n) => n + 1);
              }}
            />
          </div>
        )}

        {!loading && form && !loadError && !isAdmin && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-space-md px-margin-mobile text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Only this wedding&apos;s Admin can edit its details.
            </p>
            <Link
              href={`/weddings/${weddingId}`}
              className="rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
            >
              Back to Overview
            </Link>
          </div>
        )}

        {!loading && form && !loadError && isAdmin && (
          <main className="mx-auto max-w-3xl px-margin-mobile py-space-xl pb-32 lg:px-margin md:pb-space-xl">
            <nav aria-label="Breadcrumb" className="mb-space-sm flex items-center gap-space-xs">
              <Link
                href={`/weddings/${weddingId}`}
                className="font-label-md text-label-md text-on-surface-variant transition-colors hover:text-primary"
              >
                Wedding Overview
              </Link>
              <Icon name="chevron_right" className="text-[16px] text-outline" />
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                Edit Wedding
              </span>
            </nav>

            <div className="mb-space-lg flex flex-col gap-space-xs">
              <h1 className="font-headline-xl text-headline-xl tracking-tight text-on-surface">
                Edit Wedding
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Update your wedding details. Only core celebration parameters are managed here.
              </p>
            </div>

            <div className="mb-space-lg flex items-start gap-space-md rounded-xl bg-surface-container-low p-space-md shadow-sm">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
                <Icon name="info" className="text-[20px] text-primary" />
              </div>
              <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                <span className="font-label-lg text-label-lg block text-on-surface">
                  Scope note
                </span>
                Individual ceremony events, guest invitations &amp; RSVPs, and your public wedding
                website are managed in their own dedicated sections.
              </p>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-space-xl">
              <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <div className="mb-space-lg">
                  <div className="font-label-sm text-label-sm mb-1 flex items-center gap-space-xs uppercase tracking-wider text-primary">
                    <span>Section 01</span>
                    <span>·</span>
                    <span>Identity</span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Wedding Details
                  </h2>
                </div>
                <div className="flex flex-col gap-space-lg">
                  <TextField
                    label="Wedding title"
                    name="name"
                    value={form.name}
                    onChange={(v) => updateField("name", v)}
                    required
                    disabled={submitting}
                    error={fieldErrors.name}
                    hint="Used across guest communications, email notifications, and invitations."
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
                      placeholder="A little about your celebration…"
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
                </div>
              </section>

              <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <div className="mb-space-lg">
                  <div className="font-label-sm text-label-sm mb-1 flex items-center gap-space-xs uppercase tracking-wider text-primary">
                    <span>Section 02</span>
                    <span>·</span>
                    <span>Principals</span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Couple</h2>
                </div>
                <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                  <TextField
                    label="Partner 1 name"
                    name="partnerOneName"
                    value={form.partnerOneName}
                    onChange={(v) => updateField("partnerOneName", v)}
                    required
                    disabled={submitting}
                    error={fieldErrors.partnerOneName}
                  />
                  <TextField
                    label="Partner 2 name"
                    name="partnerTwoName"
                    value={form.partnerTwoName}
                    onChange={(v) => updateField("partnerTwoName", v)}
                    required
                    disabled={submitting}
                    error={fieldErrors.partnerTwoName}
                  />
                </div>
              </section>

              <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <div className="mb-space-lg">
                  <div className="font-label-sm text-label-sm mb-1 flex items-center gap-space-xs uppercase tracking-wider text-primary">
                    <span>Section 03</span>
                    <span>·</span>
                    <span>Chronology</span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Date &amp; Time
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Used to calculate the countdown and timeline milestones shown on Overview.
                  </p>
                </div>
                <div className="flex flex-col gap-space-lg">
                  <TextField
                    label="Wedding date"
                    type="date"
                    name="weddingDate"
                    value={form.weddingDate}
                    onChange={(v) => updateField("weddingDate", v)}
                    required
                    disabled={submitting}
                    error={fieldErrors.weddingDate}
                    labelAddon={
                      countdownDays !== null && (
                        <span className="font-label-sm text-label-sm flex shrink-0 items-center gap-1 rounded-full bg-secondary-fixed px-2 py-0.5 text-on-secondary-fixed">
                          <Icon name="hourglass_top" className="text-[14px]" />
                          <span>
                            {countdownDays >= 0
                              ? `${countdownDays} days remaining from today`
                              : `${Math.abs(countdownDays)} days ago`}
                          </span>
                        </span>
                      )
                    }
                  />
                  <TextField
                    label="Timezone"
                    name="timezone"
                    value={form.timezone}
                    onChange={(v) => updateField("timezone", v)}
                    required
                    disabled={submitting}
                    error={fieldErrors.timezone}
                    hint="An IANA timezone, e.g. Asia/Kolkata"
                  />
                  {localTime && (
                    <div className="mt-1 flex items-center gap-space-xs rounded-lg bg-surface-container-low p-space-sm text-on-surface-variant">
                      <Icon
                        name="nest_clock_farsight_analog"
                        className="text-[18px] text-secondary"
                      />
                      <span className="font-label-sm text-label-sm">
                        Current local time at the venue: <strong>{localTime}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <div className="mb-space-lg">
                  <div className="font-label-sm text-label-sm mb-1 flex items-center gap-space-xs uppercase tracking-wider text-primary">
                    <span>Section 04</span>
                    <span>·</span>
                    <span>Sanctuary</span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Location</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Primary destination venue and geographic anchoring coordinates.
                  </p>
                </div>
                <div
                  aria-disabled={submitting}
                  className={submitting ? "pointer-events-none opacity-60" : undefined}
                >
                  <VenueAddressField
                    value={form.location}
                    onChange={(location) => updateField("location", location)}
                  />
                </div>
                {fieldErrors.location && (
                  <p className="font-body-sm text-body-sm mt-space-sm text-error" role="alert">
                    {fieldErrors.location}
                  </p>
                )}
              </section>

              {error && (
                <p className="font-body-sm text-body-sm text-error" role="alert">
                  {error}
                </p>
              )}

              <div className="hidden items-center justify-end gap-space-md pb-space-sm md:flex">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="h-11 rounded-lg bg-surface-container px-space-lg font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 min-w-35 items-center justify-center gap-space-xs rounded-lg bg-primary-container px-space-xl font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:bg-primary disabled:opacity-60"
                >
                  {submitting && (
                    <Icon name="progress_activity" className="animate-spin text-[20px]" />
                  )}
                  <span>{submitting ? "Saving…" : "Save Changes"}</span>
                </button>
              </div>

              <div className="fixed right-0 bottom-0 left-0 z-30 flex items-center gap-space-sm bg-surface/95 px-space-md py-space-sm shadow-[0_-4px_12px_rgba(26,25,23,0.06)] backdrop-blur-lg md:hidden">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="h-11 flex-1 rounded-lg bg-surface-container font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-container font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
                >
                  {submitting && (
                    <Icon name="progress_activity" className="animate-spin text-[16px]" />
                  )}
                  <span>{submitting ? "Saving…" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </main>
        )}
      </div>

      {showDiscardModal && (
        <DiscardChangesModal
          onContinueEditing={() => setShowDiscardModal(false)}
          onDiscard={() => router.push(`/weddings/${weddingId}`)}
        />
      )}
    </div>
  );
}

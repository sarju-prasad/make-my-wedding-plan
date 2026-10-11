"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { TextField } from "@/components/auth/TextField";
import { AppHeader } from "@/components/layout/AppHeader";
import { RetryNotice } from "@/components/layout/RetryNotice";
import { VenueAddressField, type VenueLocation } from "@/components/wedding/VenueAddressField";
import {
  ApiError,
  createWedding,
  getCurrentUser,
  listMyWeddings,
  toErrorMessage,
  type User,
  type Wedding,
} from "@/lib/api";
import { formatWeddingDate } from "@/lib/date";

interface WeddingFormState {
  name: string;
  partnerOneName: string;
  partnerTwoName: string;
  weddingDate: string;
  timezone: string;
  location: VenueLocation;
  description: string;
}

const EMPTY_FORM: WeddingFormState = {
  name: "",
  partnerOneName: "",
  partnerTwoName: "",
  weddingDate: "",
  timezone: "Asia/Kolkata",
  location: { address: "", latitude: null, longitude: null },
  description: "",
};

export default function WeddingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WeddingFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Distinct from `submitting`: once true, the create form is replaced by a
  // transitional message rather than re-enabled, so a slow/stalled
  // client-side navigation can't leave a live "Create wedding" button for a
  // second click to fire — see handleCreate.
  const [redirecting, setRedirecting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadError(null);
      try {
        const [{ user: currentUser }, { items }] = await Promise.all([
          getCurrentUser(),
          listMyWeddings(),
        ]);
        if (cancelled) return;
        setUser(currentUser);
        setWeddings(items);
        setShowForm(items.length === 0);
      } catch (err) {
        if (cancelled) return;
        // Only redirect for an actually-unauthenticated session — a
        // transient network/server error (e.g. a 503 while Mongo
        // reconnects) shouldn't bounce an already-signed-in user out of
        // the app as if their session had expired.
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
  }, [router, reloadCount]);

  function updateField<K extends keyof WeddingFormState>(key: K, value: WeddingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const { address, latitude, longitude } = form.location;
    if (!address || latitude === null || longitude === null) {
      setError("Please select a venue address from the suggestions.");
      return;
    }

    const description = form.description.trim();

    setSubmitting(true);
    try {
      const { wedding } = await createWedding({
        name: form.name,
        couple: { partnerOneName: form.partnerOneName, partnerTwoName: form.partnerTwoName },
        weddingDate: form.weddingDate,
        timezone: form.timezone,
        location: { address, latitude, longitude },
        // Omitted entirely when blank, matching the backend's genuinely-
        // optional (key-absent-if-unset) field, rather than sent as "".
        ...(description ? { description } : {}),
      });
      // The list page re-fetches on every mount, so there's no need to patch
      // local state before leaving — going back here will show the new
      // wedding anyway. `submitting` is deliberately left true (see
      // `redirecting` below) rather than reset here: re-enabling the button
      // while router.push() is still in flight would let a fast second
      // click fire a real duplicate createWedding() request.
      setRedirecting(true);
      router.push(`/weddings/${wedding.id}`);
    } catch (err) {
      setError(toErrorMessage(err));
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <AppHeader user={user} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface">
        <AppHeader user={user} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-margin-mobile">
          <RetryNotice
            message={loadError}
            onRetry={() => {
              setLoading(true);
              setReloadCount((n) => n + 1);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader user={user} />

      <main className="mx-auto flex max-w-3xl flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin">
        {weddings.length > 0 && (
          <section className="flex flex-col gap-space-md">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Your weddings</h2>
            <div className="flex flex-col gap-space-sm">
              {weddings.map((wedding) => (
                <Link
                  key={wedding.id}
                  href={`/weddings/${wedding.id}`}
                  className="flex flex-col gap-1 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm transition-all hover:bg-surface-container-low"
                >
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    {wedding.name}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {formatWeddingDate(wedding.weddingDate, wedding.timezone)} &bull;{" "}
                    {wedding.location.address}
                  </span>
                  <span className="font-label-sm text-label-sm text-primary uppercase">
                    make-my-wedding-plan.app/w/{wedding.slug}
                  </span>
                </Link>
              ))}
            </div>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="self-start rounded-lg bg-surface-container-high px-space-md py-space-sm font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container"
              >
                + Create another wedding
              </button>
            )}
          </section>
        )}

        {showForm && redirecting && (
          <section className="flex flex-col items-center gap-space-sm rounded-xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Wedding created — taking you to your wedding workspace…
            </p>
          </section>
        )}

        {showForm && !redirecting && (
          <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-xl shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-lg text-headline-lg text-on-surface">
                Create your wedding
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                You&apos;ll become the Admin of this wedding workspace.
              </p>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-space-md">
              <TextField
                label="Wedding name"
                name="name"
                value={form.name}
                onChange={(v) => updateField("name", v)}
                required
                placeholder="Ananya & Arjun's Wedding"
              />
              <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                <TextField
                  label="Partner one's name"
                  name="partnerOneName"
                  value={form.partnerOneName}
                  onChange={(v) => updateField("partnerOneName", v)}
                  required
                />
                <TextField
                  label="Partner two's name"
                  name="partnerTwoName"
                  value={form.partnerTwoName}
                  onChange={(v) => updateField("partnerTwoName", v)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                <TextField
                  label="Wedding date"
                  type="date"
                  name="weddingDate"
                  value={form.weddingDate}
                  onChange={(v) => updateField("weddingDate", v)}
                  required
                />
                <TextField
                  label="Timezone"
                  name="timezone"
                  value={form.timezone}
                  onChange={(v) => updateField("timezone", v)}
                  required
                  hint="An IANA timezone, e.g. Asia/Kolkata"
                />
              </div>
              <VenueAddressField
                value={form.location}
                onChange={(location) => updateField("location", location)}
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="description"
                  className="font-label-lg text-label-lg text-on-surface"
                >
                  Wedding description{" "}
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    (optional)
                  </span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="A little about your celebration…"
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-space-xs inline-flex items-center justify-center self-start rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create wedding"}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

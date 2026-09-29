"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { TextField } from "@/components/auth/TextField";
import {
  ApiError,
  createWedding,
  getCurrentUser,
  listMyWeddings,
  logoutUser,
  toErrorMessage,
  type User,
  type Wedding,
} from "@/lib/api";

/**
 * Each wedding carries its own IANA timezone, and two weddings on this page
 * can have different ones — a single module-level formatter can't be
 * correct for both, so this builds one per wedding using its own
 * `timezone` field rather than the viewer's local zone (which is what
 * `new Intl.DateTimeFormat(locale).format(date)` without a `timeZone`
 * option would silently use instead).
 */
function formatWeddingDate(weddingDateIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(weddingDateIso));
}

interface WeddingFormState {
  name: string;
  partnerOneName: string;
  partnerTwoName: string;
  weddingDate: string;
  timezone: string;
  address: string;
  latitude: string;
  longitude: string;
}

const EMPTY_FORM: WeddingFormState = {
  name: "",
  partnerOneName: "",
  partnerTwoName: "",
  weddingDate: "",
  timezone: "Asia/Kolkata",
  address: "",
  latitude: "",
  longitude: "",
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
    setSubmitting(true);
    try {
      const { wedding } = await createWedding({
        name: form.name,
        couple: { partnerOneName: form.partnerOneName, partnerTwoName: form.partnerTwoName },
        weddingDate: form.weddingDate,
        timezone: form.timezone,
        location: {
          address: form.address,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        },
      });
      setWeddings((prev) => [wedding, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await logoutUser().catch(() => undefined);
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-space-md bg-surface px-margin-mobile text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setReloadCount((n) => n + 1);
          }}
          className="rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-surface-container-high px-margin-mobile py-space-md lg:px-margin">
        <div className="flex flex-col">
          <span className="font-headline-sm text-headline-sm text-primary">
            Make My Wedding Plan
          </span>
          {user && (
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Signed in as {user.name}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="rounded-lg bg-surface-container-high px-space-md py-space-sm font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin">
        {weddings.length > 0 && (
          <section className="flex flex-col gap-space-md">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Your weddings</h2>
            <div className="flex flex-col gap-space-sm">
              {weddings.map((wedding) => (
                <div
                  key={wedding.id}
                  className="flex flex-col gap-1 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
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
                </div>
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

        {showForm && (
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
              <TextField
                label="Venue address"
                name="address"
                value={form.address}
                onChange={(v) => updateField("address", v)}
                required
              />
              <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                <TextField
                  label="Venue latitude"
                  type="number"
                  step="any"
                  name="latitude"
                  value={form.latitude}
                  onChange={(v) => updateField("latitude", v)}
                  required
                  placeholder="24.5762"
                />
                <TextField
                  label="Venue longitude"
                  type="number"
                  step="any"
                  name="longitude"
                  value={form.longitude}
                  onChange={(v) => updateField("longitude", v)}
                  required
                  placeholder="73.6833"
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

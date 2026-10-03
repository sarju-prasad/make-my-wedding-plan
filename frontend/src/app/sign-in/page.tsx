"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { TextField } from "@/components/auth/TextField";
import { loginUser, toErrorMessage } from "@/lib/api";
import { isSafeRedirect } from "@/lib/safe-redirect";

function SignInForm() {
  const router = useRouter();
  // e.g. ?next=/invitations/<token>, set by the Accept Invitation page so a
  // visitor who isn't signed in yet lands back there after authenticating,
  // instead of the default /weddings. Falls back to /weddings when absent —
  // or when present but not a same-origin relative path, since this is
  // attacker-controlled (a crafted ?next=https://evil.example link) and
  // would otherwise be an open redirect straight after login.
  const rawNext = useSearchParams().get("next");
  const next = isSafeRedirect(rawNext) ? rawNext : "/weddings";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginUser({ email, password });
      router.push(next);
    } catch (err) {
      // api_design.docx §5.3: login already returns a generic message on
      // the backend (no account enumeration) — shown to the user as-is.
      setError(toErrorMessage(err));
      setSubmitting(false);
    }
  }

  const signUpHref =
    next === "/weddings" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`;

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to your wedding workspace.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
        <TextField
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={setEmail}
          required
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
        />

        <Link
          href="/forgot-password"
          className="-mt-space-sm self-end font-body-sm text-body-sm font-semibold text-primary hover:underline"
        >
          Forgot password?
        </Link>

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-space-xs inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
        New here?{" "}
        <Link href={signUpHref} className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { TextField } from "@/components/auth/TextField";
import { registerUser, toErrorMessage } from "@/lib/api";
import { resolveSafeRedirect } from "@/lib/safe-redirect";

function SignUpForm() {
  const router = useRouter();
  // See sign-in/page.tsx for why — same ?next= convention, same fallback,
  // same open-redirect guard.
  const next = resolveSafeRedirect(useSearchParams().get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerUser({ name, email, password });
      router.push(next);
    } catch (err) {
      setError(toErrorMessage(err));
      setSubmitting(false);
    }
  }

  const signInHref =
    next === "/weddings" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;

  return (
    <AuthLayout title="Plan your wedding" subtitle="Create your private workspace.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
        <TextField
          label="Your name"
          name="name"
          value={name}
          onChange={setName}
          required
          autoComplete="name"
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-space-xs inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary disabled:opacity-60"
        >
          {submitting ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <p className="mt-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link href={signInHref} className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

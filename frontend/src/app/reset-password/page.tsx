"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { TextField } from "@/components/auth/TextField";
import { resetPassword, toErrorMessage } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid link">
        <p className="font-body-md text-body-md text-on-surface-variant">
          This password reset link is missing its token. Request a new one from the sign-in page.
        </p>
        <p className="mt-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password reset">
        <p className="font-body-md text-body-md text-on-surface-variant">
          Your password has been changed. Please sign in with your new password.
        </p>
        <Link
          href="/sign-in"
          className="mt-space-lg inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
        >
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
        <TextField
          label="New password"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <TextField
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          autoComplete="new-password"
        />

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-space-xs inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary disabled:opacity-60"
        >
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

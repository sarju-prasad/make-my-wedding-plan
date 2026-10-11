"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { TextField } from "@/components/auth/TextField";
import { forgotPassword, toErrorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ message: string; devResetUrl?: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await forgotPassword(email);
      setResult(res);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <AuthLayout title="Check your email">
        <p className="font-body-md text-body-md text-on-surface-variant">{result.message}</p>

        {/* Only ever present outside production, when no email provider is
            configured on the backend — see backend/src/modules/auth/auth.service.ts. */}
        {result.devResetUrl && (
          <div className="mt-space-md flex flex-col gap-1 rounded-lg bg-surface-container-low p-space-md">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
              Dev mode &mdash; no email provider configured
            </span>
            <Link
              href={result.devResetUrl}
              className="font-body-sm text-body-sm break-all text-primary hover:underline"
            >
              {result.devResetUrl}
            </Link>
          </div>
        )}

        <p className="mt-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to set a new one.">
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

        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-space-xs inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-space-lg text-center font-body-sm text-body-sm text-on-surface-variant">
        <Link href="/sign-in" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

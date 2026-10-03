"use client";

import { type FormEvent, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  createInvitation,
  toErrorMessage,
  type InvitationActionResult,
  type MemberRole,
} from "@/lib/api";

const ROLE_OPTIONS: { value: MemberRole; label: string; description: string }[] = [
  {
    value: "MANAGER",
    label: "Manager",
    description: "Can help run the wedding — events, and more as those modules ship.",
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full control, including wedding settings and the team itself.",
  },
];

export function InviteMemberModal({
  weddingId,
  onClose,
  onInvited,
}: {
  weddingId: string;
  onClose: () => void;
  onInvited: (result: InvitationActionResult) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("MANAGER");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setEmailError(null);
    setSubmitting(true);
    try {
      const result = await createInvitation(weddingId, { email: email.trim(), role });
      onInvited(result);
    } catch (err) {
      // DUPLICATE_RESOURCE ("already pending") and ALREADY_MEMBER both come
      // back as a plain message with no field-level `details` the way a 422
      // VALIDATION_ERROR would — but both are really about the email field,
      // so they're shown there rather than as a generic form error.
      if (
        err instanceof ApiError &&
        (err.code === "DUPLICATE_RESOURCE" || err.code === "ALREADY_MEMBER")
      ) {
        setEmailError(err.message);
      } else if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        const detail = (err.details as { path?: string; message?: string }[] | undefined)?.find(
          (d) => d.path === "email",
        );
        if (detail) {
          setEmailError(detail.message ?? err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError(toErrorMessage(err));
      }
      setSubmitting(false);
    }
  }

  return (
    <Modal
      titleId="invite-modal-title"
      onClose={onClose}
      widthClassName="max-w-lg"
      closeDisabled={submitting}
    >
      <div className="mb-space-md flex items-start justify-between">
        <div>
          <span className="font-label-sm text-label-sm font-semibold tracking-wider text-primary uppercase">
            Workspace Access
          </span>
          <h2
            id="invite-modal-title"
            className="font-headline-sm text-headline-sm mt-0.5 text-on-surface"
          >
            Invite to Wedding Team
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-space-lg">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="invite-email"
            className="font-label-md text-label-md font-medium text-on-surface"
          >
            Email address <span className="text-error">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            required
            disabled={submitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. coordinator@example.com"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "invite-email-error" : undefined}
            className={`w-full rounded-lg border bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:outline-none disabled:opacity-60 ${
              emailError
                ? "border-error focus:border-error focus:ring-error/20"
                : "border-outline-variant focus:border-primary focus:ring-primary/20"
            }`}
          />
          {emailError && (
            <span
              id="invite-email-error"
              role="alert"
              className="font-body-sm text-body-sm text-error"
            >
              {emailError}
            </span>
          )}
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Works whether or not they already have an account.
          </p>
        </div>

        <fieldset className="flex flex-col gap-space-sm">
          <legend className="font-label-md text-label-md mb-1 font-medium text-on-surface">
            Role
          </legend>
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-space-md transition-colors ${
                  role === option.value
                    ? "border-primary bg-primary-fixed/20"
                    : "border-transparent bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                    {option.label}
                  </span>
                  <input
                    type="radio"
                    name="invite-role"
                    value={option.value}
                    checked={role === option.value}
                    disabled={submitting}
                    onChange={() => setRole(option.value)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-space-sm pt-space-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-space-md py-2.5 font-label-lg text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-space-xs rounded-lg bg-primary-container px-space-lg py-2.5 font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-primary disabled:opacity-60"
          >
            {submitting && (
              <span className="material-symbols-outlined animate-spin text-[18px]">
                progress_activity
              </span>
            )}
            <span>{submitting ? "Sending…" : "Send Invitation"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

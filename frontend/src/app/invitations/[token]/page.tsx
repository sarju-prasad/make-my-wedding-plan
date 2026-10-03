"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import {
  acceptInvitation,
  ApiError,
  getCurrentUser,
  logoutUser,
  previewInvitation,
  toErrorMessage,
  type InvitationPreview,
  type User,
} from "@/lib/api";

type View =
  | "loading"
  | "load-error"
  | "not-found"
  | "revoked"
  | "expired"
  | "not-signed-in"
  | "mismatch"
  | "already-member"
  | "ready"
  | "success";

const ROLE_LABEL = { ADMIN: "Admin", MANAGER: "Manager" } as const;

export default function AcceptInvitationPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [view, setView] = useState<View>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [previewResult, currentUser] = await Promise.all([
          previewInvitation(token),
          // Not being signed in is an entirely normal state on this page
          // (that's exactly the "not-signed-in" view below) — caught here
          // rather than letting it propagate, so it doesn't get treated as
          // a load failure the way every *other* page in this app treats an
          // UNAUTHORIZED.
          getCurrentUser().catch(() => null),
        ]);
        if (cancelled) return;

        const invitation = previewResult.invitation;
        setPreview(invitation);
        setUser(currentUser?.user ?? null);

        if (invitation.status === "REVOKED") {
          setView("revoked");
        } else if (invitation.status === "PENDING" && invitation.isExpired) {
          setView("expired");
        } else if (!currentUser) {
          setView("not-signed-in");
        } else if (currentUser.user.email !== invitation.email) {
          setView("mismatch");
        } else if (invitation.status === "ACCEPTED") {
          setView("already-member");
        } else {
          setView("ready");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "INVITATION_NOT_FOUND") {
          setView("not-found");
        } else {
          setLoadErrorMessage(toErrorMessage(err));
          setView("load-error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept() {
    if (accepting) return;
    setAcceptError(null);
    setAccepting(true);
    try {
      await acceptInvitation(token);
      setView("success");
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === "ALREADY_MEMBER" || err.code === "INVITATION_ALREADY_ACCEPTED")
      ) {
        setView("already-member");
      } else if (err instanceof ApiError && err.code === "INVITATION_EXPIRED") {
        setView("expired");
      } else if (err instanceof ApiError && err.code === "INVITATION_REVOKED") {
        setView("revoked");
      } else if (err instanceof ApiError && err.code === "EMAIL_MISMATCH") {
        setView("mismatch");
      } else {
        setAcceptError(toErrorMessage(err));
      }
    } finally {
      setAccepting(false);
    }
  }

  async function handleSwitchAccount() {
    await logoutUser().catch(() => undefined);
    router.push(`/sign-in?next=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  if (view === "loading") {
    return (
      <AuthLayout title="Loading invitation…">
        <p className="font-body-md text-body-md text-center text-on-surface-variant">
          Just a moment.
        </p>
      </AuthLayout>
    );
  }

  if (view === "load-error") {
    return (
      <AuthLayout title="Something went wrong">
        <p className="font-body-md text-body-md text-center text-on-surface-variant">
          {loadErrorMessage}
        </p>
      </AuthLayout>
    );
  }

  if (view === "not-found") {
    return (
      <AuthLayout title="Invitation not found">
        <p className="font-body-md text-body-md text-center text-on-surface-variant">
          This invitation link doesn&apos;t exist, or the address wasn&apos;t copied correctly. Ask
          whoever invited you for a fresh link.
        </p>
      </AuthLayout>
    );
  }

  if (view === "revoked") {
    return (
      <AuthLayout title="Invitation revoked">
        <p className="font-body-md text-body-md text-center text-on-surface-variant">
          The wedding&apos;s Admin has cancelled this invitation. Ask them to send a new one if this
          was unexpected.
        </p>
      </AuthLayout>
    );
  }

  if (view === "expired") {
    return (
      <AuthLayout title="Invitation expired">
        <p className="font-body-md text-body-md text-center text-on-surface-variant">
          This invitation link has expired. Ask the wedding&apos;s Admin to resend it from the
          &quot;Wedding team&quot; section.
        </p>
      </AuthLayout>
    );
  }

  // From here on, `preview` is always set (every view above resolves before
  // it would otherwise be needed) — narrowed once, rather than re-checking
  // `preview &&` in each of the remaining branches.
  if (!preview) return null;

  const roleLabel = ROLE_LABEL[preview.role];
  const weddingName = `${preview.couple.partnerOneName} & ${preview.couple.partnerTwoName}`;

  if (view === "not-signed-in") {
    const next = `/invitations/${token}`;
    return (
      <AuthLayout
        title="You're invited"
        subtitle={`${preview.invitedByName} invited you to join ${weddingName}'s wedding as a ${roleLabel}.`}
      >
        <div className="flex flex-col gap-space-sm">
          <p className="font-body-sm text-body-sm text-center text-on-surface-variant">
            Sign in or create an account with <strong>{preview.email}</strong> to accept.
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
          >
            Sign in to accept
          </Link>
          <Link
            href={`/sign-up?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center justify-center rounded-lg bg-surface-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container-high"
          >
            Create an account to accept
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (view === "mismatch") {
    return (
      <AuthLayout title="Signed in as a different account">
        <p className="font-body-md text-body-md mb-space-lg text-center text-on-surface-variant">
          You&apos;re signed in as <strong>{user?.email}</strong>, but this invitation was sent to{" "}
          <strong>{preview.email}</strong>.
        </p>
        <div className="flex flex-col gap-space-sm">
          <button
            type="button"
            onClick={() => void handleSwitchAccount()}
            className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
          >
            Sign out & use a different account
          </button>
          <Link
            href="/weddings"
            className="inline-flex items-center justify-center rounded-lg bg-surface-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container-high"
          >
            Go to your weddings
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (view === "already-member") {
    return (
      <AuthLayout title="You're already on the team">
        <p className="font-body-md text-body-md mb-space-lg text-center text-on-surface-variant">
          You already have access to {weddingName}&apos;s wedding workspace with this account.
        </p>
        <Link
          href={`/weddings/${preview.weddingId}`}
          className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
        >
          Go to Wedding Overview
        </Link>
      </AuthLayout>
    );
  }

  if (view === "success") {
    return (
      <AuthLayout title="You're in!">
        <p className="font-body-md text-body-md mb-space-lg text-center text-on-surface-variant">
          You now have <strong>{roleLabel}</strong> access to {weddingName}&apos;s wedding
          workspace.
        </p>
        <Link
          href={`/weddings/${preview.weddingId}`}
          className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
        >
          Open Wedding Overview
        </Link>
      </AuthLayout>
    );
  }

  // view === "ready"
  return (
    <AuthLayout
      title="You're invited"
      subtitle={`${preview.invitedByName} invited you to join ${weddingName}'s wedding as a ${roleLabel}.`}
    >
      <div className="flex flex-col gap-space-md">
        <div className="rounded-lg bg-surface-container px-space-md py-space-sm">
          <div className="min-w-0">
            <p className="font-label-md text-label-md truncate text-on-surface">{user?.name}</p>
            <p className="font-body-sm text-body-sm truncate text-on-surface-variant">
              {preview.email}
            </p>
          </div>
        </div>

        {acceptError && (
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {acceptError}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={accepting}
          className="flex items-center justify-center gap-space-xs rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-primary disabled:opacity-60"
        >
          {accepting && (
            <span className="material-symbols-outlined animate-spin text-[18px]">
              progress_activity
            </span>
          )}
          <span>{accepting ? "Joining…" : "Accept & Join"}</span>
        </button>
        <Link
          href="/weddings"
          className="inline-flex items-center justify-center rounded-lg px-space-lg py-space-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Not now
        </Link>
      </div>
    </AuthLayout>
  );
}

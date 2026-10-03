"use client";

import { useEffect, useState } from "react";

import { InviteMemberModal } from "@/components/wedding/InviteMemberModal";
import {
  listInvitations,
  listMembers,
  removeMember,
  resendInvitation,
  revokeInvitation,
  toErrorMessage,
  updateMemberRole,
  type Invitation,
  type InvitationActionResult,
  type Member,
  type MemberRole,
} from "@/lib/api";

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className={`font-label-sm text-label-sm rounded-full px-2 py-0.5 font-semibold uppercase ${
        role === "ADMIN"
          ? "bg-primary-fixed text-on-primary-fixed"
          : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      {role === "ADMIN" ? "Admin" : "Manager"}
    </span>
  );
}

/** Click-to-confirm toggle, not a browser confirm() dialog — same pattern for every destructive row action in this section (remove a member, revoke an invitation). */
function ConfirmButton({
  label,
  confirmLabel,
  pending,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="font-label-sm text-label-sm rounded-lg bg-error px-2 py-1 font-semibold text-on-error disabled:opacity-60"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="font-label-sm text-label-sm rounded-lg px-2 py-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={pending}
      className="font-label-sm text-label-sm rounded-lg px-2 py-1 text-error hover:bg-error-container/40 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function expiryLabel(invitation: Invitation): string {
  if (invitation.isExpired) return "Expired";
  const days = Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function MembersSection({
  weddingId,
  currentUserId,
}: {
  weddingId: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const [rowError, setRowError] = useState<string | null>(null);
  // A set, not a single id: each row's pending/disabled state must be
  // independent, otherwise finishing one row's request clears the pending
  // flag for a *different* row whose request is still in flight, letting a
  // second click fire against it before the first one has settled. Shared
  // between member rows and invitation rows — their ids never collide
  // (different collections), and both need exactly the same guarantee.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadError(null);
      try {
        const { items } = await listMembers(weddingId);
        if (!cancelled) setMembers(items);
      } catch (err) {
        if (!cancelled) setLoadError(toErrorMessage(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [weddingId, reloadCount]);

  const isAdmin = members?.some((m) => m.userId === currentUserId && m.role === "ADMIN") ?? false;

  // Pending invitations are ADMIN-only (backend-enforced too) — only fetched
  // once we actually know the viewer is an Admin, not merely once members
  // has loaded, since every non-Admin falls through this check forever.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    async function load() {
      setInvitationsError(null);
      try {
        const { items } = await listInvitations(weddingId);
        if (!cancelled) setInvitations(items);
      } catch (err) {
        if (!cancelled) setInvitationsError(toErrorMessage(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [weddingId, isAdmin, reloadCount]);

  function handleInvited(result: InvitationActionResult) {
    setShowInviteModal(false);
    setInvitations((prev) => [result.invitation, ...(prev ?? [])]);
    setInviteNotice(
      result.emailSent
        ? `Invitation sent to ${result.invitation.email}.`
        : `Invitation created for ${result.invitation.email}, but the email couldn't be sent — use Resend to try again.`,
    );
  }

  async function handleResend(invitationId: string) {
    setInvitationsError(null);
    setPendingIds((prev) => new Set(prev).add(invitationId));
    try {
      const result = await resendInvitation(weddingId, invitationId);
      setInvitations(
        (prev) => prev?.map((i) => (i.id === invitationId ? result.invitation : i)) ?? null,
      );
      setInviteNotice(
        result.emailSent
          ? `Invitation resent to ${result.invitation.email}.`
          : `Invitation refreshed for ${result.invitation.email}, but the email couldn't be sent.`,
      );
    } catch (err) {
      setInvitationsError(toErrorMessage(err));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(invitationId);
        return next;
      });
    }
  }

  async function handleRevoke(invitationId: string) {
    setInvitationsError(null);
    setPendingIds((prev) => new Set(prev).add(invitationId));
    try {
      await revokeInvitation(weddingId, invitationId);
      setInvitations((prev) => prev?.filter((i) => i.id !== invitationId) ?? null);
    } catch (err) {
      setInvitationsError(toErrorMessage(err));
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(invitationId);
        return next;
      });
    }
  }

  async function handleRoleChange(memberId: string, role: MemberRole) {
    setRowError(null);
    setPendingIds((prev) => new Set(prev).add(memberId));
    try {
      const { member } = await updateMemberRole(weddingId, memberId, role);
      setMembers((prev) => prev?.map((m) => (m.id === memberId ? member : m)) ?? null);
    } catch (err) {
      setRowError(toErrorMessage(err));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  }

  async function handleRemove(memberId: string) {
    setRowError(null);
    setPendingIds((prev) => new Set(prev).add(memberId));
    try {
      await removeMember(weddingId, memberId);
      setMembers((prev) => prev?.filter((m) => m.id !== memberId) ?? null);
    } catch (err) {
      setRowError(toErrorMessage(err));
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
    // No `finally` clearing pendingIds on success: the member is gone from
    // `members` (so its row unmounts) rather than staying rendered-but-
    // re-enabled.
  }

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="mb-space-md flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Wedding team</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Family members with access to this wedding.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="font-label-sm text-label-sm inline-flex items-center gap-1 rounded-lg bg-primary-container px-space-md py-1.5 text-on-primary shadow-sm transition-all hover:bg-primary"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {loadError && (
        <div className="flex flex-col items-start gap-space-sm">
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setMembers(null);
              setReloadCount((n) => n + 1);
            }}
            className="font-label-sm text-label-sm rounded-lg bg-surface-container-high px-space-md py-1.5 text-on-surface transition-all hover:bg-surface-container"
          >
            Try again
          </button>
        </div>
      )}

      {!loadError && !members && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Loading team…</p>
      )}

      {inviteNotice && (
        <p className="font-body-sm text-body-sm mb-space-sm text-primary" role="status">
          {inviteNotice}
        </p>
      )}

      {members && (
        <div className="flex flex-col gap-space-sm">
          {rowError && (
            <p className="font-body-sm text-body-sm text-error" role="alert">
              {rowError}
            </p>
          )}
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const isPending = pendingIds.has(member.id);
            return (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm"
              >
                <div className="flex min-w-0 items-center gap-space-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-on-primary">
                    {initials(member.name)}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-body-md text-body-md truncate font-medium text-on-surface">
                      {member.name}
                      {isSelf && <span className="text-on-surface-variant"> (you)</span>}
                    </span>
                    <span className="font-body-sm text-body-sm truncate text-on-surface-variant">
                      {member.email}
                    </span>
                  </div>
                </div>

                {isAdmin ? (
                  <div className="flex shrink-0 items-center gap-space-sm">
                    <select
                      value={member.role}
                      disabled={isPending}
                      onChange={(e) =>
                        void handleRoleChange(member.id, e.target.value as MemberRole)
                      }
                      className="font-label-sm text-label-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-on-surface disabled:opacity-60"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MANAGER">Manager</option>
                    </select>
                    {isSelf ? (
                      // Removing your own membership breaks this very panel
                      // (the next fetch 404s — you're no longer an active
                      // member) — ask them to have another Admin do it
                      // instead, rather than let self-service produce a
                      // confusing "Wedding not found" right after.
                      <span
                        className="font-label-sm text-label-sm px-2 py-1 text-on-surface-variant"
                        title="Ask another Admin to remove you"
                      >
                        —
                      </span>
                    ) : (
                      <ConfirmButton
                        label="Remove"
                        confirmLabel="Confirm"
                        pending={isPending}
                        onConfirm={() => void handleRemove(member.id)}
                      />
                    )}
                  </div>
                ) : (
                  <RoleBadge role={member.role} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <div className="mt-space-lg border-t border-surface-container-high pt-space-md">
          <h3 className="font-label-lg text-label-lg mb-space-sm text-on-surface">
            Pending invitations
          </h3>

          {invitationsError && (
            <p className="font-body-sm text-body-sm mb-space-sm text-error" role="alert">
              {invitationsError}
            </p>
          )}

          {!invitationsError && !invitations && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
          )}

          {invitations && invitations.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No pending invitations.
            </p>
          )}

          {invitations && invitations.length > 0 && (
            <div className="flex flex-col gap-space-sm">
              {invitations.map((invitation) => {
                const isPending = pendingIds.has(invitation.id);
                return (
                  <div
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-body-md text-body-md truncate font-medium text-on-surface">
                        {invitation.email}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        Invited as <RoleBadge role={invitation.role} /> ·{" "}
                        <span className={invitation.isExpired ? "text-error" : undefined}>
                          {expiryLabel(invitation)}
                        </span>
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-space-sm">
                      <button
                        type="button"
                        onClick={() => void handleResend(invitation.id)}
                        disabled={isPending}
                        className="font-label-sm text-label-sm rounded-lg bg-surface-container px-2 py-1 text-on-surface transition-all hover:bg-surface-container-high disabled:opacity-60"
                      >
                        Resend
                      </button>
                      <ConfirmButton
                        label="Revoke"
                        confirmLabel="Confirm"
                        pending={isPending}
                        onConfirm={() => void handleRevoke(invitation.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showInviteModal && (
        <InviteMemberModal
          weddingId={weddingId}
          onClose={() => setShowInviteModal(false)}
          onInvited={handleInvited}
        />
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

import {
  addMember,
  listMembers,
  removeMember,
  toErrorMessage,
  updateMemberRole,
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

/** ADMIN-only remove control — a click-to-confirm toggle rather than a browser confirm() dialog. */
function RemoveMemberButton({ pending, onConfirm }: { pending: boolean; onConfirm: () => void }) {
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
          Confirm
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
      Remove
    </button>
  );
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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("MANAGER");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const [rowError, setRowError] = useState<string | null>(null);
  // A set, not a single id: each row's pending/disabled state must be
  // independent, otherwise finishing one row's request clears the pending
  // flag for a *different* row whose request is still in flight, letting a
  // second click fire against it before the first one has settled.
  const [pendingMemberIds, setPendingMemberIds] = useState<ReadonlySet<string>>(new Set());

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

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      const { member } = await addMember(weddingId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      // The POST response already has the full member record — no need to
      // refetch the whole list just to learn data already in hand. (A
      // reactivated previously-removed member would already be in
      // `members` as REMOVED-and-hidden — since the list only ever holds
      // ACTIVE members, filtering it out first avoids a duplicate row.)
      setMembers((prev) => [...(prev ?? []).filter((m) => m.id !== member.id), member]);
      setInviteEmail("");
      setInviteRole("MANAGER");
    } catch (err) {
      setInviteError(toErrorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, role: MemberRole) {
    setRowError(null);
    setPendingMemberIds((prev) => new Set(prev).add(memberId));
    try {
      const { member } = await updateMemberRole(weddingId, memberId, role);
      setMembers((prev) => prev?.map((m) => (m.id === memberId ? member : m)) ?? null);
    } catch (err) {
      setRowError(toErrorMessage(err));
    } finally {
      setPendingMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  }

  async function handleRemove(memberId: string) {
    setRowError(null);
    setPendingMemberIds((prev) => new Set(prev).add(memberId));
    try {
      await removeMember(weddingId, memberId);
      setMembers((prev) => prev?.filter((m) => m.id !== memberId) ?? null);
    } catch (err) {
      setRowError(toErrorMessage(err));
      setPendingMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
    // No `finally` clearing pendingMemberIds on success: the member is
    // gone from `members` (so its row unmounts) rather than staying
    // rendered-but-re-enabled.
  }

  return (
    <section className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="mb-space-md flex items-center justify-between">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Wedding team</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Family members with access to this wedding.
          </p>
        </div>
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

      {members && (
        <div className="flex flex-col gap-space-sm">
          {rowError && (
            <p className="font-body-sm text-body-sm text-error" role="alert">
              {rowError}
            </p>
          )}
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const isPending = pendingMemberIds.has(member.id);
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
                      <RemoveMemberButton
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
        <form
          onSubmit={(e) => void handleInvite(e)}
          className="mt-space-md flex flex-wrap items-end gap-space-sm border-t border-surface-container-high pt-space-md"
        >
          <div className="flex flex-1 flex-col gap-1 [flex-basis:12rem]">
            <label htmlFor="inviteEmail" className="font-label-sm text-label-sm text-on-surface">
              Add a family member
            </label>
            <input
              id="inviteEmail"
              type="email"
              required
              disabled={inviting}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Their email address"
              className="font-body-sm text-body-sm w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-space-sm py-1.5 text-on-surface disabled:opacity-60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>
          <select
            value={inviteRole}
            disabled={inviting}
            onChange={(e) => setInviteRole(e.target.value as MemberRole)}
            className="font-label-sm text-label-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-on-surface disabled:opacity-60"
          >
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="font-label-sm text-label-sm rounded-lg bg-primary px-space-md py-1.5 font-semibold text-on-primary transition-all hover:bg-primary-container disabled:opacity-60"
          >
            {inviting ? "Adding…" : "Add"}
          </button>
          {inviteError && (
            <p className="font-body-sm text-body-sm w-full text-error" role="alert">
              {inviteError}
            </p>
          )}
          <p className="font-body-sm text-body-sm w-full text-on-surface-variant">
            They need an existing account on Make My Wedding Plan.
          </p>
        </form>
      )}
    </section>
  );
}

/**
 * Thin fetch wrapper for the backend's `/api/v1` REST API. Every response
 * uses the standard envelope (`../../backend/src/core/http/response.ts`):
 * `{ success: true, data }` or `{ success: false, error }` — this unwraps
 * that once here instead of in every call site.
 *
 * `credentials: 'include'` on every request: auth is entirely cookie-based
 * (HttpOnly access/refresh cookies set by the backend), so the browser must
 * be told to send/accept cookies across the frontend/backend origins in dev
 * (localhost:3000 -> localhost:4000).
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

/** The `err instanceof ApiError ? err.message : "Something went wrong..."` fallback every page's catch block needs. */
export function toErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}

/**
 * Maps a 422 `VALIDATION_ERROR`'s `details` (error-mappers.ts's
 * formatZodIssues: `{path, message}[]`, `path` dotted for a nested field)
 * onto a form's own flat field keys via `pathMap`, so a backend validation
 * error highlights the actual input the user needs to fix. Every other
 * error falls back to the same form-level message `toErrorMessage` gives.
 *
 * Shared by every form on a per-field-error model (Edit Wedding, Create
 * Event) rather than each redefining this — `pathMap` is the only thing
 * that differs between them.
 */
export function mapValidationError(
  err: unknown,
  pathMap: Record<string, string> = {},
): { fieldErrors: Record<string, string>; message: string } {
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.details as { path?: unknown; message?: unknown }[]) {
      if (typeof issue?.path !== "string" || typeof issue.message !== "string") continue;
      const key = pathMap[issue.path] ?? issue.path;
      // Several backend paths can collapse onto one form key (e.g. both
      // location.latitude and location.longitude only have one slot to show
      // an error in) — append rather than overwrite, so two simultaneous
      // issues on the same key don't silently drop one of them.
      fieldErrors[key] = fieldErrors[key] ? `${fieldErrors[key]} ${issue.message}` : issue.message;
    }
    return { fieldErrors, message: err.message };
  }
  return { fieldErrors: {}, message: toErrorMessage(err) };
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

function hasSuccessFlag(value: unknown): value is { success: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).success === "boolean"
  );
}

function hasWellFormedError(
  value: unknown,
): value is { error: { code: string; message: string; details?: unknown } } {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as Record<string, unknown>;
  return typeof code === "string" && typeof message === "string";
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }

  // DELETE /weddings/:weddingId/members/:memberId (removeMember() below)
  // returns 204 — res.json() throws a SyntaxError on an empty body, which
  // would otherwise be misreported as a malformed response even though the
  // request actually succeeded.
  if (res.status === 204) {
    return undefined as T;
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (err) {
    // A SyntaxError means a response came back but its body wasn't valid
    // JSON — a real server-side problem. Anything else reading the body
    // (e.g. the connection dropping mid-stream, after fetch() itself
    // already resolved) is the same "couldn't reach the server" situation
    // the pre-fetch catch above handles, not a malformed-response one.
    if (err instanceof SyntaxError) {
      throw new ApiError("INTERNAL_SERVER_ERROR", "The server returned a malformed response.");
    }
    throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.");
  }

  if (!hasSuccessFlag(raw)) {
    throw new ApiError("INTERNAL_SERVER_ERROR", "The server returned an unexpected response.");
  }

  if (!raw.success) {
    if (!hasWellFormedError(raw)) {
      throw new ApiError(
        "INTERNAL_SERVER_ERROR",
        "The server returned a malformed error response.",
      );
    }
    throw new ApiError(raw.error.code, raw.error.message, raw.error.details);
  }

  return (raw as SuccessEnvelope<T>).data;
}

export interface User {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Wedding {
  id: string;
  name: string;
  slug: string;
  couple: { partnerOneName: string; partnerTwoName: string };
  weddingDate: string;
  timezone: string;
  location: { address: string; latitude: number; longitude: number };
  // Optional and often absent from the response entirely (the backend omits
  // the key rather than sending null when it was never set) — not every
  // wedding has one.
  description?: string;
  language: string;
  status: "ACTIVE" | "ARCHIVED";
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export function registerUser(body: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: User }> {
  return apiFetch("/auth/register", { method: "POST", body: JSON.stringify(body) });
}

export function loginUser(body: { email: string; password: string }): Promise<{ user: User }> {
  return apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) });
}

export function logoutUser(): Promise<Record<string, never>> {
  return apiFetch("/auth/logout", { method: "POST" });
}

export function forgotPassword(email: string): Promise<{ message: string; devResetUrl?: string }> {
  return apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function getCurrentUser(): Promise<{ user: User }> {
  return apiFetch("/auth/me");
}

export function createWedding(body: {
  name: string;
  couple: { partnerOneName: string; partnerTwoName: string };
  weddingDate: string;
  timezone: string;
  location: { address: string; latitude: number; longitude: number };
  description?: string;
  language?: string;
}): Promise<{ wedding: Wedding }> {
  return apiFetch("/weddings", { method: "POST", body: JSON.stringify(body) });
}

export function listMyWeddings(): Promise<{ items: Wedding[]; pagination: Pagination }> {
  return apiFetch("/weddings");
}

export function getWedding(weddingId: string): Promise<{ wedding: Wedding }> {
  return apiFetch(`/weddings/${weddingId}`);
}

/**
 * Mirrors the backend's updateWeddingBodySchema: every field is independently
 * optional, but `couple`/`location`, if sent at all, must be given in full
 * (not deep-merged) — see weddings.validation.ts. `slug`/`language`/every
 * system-controlled field are deliberately absent; the backend's `.strict()`
 * would reject them outright rather than silently ignore them.
 */
export interface UpdateWeddingBody {
  name?: string;
  description?: string;
  couple?: { partnerOneName: string; partnerTwoName: string };
  weddingDate?: string;
  timezone?: string;
  location?: { address: string; latitude: number; longitude: number };
}

export function updateWedding(
  weddingId: string,
  body: UpdateWeddingBody,
): Promise<{ wedding: Wedding }> {
  return apiFetch(`/weddings/${weddingId}`, { method: "PATCH", body: JSON.stringify(body) });
}

export type MemberRole = "ADMIN" | "MANAGER";

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  createdAt: string;
  updatedAt: string;
}

export function listMembers(
  weddingId: string,
  limit = 100,
): Promise<{ items: Member[]; pagination: Pagination }> {
  return apiFetch(`/weddings/${weddingId}/members?limit=${limit}`);
}

export function addMember(
  weddingId: string,
  body: { email: string; role: MemberRole },
): Promise<{ member: Member }> {
  return apiFetch(`/weddings/${weddingId}/members`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateMemberRole(
  weddingId: string,
  memberId: string,
  role: MemberRole,
): Promise<{ member: Member }> {
  return apiFetch(`/weddings/${weddingId}/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeMember(weddingId: string, memberId: string): Promise<undefined> {
  return apiFetch(`/weddings/${weddingId}/members/${memberId}`, { method: "DELETE" });
}

export type EventStatus = "DRAFT" | "ACTIVE" | "CANCELLED" | "ARCHIVED";

export interface EventVenue {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
}

// Named `WeddingEvent`, not `Event` — the DOM's own global `Event` type would
// otherwise be shadowed everywhere this is imported.
export interface WeddingEvent {
  id: string;
  weddingId: string;
  name: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  description?: string;
  venue?: EventVenue;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export function getEvents(
  weddingId: string,
  limit = 100,
): Promise<{ items: WeddingEvent[]; pagination: Pagination }> {
  return apiFetch(`/weddings/${weddingId}/events?limit=${limit}`);
}

/**
 * Mirrors createEventBodySchema: `startsAt`/`endsAt` are full ISO 8601
 * date-times with an explicit offset (see lib/date.ts's
 * combineDateTimeWithOffset, which builds these from the form's separate
 * date/time/timezone fields) — there's no server-side combination step for
 * events the way there is for a wedding's own `weddingDate`.
 */
export interface CreateEventBody {
  name: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  description?: string;
  venue?: { name?: string; address?: string };
}

export function createEvent(
  weddingId: string,
  body: CreateEventBody,
): Promise<{ event: WeddingEvent }> {
  return apiFetch(`/weddings/${weddingId}/events`, { method: "POST", body: JSON.stringify(body) });
}

export function getEvent(weddingId: string, eventId: string): Promise<{ event: WeddingEvent }> {
  return apiFetch(`/weddings/${weddingId}/events/${eventId}`);
}

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED";

export interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  isExpired: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationActionResult {
  invitation: Invitation;
  /** False when no email provider is configured (or the send itself failed) — the invitation was still created/refreshed; `devInviteUrl` lets local dev proceed without a real inbox. */
  emailSent: boolean;
  devInviteUrl?: string;
}

/** Mirrors createInvitationBodySchema — works for an email with no account yet, unlike addMember() above. */
export function createInvitation(
  weddingId: string,
  body: { email: string; role: MemberRole },
): Promise<InvitationActionResult> {
  return apiFetch(`/weddings/${weddingId}/invitations`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listInvitations(
  weddingId: string,
  limit = 100,
): Promise<{ items: Invitation[]; pagination: Pagination }> {
  return apiFetch(`/weddings/${weddingId}/invitations?limit=${limit}`);
}

export function revokeInvitation(weddingId: string, invitationId: string): Promise<undefined> {
  return apiFetch(`/weddings/${weddingId}/invitations/${invitationId}`, { method: "DELETE" });
}

export function resendInvitation(
  weddingId: string,
  invitationId: string,
): Promise<InvitationActionResult> {
  return apiFetch(`/weddings/${weddingId}/invitations/${invitationId}/resend`, { method: "POST" });
}

export interface InvitationPreview {
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  isExpired: boolean;
  weddingId: string;
  weddingName: string;
  couple: { partnerOneName: string; partnerTwoName: string };
  invitedByName: string;
}

/**
 * Public — no auth required, the same way /reset-password works from a
 * token alone. POST with the token in the body (not a GET with it in the
 * URL) so it never ends up written to the backend's access logs.
 */
export function previewInvitation(token: string): Promise<{ invitation: InvitationPreview }> {
  return apiFetch("/invitations/preview", { method: "POST", body: JSON.stringify({ token }) });
}

/** Requires auth — the caller must already be signed in with the exact email the invitation was addressed to. */
export function acceptInvitation(token: string): Promise<{ wedding: Wedding; role: MemberRole }> {
  return apiFetch("/invitations/accept", { method: "POST", body: JSON.stringify({ token }) });
}

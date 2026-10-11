/**
 * Each wedding carries its own IANA timezone, and two weddings shown on the
 * same page can have different ones — `new Intl.DateTimeFormat(locale)`
 * without a `timeZone` option would silently use the viewer's local zone
 * instead, so every call site must pass the wedding's own `timezone`.
 *
 * Falls back to the bare YYYY-MM-DD date for a timezone the viewer's
 * browser can't construct, rather than throwing — every other helper in
 * this file already has this same guard (the backend's Node/ICU build and a
 * given browser's Intl implementation aren't guaranteed to agree on every
 * zone name); this one didn't, and since it's called directly during render
 * with no try/catch at the call site, that gap meant an unrecognised
 * timezone crashed the whole page.
 */
export function formatWeddingDate(weddingDateIso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    }).format(new Date(weddingDateIso));
  } catch {
    return weddingDateIso.slice(0, 10);
  }
}

/**
 * The YYYY-MM-DD calendar date `date` represents in `timezone` — the one
 * mechanism every calendar-day-diff/prefill helper below builds on, so a
 * future correction (rounding, an invalid-timezone fallback) only has to be
 * made once. Throws for a timezone the environment's Intl can't construct;
 * callers decide how to handle that rather than this silently guessing.
 */
function toCalendarDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Both "now" and the wedding date are reduced to a calendar-day string in
 * the wedding's own timezone before diffing, rather than diffing raw
 * instants — otherwise the countdown would flip a day early or late for
 * anyone viewing from a different timezone than the wedding's own. Returns
 * null for a timezone the browser's Intl can't construct, rather than
 * throwing — a stored `timezone` passed backend validation when it was
 * saved, but the backend (Node/ICU) and a given viewer's browser aren't
 * guaranteed to agree on every zone name, and every call site renders this
 * directly rather than wrapping it itself.
 */
export function daysUntilWedding(weddingDateIso: string, timezone: string): number | null {
  try {
    const todayUtc = Date.parse(`${toCalendarDateString(new Date(), timezone)}T00:00:00Z`);
    const weddingUtc = Date.parse(
      `${toCalendarDateString(new Date(weddingDateIso), timezone)}T00:00:00Z`,
    );
    return Math.round((weddingUtc - todayUtc) / 86_400_000);
  } catch {
    return null;
  }
}

export function countdownLabel(days: number): string {
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "1 day to go";
  if (days === 0) return "Today!";
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
}

/**
 * The inverse of daysUntilWedding/formatWeddingDate: takes a wedding's stored
 * absolute instant and returns the YYYY-MM-DD calendar date it represents in
 * the wedding's own timezone — the right shape to prefill an
 * `<input type="date">` for editing (the backend's PATCH endpoint expects the
 * same bare date-only string back, combining it with the timezone itself).
 * Falls back to "" (an empty, still-valid date-input value) for a timezone
 * the browser can't construct, rather than throwing — `wedding.timezone`
 * passed backend validation when it was saved, but the backend (Node/ICU)
 * and a given browser's Intl implementation aren't guaranteed to agree on
 * every zone name, and this runs during page load, not inside a try/catch.
 */
export function toLocalDateInputValue(weddingDateIso: string, timezone: string): string {
  try {
    return toCalendarDateString(new Date(weddingDateIso), timezone);
  } catch {
    return "";
  }
}

/**
 * Live countdown preview for the Edit Wedding form: same calendar-day-diff
 * approach as daysUntilWedding, but starting directly from a raw
 * `<input type="date">` value instead of a stored ISO instant, so the
 * countdown can update as the user types, before any save happens. Returns
 * null for an empty or not-yet-valid date, or a timezone the browser can't
 * construct (the user may still be mid-edit on that field too).
 */
export function daysUntilDateInZone(dateInput: string, timezone: string): number | null {
  if (!dateInput) return null;
  try {
    const todayUtc = Date.parse(`${toCalendarDateString(new Date(), timezone)}T00:00:00Z`);
    const targetUtc = Date.parse(`${dateInput}T00:00:00Z`);
    if (Number.isNaN(targetUtc)) return null;
    return Math.round((targetUtc - todayUtc) / 86_400_000);
  } catch {
    return null;
  }
}

/** Current local time in `timezone`, for a live "venue local time" hint — null if the browser can't construct that timezone (e.g. mid-edit on a free-text field). */
export function formatCurrentTimeInZone(timezone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(new Date());
  } catch {
    return null;
  }
}

/** `Intl`'s DST-aware UTC offset for `timezone` at `instant`, as "+05:30"/"-04:00"/"" (never throws past its own call site — propagates whatever `Intl` throws, same as this file's other helpers that wrap their own calls). */
function offsetAt(timezone: string, instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  return parts.find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") ?? "";
}

/**
 * The backend's Events API (unlike Weddings') takes `startsAt`/`endsAt` as a
 * single ISO 8601 string with an explicit numeric offset — there's no
 * server-side date+timezone combination step to lean on here, so the Create
 * Event form has to build that string itself from separate `<input
 * type="date">`/`<input type="time">` fields plus a free-text timezone.
 *
 * `Intl`'s `longOffset` gives the real, DST-aware UTC offset for `timezone`
 * at a given instant — but computing it requires an instant, and the whole
 * point here is we don't have the real one yet (that's what we're building).
 * Two-step probe: first treat the wall-clock date/time as if it were UTC to
 * get *a* instant, and read the zone's offset there — call it `offset1`.
 * Combining the original wall-clock with `offset1` already lands much closer
 * to the true instant (off by at most a DST shift, typically under two
 * hours, rather than the full zone offset, which can be most of a day for
 * zones far from UTC). Re-probing the offset *there* (`offset2`) and
 * recombining removes essentially all of that remaining error — the only
 * case this still can't resolve is a wall-clock time that falls inside an
 * actual DST transition's "skipped" gap (e.g. 2:15 AM on a spring-forward
 * night, which isn't a real local time in that zone to begin with — no
 * convention resolves that cleanly, including full timezone libraries).
 *
 * Returns null for an empty date/time or a timezone the browser can't
 * construct, rather than throwing — this runs on every keystroke, not
 * inside a try/catch at the call site.
 */
export function combineDateTimeWithOffset(
  dateStr: string,
  timeStr: string,
  timezone: string,
): string | null {
  if (!dateStr || !timeStr) return null;
  try {
    const probe1 = new Date(`${dateStr}T${timeStr}:00Z`);
    if (Number.isNaN(probe1.getTime())) return null;
    const offset1 = offsetAt(timezone, probe1);
    if (!offset1) return `${dateStr}T${timeStr}:00Z`;
    const candidate = new Date(`${dateStr}T${timeStr}:00${offset1}`);
    const offset2 = offsetAt(timezone, candidate);
    return `${dateStr}T${timeStr}:00${offset2 || offset1}`;
  } catch {
    return null;
  }
}

/** Adds (or subtracts) whole calendar days to a YYYY-MM-DD string, at noon UTC so the arithmetic itself can never cross a DST boundary. Used to roll an overnight event's end time onto the next calendar day. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The `{monthDay, weekday, year}` an event's `startsAt` falls on on in its own timezone — the date-marker module on an event card (e.g. "DEC 12" / "Sat" / "2026"). Null for a timezone the browser can't construct. */
export function formatEventDateParts(
  startsAtIso: string,
  timezone: string,
): { monthDay: string; weekday: string; year: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      weekday: "short",
      year: "numeric",
    }).formatToParts(new Date(startsAtIso));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return {
      monthDay: `${get("month")} ${get("day")}`.toUpperCase(),
      weekday: get("weekday"),
      year: get("year"),
    };
  } catch {
    return null;
  }
}

/** "7:00 PM", or "7:00 PM – 10:00 PM" when `endsAtIso` is given — both in the event's own timezone, never the viewer's. Empty string for a timezone the browser can't construct. */
export function formatEventTimeRange(
  startsAtIso: string,
  endsAtIso: string | undefined,
  timezone: string,
): string {
  try {
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const start = timeFormatter.format(new Date(startsAtIso));
    if (!endsAtIso) return start;
    return `${start} – ${timeFormatter.format(new Date(endsAtIso))}`;
  } catch {
    return "";
  }
}

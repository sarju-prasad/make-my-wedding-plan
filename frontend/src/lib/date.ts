/**
 * Each wedding carries its own IANA timezone, and two weddings shown on the
 * same page can have different ones — `new Intl.DateTimeFormat(locale)`
 * without a `timeZone` option would silently use the viewer's local zone
 * instead, so every call site must pass the wedding's own `timezone`.
 */
export function formatWeddingDate(weddingDateIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(weddingDateIso));
}

/**
 * Both "now" and the wedding date are reduced to a calendar-day string in
 * the wedding's own timezone before diffing, rather than diffing raw
 * instants — otherwise the countdown would flip a day early or late for
 * anyone viewing from a different timezone than the wedding's own.
 */
export function daysUntilWedding(weddingDateIso: string, timezone: string): number {
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayUtc = Date.parse(`${dayFormatter.format(new Date())}T00:00:00Z`);
  const weddingUtc = Date.parse(`${dayFormatter.format(new Date(weddingDateIso))}T00:00:00Z`);
  return Math.round((weddingUtc - todayUtc) / 86_400_000);
}

export function countdownLabel(days: number): string {
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "1 day to go";
  if (days === 0) return "Today!";
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
}

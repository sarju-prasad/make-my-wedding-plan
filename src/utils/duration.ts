/**
 * Parses the short duration strings used throughout env.ts (JWT_ACCESS_TTL,
 * GUEST_SESSION_TTL, …) into milliseconds, for callers — like cookie maxAge
 * — that need a number rather than a "15m"-style string.
 *
 * Deliberately hand-rolled rather than pulling in a dependency for
 * single-unit strings this small; supports exactly the units the env schema
 * documents: seconds, minutes, hours, days.
 */
const UNIT_TO_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
} as const satisfies Record<string, number>;

type DurationUnit = keyof typeof UNIT_TO_MS;

function isDurationUnit(value: string): value is DurationUnit {
  return value in UNIT_TO_MS;
}

const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;

export function parseDurationMs(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  const amount = match?.[1];
  const unit = match?.[2];

  if (!amount || !unit || !isDurationUnit(unit)) {
    throw new Error(`Invalid duration "${value}" — expected a format like "15m", "2h", or "7d".`);
  }

  return Number(amount) * UNIT_TO_MS[unit];
}

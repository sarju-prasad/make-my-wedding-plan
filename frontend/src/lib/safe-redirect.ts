// An arbitrary, fixed base — not the app's real origin. It only exists so
// the URL parser has something to resolve `next` against; it's never
// compared to anything outside this function. Using a fixed constant
// (rather than `window.location.origin`) keeps this safe to call during SSR,
// where there is no `window`, and keeps the result identical between server
// and client so hydration can't mismatch on it.
const RESOLUTION_BASE = "http://localhost";

/**
 * Resolves a `?next=` style redirect target into a same-origin relative
 * path safe to pass to router.push() — or `fallback` if it isn't one.
 *
 * A string-prefix check (reject anything starting with `//`) isn't enough:
 * a raw control character right after the leading slash (e.g. a literal tab,
 * "/\t/evil.example") still passes "starts with / but not //", but a URL
 * parser strips tab/newline/CR during normalization, turning it into
 * "//evil.example" — a protocol-relative URL that resolves off-origin.
 * Verified directly: `new URL("/\t/evil.example", base).origin` is
 * "http://evil.example", not `base`.
 *
 * Resolving with the real URL parser and checking the RESULT's origin
 * closes this whole bypass class at once, rather than trying to enumerate
 * every normalization trick by hand — and the value passed onward is
 * rebuilt from the parsed pathname/search/hash, never the original string.
 * `next` resolving to anything other than RESOLUTION_BASE means it carried
 * its own scheme/host (e.g. "https://evil.example", "//evil.example"),
 * which is exactly what must be rejected regardless of what the app's real
 * deployed origin is.
 */
export function resolveSafeRedirect(
  next: string | null | undefined,
  fallback = "/weddings",
): string {
  if (!next) return fallback;

  try {
    const url = new URL(next, RESOLUTION_BASE);
    if (url.origin !== RESOLUTION_BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Guards a `?next=` style redirect target against sending the user off-site.
 * Must start with `/` (a relative path) but not `//` (a protocol-relative
 * URL, which a browser still resolves as external — `//evil.example` is as
 * much an open redirect as `https://evil.example`).
 */
export function isSafeRedirect(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

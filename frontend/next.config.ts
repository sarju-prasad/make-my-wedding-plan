import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Applies to every route, including /reset-password and
        // /invitations/[token] — both carry a single-use secret token in
        // the URL (a query param and a path segment, respectively).
        // Without an explicit Referrer-Policy, a browser's default can send
        // the full URL — token included — as the Referer header to any
        // cross-origin resource the page loads (Google Fonts, the Google
        // Maps script VenueAddressField.tsx pulls in). strict-origin-when-
        // cross-origin sends only the origin cross-origin (never the path
        // or query), so the token never leaves this app, while still
        // sending the full referrer for same-origin requests and remaining
        // compatible with a referrer-restricted Google Maps API key, which
        // same-origin would have broken by omitting the referrer entirely.
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Both forms of clickjacking protection: X-Frame-Options for
          // older browsers, frame-ancestors (CSP) for the ones that honour
          // it — this is a private, invitation-only app with no reason any
          // other site should ever embed it in a frame (e.g. a decoy page
          // tricking a signed-in user into an invisible "Accept invitation"
          // click). Scoped to just this one directive rather than a full
          // CSP: script-src/style-src rules for Next's own injected scripts
          // plus Google Fonts/Maps need their own careful pass with real
          // browser verification, not a rushed addition here.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;

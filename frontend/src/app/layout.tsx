import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Headline font from the Stitch design system spec. Keep weights at
// 400–500 only — the spec explicitly warns against heavier weights, which
// blur Playfair Display's serif detail.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Make My Wedding Plan",
  description:
    "A private, invitation-only wedding management platform for Indian weddings — plan together, invite guests privately, and preserve the memories.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfairDisplay.variable} ${plusJakartaSans.variable}`}
      // Browser extensions (e.g. an Ember-inspector-style devtool injecting
      // data-ember-extension, ColorZilla injecting cz-shortcut-listen on
      // <body> below) add attributes to <html>/<body> before React
      // hydrates. React correctly flags the mismatch since it can't know
      // the difference from a real bug — suppressHydrationWarning is React's
      // own documented escape hatch for exactly this "injected by something
      // outside my control" case. Scoped to just these two tags, so it
      // won't hide a real mismatch anywhere else in the tree.
      suppressHydrationWarning
    >
      <head>
        {/* Material Symbols Outlined — the icon font the Stitch export uses
            via `<span class="material-symbols-outlined">`. Loaded the same
            way the export itself loads it (a stylesheet link, not
            next/font: it's a variable icon font, not a text typeface). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

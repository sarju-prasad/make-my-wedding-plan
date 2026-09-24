import Image from "next/image";
import logoWordmark from "../../../public/images/logo-wordmark.png";
import { Icon } from "./Icon";

/**
 * Nav items and CTAs all link to `#` in the real Stitch export — it's a
 * design-tool preview, not a wired app, so it never assigned real routes.
 * Kept literal rather than guessed at real hrefs.
 */
const NAV_LINKS = [
  { path: "how-it-works", label: "How it works" },
  { path: "features", label: "Features" },
  { path: "planning-suite", label: "Planning Suite" },
  { path: "privacy", label: "Privacy" },
  { path: "sign-in", label: "Sign in" },
] as const;

export function Header() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-surface/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-gutter px-margin-mobile lg:px-margin">
        <div className="flex items-center gap-space-md">
          <Image
            src={logoWordmark}
            alt="Large high-visibility brand logo lockup with burgundy M emblem and prominent bold text 'MAKE MY WEDDING PLAN' and subtitle 'PRIVATE WEDDING PLATFORM'"
            className="h-8 w-auto object-contain"
          />
          <div className="hidden flex-col sm:flex">
            <span className="font-headline-sm text-headline-sm leading-none tracking-tight text-primary">
              MAKE MY WEDDING PLAN
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
              Private Wedding Platform
            </span>
          </div>
        </div>

        <nav className="hidden items-center gap-space-lg lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.path}
              href="#"
              data-path={link.path}
              className="font-label-lg text-label-lg text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-space-md">
          <a
            href="#"
            data-path="plan-your-wedding"
            className="hidden items-center justify-center rounded-lg bg-primary-container px-space-md py-space-sm font-label-lg text-label-lg text-on-primary shadow-[0_1px_3px_rgba(26,25,23,0.03)] transition-all hover:bg-secondary sm:inline-flex"
          >
            Plan your wedding
          </a>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Icon name="person" className="text-[18px] text-on-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}

import { Icon } from "./Icon";

const FOOTER_COLUMNS = [
  {
    title: "Planning",
    links: ["Ceremonies Itinerary", "Budget Allocation", "Vendor Curation", "Logistics Charting"],
  },
  {
    title: "Family & Guests",
    links: ["Family Workspace", "Guest Experience", "RSVP Matrix", "Stay & Travel Desk"],
  },
  {
    title: "Private Platform",
    links: ["Private Websites", "Trust & Privacy", "Security Protocols", "Concierge Support"],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-space-xl w-full bg-surface-container-low">
      <div className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl lg:px-margin">
        <div className="mb-space-xl grid grid-cols-1 gap-space-xl md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-space-md pr-space-lg lg:col-span-2">
            <div className="flex items-center gap-space-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <span className="font-headline-sm text-[15px] leading-none font-bold text-on-primary">
                  M
                </span>
              </div>
              <span className="font-headline-sm text-headline-sm tracking-tight text-primary">
                Make My Wedding Plan
              </span>
            </div>
            <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">
              The private invitation-only wedding coordination architecture designed for multi-day
              ceremonies, family councils, and curated guest experiences.
            </p>
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
              <Icon name="lock" className="text-[16px] text-tertiary" />
              <span>End-to-end encrypted family workspaces</span>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-space-sm">
              <span className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider">
                {column.title}
              </span>
              {column.links.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="font-body-md text-body-md text-on-surface-variant transition-colors hover:text-on-surface"
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-space-md border-t border-surface-container-high pt-space-lg font-body-sm text-body-sm text-on-surface-variant md:flex-row">
          <div className="flex items-center gap-space-xs">
            <Icon name="verified_user" className="text-[16px] text-tertiary" />
            <span>
              All guest records and financial allocations are strictly private. Zero public
              directory listing.
            </span>
          </div>
          <span>
            &copy; {new Date().getFullYear()} Make My Wedding Plan. Private Wedding Platform. All
            rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}

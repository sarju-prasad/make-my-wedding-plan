"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/marketing/Icon";

interface NavItem {
  key: string;
  label: string;
  icon: string;
}

// Matches the approved Stitch design's full module list ("Wedding Command
// Center"). Overview and Events are real routes; every other module is
// unbuilt (see doc/project_status.md), so each shows "Coming soon" instead
// of navigating anywhere or rendering fabricated data.
const NAV_ITEMS: NavItem[] = [
  { key: "guests", label: "Guests", icon: "group" },
  { key: "invitations", label: "Invitations", icon: "mail" },
  { key: "rsvp", label: "RSVP", icon: "how_to_reg" },
  { key: "tasks", label: "Tasks", icon: "checklist" },
  { key: "vendors", label: "Vendors", icon: "storefront" },
  { key: "expenses", label: "Expenses", icon: "account_balance_wallet" },
  { key: "website", label: "Wedding Website", icon: "language" },
  { key: "gallery", label: "Gallery", icon: "photo_library" },
  { key: "announcements", label: "Announcements", icon: "campaign" },
  { key: "livestream", label: "Livestream", icon: "videocam" },
];

const SECONDARY_ITEMS: NavItem[] = [
  { key: "settings", label: "Settings", icon: "settings" },
  { key: "support", label: "Help & Support", icon: "contact_support" },
];

function ComingSoonNavItem({ item }: { item: NavItem }) {
  const [announced, setAnnounced] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setAnnounced(true)}
      aria-describedby={announced ? `${item.key}-coming-soon` : undefined}
      className="flex w-full items-center gap-space-sm rounded-lg px-space-md py-2.5 text-left text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface"
    >
      <Icon name={item.icon} className="text-[20px]" />
      <span className="font-label-lg text-label-lg flex-1">{item.label}</span>
      {announced && (
        <span
          id={`${item.key}-coming-soon`}
          role="status"
          className="font-label-sm text-label-sm text-primary"
        >
          Soon
        </span>
      )}
    </button>
  );
}

/** A real (not "coming soon") sidebar nav link, styled to match the Overview link's active/inactive treatment. */
function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex items-center gap-space-sm rounded-lg bg-primary-container px-space-md py-2.5 font-bold text-on-primary shadow-[0_1px_3px_rgba(26,25,23,0.04)] transition-all"
          : "flex items-center gap-space-sm rounded-lg px-space-md py-2.5 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface"
      }
    >
      <Icon name={icon} className="text-[20px]" />
      <span>{label}</span>
    </Link>
  );
}

export function WeddingSidebar({ weddingId }: { weddingId: string }) {
  const pathname = usePathname();
  const overviewHref = `/weddings/${weddingId}`;
  const eventsHref = `/weddings/${weddingId}/events`;
  // startsWith, not ===, for Events — /new and /[eventId] sub-routes should
  // still show Events as the active section. Overview only matches its own
  // exact path, so a sub-route like /edit correctly leaves both unhighlighted
  // rather than (as before this had any route-awareness at all) always
  // showing Overview as active regardless of where you actually are.
  const isEventsActive = pathname?.startsWith(eventsHref) ?? false;
  const isOverviewActive = pathname === overviewHref;

  return (
    <aside className="fixed top-0 left-0 z-40 hidden h-full w-72 flex-col bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:flex">
      <div className="flex h-20 items-center gap-space-sm bg-surface-container-low/50 px-space-lg">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="font-headline-sm text-[15px] leading-none font-bold text-on-primary">
            M
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-bold tracking-wider text-primary uppercase">
            Make My Wedding Plan
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Private Wedding Platform
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-space-md py-space-sm">
        <div className="mb-space-xs px-space-sm py-space-xs">
          <span className="font-label-sm text-label-sm tracking-widest text-outline uppercase">
            Workspace Modules
          </span>
        </div>
        <nav className="space-y-1">
          <NavLink
            href={overviewHref}
            icon="grid_view"
            label="Overview"
            active={isOverviewActive}
          />
          <NavLink
            href={eventsHref}
            icon="event_available"
            label="Events"
            active={isEventsActive}
          />
          {NAV_ITEMS.map((item) => (
            <ComingSoonNavItem key={item.key} item={item} />
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-md">
        <nav className="flex flex-col space-y-0.5">
          {SECONDARY_ITEMS.map((item) => (
            <ComingSoonNavItem key={item.key} item={item} />
          ))}
        </nav>
      </div>
    </aside>
  );
}

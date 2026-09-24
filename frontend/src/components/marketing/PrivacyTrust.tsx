import { Icon } from "./Icon";

const PILLARS = [
  {
    icon: "search_off",
    title: "Zero Search Indexing",
    description:
      "Strict `noindex` directives ensure your wedding web pages and photo galleries never appear on Google, Yahoo, or Bing searches.",
  },
  {
    icon: "vpn_key",
    title: "Token-Based Guest Pass",
    description:
      "No public discovery links. Every guest receives a single unique cryptographic pass that authorizes only their family cohort.",
  },
  {
    icon: "shield",
    title: "Encrypted Data Vault",
    description:
      "Passport details, hotel room assignments, and financial budgets are stored with enterprise AES-256 data encryption at rest.",
  },
  {
    icon: "download_for_offline",
    title: "Permanent Data Ownership",
    description:
      "Export your complete guest records, high-res photos, and vendor ledger at any point in one clean archive download.",
  },
] as const;

export function PrivacyTrust() {
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin lg:py-28">
      <div className="flex max-w-2xl flex-col gap-space-xs">
        <span className="font-label-sm text-label-sm font-semibold text-primary uppercase tracking-widest">
          Trust & Discretion
        </span>
        <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
          Private by design.
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Your celebration is an intimate sanctuary for family and loved ones. We treat your guest
          directory and personal media with sovereign discretion.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
              <Icon name={pillar.icon} className="text-[22px]" />
            </div>
            <h4 className="font-headline-sm text-[1.125rem] text-on-surface">{pillar.title}</h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {pillar.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

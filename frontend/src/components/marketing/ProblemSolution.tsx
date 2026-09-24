import { Icon } from "./Icon";

const FRAGMENTED = [
  {
    icon: "chat",
    title: "14 WhatsApp Groups with Misaligned Threads",
    description:
      "Aunties, vendors, and choreographers talking over conflicting flight arrival plans.",
  },
  {
    icon: "table_rows",
    title: "Disconnected Spreadsheets with Version Conflicts",
    description:
      '"Master_Guestlist_Final_v3_ArjunEdits.xlsx" missing crucial allergy and dietary notes.',
  },
  {
    icon: "warning",
    title: "Undocumented Vendor Deliverables & Deposit Dates",
    description:
      "Verbal assurances forgotten on the wedding morning with zero written accountability.",
  },
  {
    icon: "cloud_off",
    title: "Buried Photos in Expired WeTransfer & Drive Links",
    description:
      "Unorganized low-res guest snapshots scattered across social media without consent.",
  },
] as const;

const UNIFIED = [
  {
    icon: "checklist",
    title: "Single Live Timeline & Multi-Event Itinerary",
    description: "Every ceremony, muhurat, setup time, and soundcheck mapped down to the minute.",
  },
  {
    icon: "badge",
    title: "Clear Family Delegation Councils",
    description:
      "Specific accountability without micro-management. Role-based visibility for key family members.",
  },
  {
    icon: "lock_person",
    title: "Audience-Tailored Guest Portals",
    description:
      "Guests only view events, dress codes, and logistics tailored to their individual invitation pass.",
  },
  {
    icon: "photo_library",
    title: "Private High-Resolution Memory Vault",
    description:
      "Instant QR upload stations for guest captures paired with official photographer albums.",
  },
] as const;

export function ProblemSolution() {
  return (
    <section className="w-full bg-surface-container-low py-space-xl">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-space-xl px-margin-mobile lg:px-margin">
        <div className="flex max-w-2xl flex-col gap-space-xs">
          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase tracking-widest">
            The Core Problem
          </span>
          <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
            Wedding planning gets complicated fast.
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Multi-day celebrations require hundreds of coordinated decisions across multiple
            families, external vendors, and outstation guests. Fragmentation is where stress breeds.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-2">
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center justify-between pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-error" />
                <span className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider">
                  The Fragmented Approach
                </span>
              </div>
              <span className="rounded bg-error-container/40 px-2 py-0.5 font-label-sm text-label-sm text-error">
                High Stress
              </span>
            </div>
            <div className="flex flex-col gap-space-sm">
              {FRAGMENTED.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-space-sm rounded-lg bg-surface-container-low p-space-sm opacity-90"
                >
                  <Icon name={item.icon} className="mt-0.5 text-[20px] text-outline" />
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">
                      {item.title}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {item.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center justify-between pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-container" />
                <span className="font-label-lg text-label-lg text-on-surface uppercase tracking-wider">
                  Make My Wedding Plan
                </span>
              </div>
              <span className="rounded bg-primary-fixed px-2 py-0.5 font-label-sm text-label-sm text-primary">
                Unified Peace of Mind
              </span>
            </div>
            <div className="flex flex-col gap-space-sm">
              {UNIFIED.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-space-sm rounded-lg bg-surface-container p-space-sm"
                >
                  <Icon name={item.icon} className="mt-0.5 text-[20px] text-primary" />
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">
                      {item.title}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {item.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Icon } from "./Icon";

const MODULES = [
  {
    icon: "calendar_month",
    title: "Multi-Event Runsheets",
    description:
      "Sequence Mehndi, Haldi, Sangeet, Vedic Pheras, and Reception with distinct timelines, vendor call-times, and minute-by-minute cues.",
    rows: [
      { label: "Pheras Sacred Muhurat", value: "11:18 AM Sharp", accent: true },
      { label: "Baraat Assembly", value: "10:00 AM West Gate" },
    ],
  },
  {
    icon: "hotel",
    title: "Smart Stay & Travel Desk",
    description:
      "Coordinate hotel room inventory, outstation arrival flights, chauffeur dispatches, and specific dietary needs in a single table.",
    rows: [
      { label: "Rooms Blocked", value: "94 / 110 Occupied" },
      { label: "Airport Shuttles", value: "12 Scheduled Runs" },
    ],
  },
  {
    icon: "handshake",
    title: "Vendor Agreements & SLAs",
    description:
      "Store contracts, sound permits, deposit schedules, and emergency contacts for photographers, florists, decor teams, and caterers.",
    rows: [
      { label: "Sound & Light Setup", value: "Deposit Cleared", accent: true },
      { label: "Floral Installations", value: "Final Walkthrough Fri" },
    ],
  },
] as const;

export function WorkspaceModules() {
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin lg:py-28">
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-space-xs">
          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase tracking-widest">
            The Architecture
          </span>
          <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
            One wedding. One shared space.
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Built for scale, privacy, and calm execution. Manage the complexities of Indian and
            multi-day destination weddings without sensory overload.
          </p>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Central Database Status:
          </span>
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-primary">
            Active & Synced
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
          <div
            key={module.title}
            className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-col gap-space-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
                <Icon name={module.icon} className="text-[24px]" />
              </div>
              <h3 className="font-headline-sm text-headline-sm font-normal text-on-surface">
                {module.title}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {module.description}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container-low p-space-sm">
              {module.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-body-sm">
                  <span className="font-label-md text-label-md text-on-surface">{row.label}</span>
                  <span
                    className={`font-label-sm text-label-sm ${"accent" in row && row.accent ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

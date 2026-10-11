const STATUS_COLOR = {
  error: "text-error",
  primary: "text-primary",
  muted: "text-on-surface-variant",
} as const;

export function PlanningEssentials() {
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin lg:py-28">
      <div className="flex max-w-2xl flex-col gap-space-xs">
        <span className="font-label-sm text-label-sm font-semibold text-primary uppercase tracking-widest">
          Precision Suite
        </span>
        <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
          Command your planning essentials.
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Engineered to keep commitments transparent, budgets balanced, and vendor milestones on
          track.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-3">
        {/* Card 1: Milestones */}
        <div className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Milestones
              </span>
              <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                12 Pending
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-normal text-on-surface">
              Know what needs to happen next.
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Intelligent checklists grouped by timeline urgency. Overdue alerts flag critical
              actions before they impact celebration schedules.
            </p>
          </div>
          <div className="flex flex-col gap-space-xs">
            {[
              { label: "Pheras Floral Mandap Sign-off", status: "Due Today", tone: "error" },
              { label: "Distribute Invitation Boxes", status: "Done", tone: "primary" },
              { label: "Sangeet Track Master Mix Finalized", status: "In 4 Days", tone: "muted" },
            ].map((task) => (
              <div
                key={task.label}
                className="flex items-center justify-between rounded bg-surface-container-low p-space-xs text-body-sm"
              >
                <span className="font-label-md text-label-md text-on-surface">{task.label}</span>
                <span
                  className={`font-label-sm text-label-sm ${STATUS_COLOR[task.tone as keyof typeof STATUS_COLOR]}`}
                >
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Vendors */}
        <div className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Partners
              </span>
              <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                18 Curated
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-normal text-on-surface">
              Keep every vendor organized.
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Consolidate caterers, cinematographers, makeup artists, and sound technicians with
              direct call cards, scope documents, and delivery SLA dates.
            </p>
          </div>
          <div className="flex flex-col gap-space-xs">
            {[
              {
                name: "Kunal Verma Cinema",
                detail: "4K Drone & 6 Cameras",
                status: "Contract Signed",
              },
              {
                name: "Royal Mewari Catering",
                detail: "Tasting Session Completed",
                status: "Menu Approved",
              },
            ].map((vendor) => (
              <div
                key={vendor.name}
                className="flex items-center justify-between rounded bg-surface-container-low p-space-xs text-body-sm"
              >
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface">{vendor.name}</span>
                  <span className="text-[12px] text-on-surface-variant">{vendor.detail}</span>
                </div>
                <span className="font-label-sm text-label-sm text-primary">{vendor.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Expenses */}
        <div className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                Financials
              </span>
              <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                INR (&#8377;)
              </span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-normal text-on-surface">
              Keep wedding spending visible.
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Categorized allocations, upcoming deposit due dates, and paid receipts without looking
              like an intimidating enterprise accounting audit.
            </p>
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between pb-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                Committed vs Target
              </span>
              <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                80.4% Utilized
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary" style={{ width: "80.4%" }} />
            </div>
            <div className="flex items-center justify-between pt-2 text-body-sm text-on-surface-variant">
              <span>Next Due: Venue Balance</span>
              <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                &#8377;12.0L (in 15 days)
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

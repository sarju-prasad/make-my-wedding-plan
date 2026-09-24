import { Icon } from "./Icon";

const HIGHLIGHTS = [
  {
    icon: "verified",
    title: "Role-Based Family Visibility",
    description: "Parents, hospitality heads, and choreographers see strictly what they oversee.",
  },
  {
    icon: "notifications_active",
    title: "Zero Repetitive Status Calls",
    description:
      'Real-time status markers prevent the classic "did you confirm the bus?" confusion.',
  },
] as const;

const COUNCIL = [
  {
    initials: "AS",
    avatarBg: "bg-primary-fixed",
    avatarText: "text-primary",
    name: "Alok Sharma",
    role: "Father of the Bride",
    responsibility: "Rituals, Vedic Pandit Coordination & Safa Desks",
    status: "4 Tasks Active",
  },
  {
    initials: "PV",
    avatarBg: "bg-secondary-fixed",
    avatarText: "text-secondary",
    name: "Priya Verma",
    role: "Sister / Bridesmaid Lead",
    responsibility: "Sangeet Performances, Choreographer & Hampers",
    status: "Completed",
  },
  {
    initials: "RK",
    avatarBg: "bg-tertiary-fixed",
    avatarText: "text-tertiary",
    name: "Rajiv Kapoor",
    role: "Uncle / Logistics Head",
    responsibility: "Airport Hospitality Desk & Hotel Check-in Concierge",
    status: "In Progress",
  },
] as const;

export function FamilyCouncil() {
  return (
    <section className="w-full bg-surface-container-low py-space-xl">
      <div className="mx-auto max-w-[1440px] px-margin-mobile lg:px-margin">
        <div className="grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
          <div className="flex flex-col gap-space-md lg:col-span-5">
            <div className="inline-flex items-center gap-space-xs self-start rounded-full bg-surface-container-high px-space-md py-1 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              <span>Family Coordination Architecture</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
              Planning shouldn&apos;t be a one-person job.
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Distribute responsibilities across family members and core friends with custom role
              permissions. Give elders clarity on rituals while keeping financial contracts
              restricted to administrators.
            </p>
            <div className="flex flex-col gap-space-sm pt-space-xs">
              {HIGHLIGHTS.map((item) => (
                <div key={item.title} className="flex items-start gap-space-sm">
                  <Icon name={item.icon} className="mt-0.5 text-[20px] text-primary" />
                  <div className="flex flex-col">
                    <span className="font-label-lg text-label-lg text-on-surface">
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

          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-md lg:col-span-7">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Family Roles & Active Assignments
              </span>
              <span className="rounded bg-surface-container px-space-sm py-1 font-label-sm text-label-sm text-on-surface-variant">
                5 Active Leads
              </span>
            </div>

            <div className="flex flex-col gap-space-sm">
              {COUNCIL.map((member) => (
                <div
                  key={member.initials}
                  className="flex flex-col justify-between gap-space-xs rounded-lg bg-surface-container-low p-space-sm sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-space-sm">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${member.avatarBg} ${member.avatarText}`}
                    >
                      {member.initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-label-lg text-label-lg text-on-surface">
                        {member.name}{" "}
                        <span className="font-body-sm font-normal text-on-surface-variant">
                          ({member.role})
                        </span>
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {member.responsibility}
                      </span>
                    </div>
                  </div>
                  <span className="self-start rounded-full bg-surface-container px-space-sm py-0.5 font-label-sm text-label-sm text-primary sm:self-auto">
                    {member.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-space-xs pt-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Live Council Activity
              </span>
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>
                  Rajiv marked <strong>Airport Fleet 2B (6 Innovas)</strong> confirmed for Delhi
                  Arrivals.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

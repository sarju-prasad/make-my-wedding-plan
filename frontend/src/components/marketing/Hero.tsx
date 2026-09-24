import Image from "next/image";
import couplePortrait from "../../../public/images/couple-portrait.png";
import { Icon } from "./Icon";

const TRUST_MARKERS = [
  { icon: "lock", label: "Invitation-Only Access" },
  { icon: "visibility_off", label: "No Public Search Indexing" },
  { icon: "security", label: "End-to-End Encrypted" },
] as const;

const KPI_STATS = [
  { label: "Confirmed RSVPs", value: "342", suffix: "/ 380", progress: 90 },
  { label: "Budget Committed", value: "₹68.4L", suffix: "of ₹85L Total Target" },
  { label: "Tasks Completed", value: "78%", suffix: "42 of 54 milestones" },
] as const;

const AGENDA_ITEMS = [
  {
    dot: "bg-primary-container",
    title: "Mehendi & High Tea",
    time: "Fri, 2:00 PM • Promenade Garden",
    guests: "180 Guests",
  },
  {
    dot: "bg-secondary",
    title: "Sangeet Extravaganza",
    time: "Fri, 7:30 PM • Grand Courtyard",
    guests: "340 Guests",
  },
] as const;

export function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-[1440px] px-margin-mobile py-space-xl lg:px-margin lg:py-24">
      <div className="grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
        {/* Left Column: Copy & CTAs */}
        <div className="flex flex-col items-start gap-space-lg lg:col-span-6">
          <div className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-md py-1 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-primary-container" />
            <span>Private Wedding Management Platform</span>
          </div>

          <div className="flex flex-col gap-space-sm">
            <h1 className="font-headline-xl text-headline-xl font-normal text-on-surface lg:text-[3.5rem] lg:leading-[4rem]">
              Your wedding, <br className="hidden sm:inline" />
              <span className="font-normal text-primary italic">beautifully organized.</span>
            </h1>
            <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
              Plan multi-day celebrations, coordinate family councils, manage guest logistics, and
              preserve every memory in one calm, invitation-only command center.
            </p>
          </div>

          <div className="flex w-full flex-col items-stretch gap-space-md sm:w-auto sm:flex-row sm:items-center">
            <a
              href="#"
              className="inline-flex items-center justify-center rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-secondary"
            >
              <span>Plan your wedding</span>
              <Icon name="arrow_forward" className="ml-2 text-[18px]" />
            </a>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-surface-container-lowest px-space-lg py-space-sm font-label-lg text-label-lg text-on-surface shadow-sm transition-all hover:bg-surface-container"
            >
              <Icon name="play_circle" className="mr-2 text-[20px] text-primary" />
              <span>See how it works</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-space-md gap-y-1 pt-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {TRUST_MARKERS.map((marker, i) => (
              <div key={marker.label} className="contents">
                {i > 0 && <span className="text-outline-variant">&bull;</span>}
                <div className="flex items-center gap-1.5">
                  <Icon name={marker.icon} className="text-[16px] text-primary" />
                  <span>{marker.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Interactive SaaS Workspace Mockup */}
        <div className="relative mt-space-lg lg:col-span-6 lg:mt-0">
          <div className="pointer-events-none absolute -top-12 -right-12 -z-10 h-80 w-80 rounded-full bg-primary-fixed-dim/30 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-xl">
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed font-headline-sm font-semibold text-primary">
                  AA
                </div>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm leading-tight text-on-surface">
                    Ananya & Arjun
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    The Oberoi Udaivilas &bull; 3-Day Wedding
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-surface-container px-space-sm py-1 font-label-sm text-label-sm text-primary uppercase">
                T-42 Days
              </span>
            </div>

            <div className="grid grid-cols-3 gap-space-sm">
              {KPI_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col rounded-lg bg-surface-container-low p-space-sm"
                >
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    {stat.label}
                  </span>
                  <span className="mt-1 font-headline-sm text-headline-sm text-on-surface">
                    {stat.value}{" "}
                    <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">
                      {stat.suffix}
                    </span>
                  </span>
                  {"progress" in stat && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${stat.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-space-xs pt-space-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Celebration Functions Agenda
              </span>
              <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-2">
                {AGENDA_ITEMS.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm"
                  >
                    <div className="flex items-center gap-space-xs">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                      <div className="flex flex-col">
                        <span className="font-label-lg text-label-lg text-on-surface">
                          {item.title}
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {item.time}
                        </span>
                      </div>
                    </div>
                    <span className="rounded bg-surface px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                      {item.guests}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-surface-container p-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-label-sm text-[11px] text-on-primary">
                  PS
                </div>
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface">
                    Priya (Hospitality Lead) marked task done:
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Airport welcome desks & chauffeur dispatch charts
                  </span>
                </div>
              </div>
              <Icon name="check_circle" className="text-[20px] text-primary" />
            </div>
          </div>

          {/* Overlapping floating card: the guest web portal */}
          <div className="absolute -bottom-8 -left-8 z-20 hidden w-72 flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-xl transition-transform hover:-translate-y-1 sm:flex">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-600" />
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  Live Guest Experience
                </span>
              </div>
              <Icon name="open_in_new" className="text-[16px] text-on-surface-variant" />
            </div>
            <div className="relative h-32 w-full overflow-hidden rounded-lg">
              <Image
                src={couplePortrait}
                alt="Ananya and Arjun in elegant traditional wedding attire smiling outdoors"
                fill
                sizes="288px"
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-end bg-linear-to-t from-on-background/70 to-transparent p-space-xs">
                <span className="font-headline-sm text-[14px] font-medium text-surface-bright">
                  ananya-arjun.weddingplan.in
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Digital Pass Access
              </span>
              <span className="rounded bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-primary">
                Private Token
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

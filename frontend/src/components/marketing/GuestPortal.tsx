import Image from "next/image";
import couplePortrait from "../../../public/images/couple-portrait.png";
import { Icon } from "./Icon";

const HIGHLIGHTS = [
  { icon: "touch_app", label: "One-click RSVP with dietary preferences" },
  { icon: "directions", label: "Integrated venue GPS navigation & travel desk contacts" },
  { icon: "palette", label: "Curated dress code moodboards for each function" },
  { icon: "videocam", label: "Private live-stream broadcast for elderly or remote family" },
] as const;

const QUICK_ACTIONS = [
  { label: "RSVP Status", value: "4 Confirmed Attending", icon: "check_circle", accent: true },
  { label: "Airport Concierge", value: "Driver: Vikram (+91 98290...)" },
  { label: "Dietary Profile", value: "2 Pure Jain • 2 Regular" },
] as const;

export function GuestPortal() {
  return (
    <section className="w-full bg-surface-container-low py-space-xl">
      <div className="mx-auto max-w-[1440px] px-margin-mobile lg:px-margin">
        <div className="grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
          <div className="flex flex-col gap-space-md lg:col-span-5">
            <div className="inline-flex items-center gap-space-xs self-start rounded-full bg-surface-container-high px-space-md py-1 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              <span>The Guest Perspective</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
              Give your guests a beautiful place to experience your wedding.
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Replace cluttered PDFs and text message reminders with a personalized web application
              built uniquely for your celebration.
            </p>
            <div className="flex flex-col gap-space-sm pt-space-xs">
              {HIGHLIGHTS.map((item) => (
                <div key={item.label} className="flex items-center gap-space-sm">
                  <Icon name={item.icon} className="text-[20px] text-primary" />
                  <span className="font-body-md text-body-md text-on-surface">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-lg lg:col-span-7">
            <div className="flex items-center justify-between bg-surface-container-high px-space-md py-space-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-outline-variant" />
                <span className="h-3 w-3 rounded-full bg-outline-variant" />
                <span className="h-3 w-3 rounded-full bg-outline-variant" />
              </div>
              <span className="rounded bg-surface-container-lowest px-space-md py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                ananya-arjun.weddingplan.in/pass/vip-901
              </span>
              <Icon name="lock" className="text-[16px] text-on-surface-variant" />
            </div>

            <div className="flex flex-col gap-space-md p-space-lg">
              <div className="flex flex-col items-start justify-between gap-space-sm sm:flex-row sm:items-center">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">
                    Namaste, Sharma Family
                  </span>
                  <h4 className="font-headline-md text-headline-md text-on-surface">
                    Your Personalized Wedding Portal
                  </h4>
                </div>
                <span className="rounded bg-surface-container px-space-sm py-1 font-label-sm text-label-sm text-on-surface">
                  Table #14 &bull; Udaivilas Lake Wing
                </span>
              </div>

              <div className="relative flex h-48 w-full items-end overflow-hidden rounded-lg p-space-md">
                <Image
                  src={couplePortrait}
                  alt="Ananya and Arjun laughing together in Udaipur courtyard setting"
                  fill
                  sizes="(min-width: 1024px) 700px, 100vw"
                  className="absolute inset-0 object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-on-background/80 via-on-background/30 to-transparent" />
                <div className="relative z-10 flex flex-col">
                  <span className="font-headline-sm text-headline-sm font-normal text-surface-bright">
                    Celebrating Arjun & Ananya
                  </span>
                  <span className="font-body-sm text-body-sm text-surface-bright/90">
                    November 14&ndash;16, 2025 &bull; Udaipur, Rajasthan
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
                {QUICK_ACTIONS.map((action) => (
                  <div
                    key={action.label}
                    className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-space-sm"
                  >
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                      {action.label}
                    </span>
                    {"icon" in action ? (
                      <span className="flex items-center gap-1 font-label-md text-label-md text-primary">
                        <Icon name={action.icon} className="text-[16px]" />
                        <span>{action.value}</span>
                      </span>
                    ) : (
                      <span className="font-label-md text-label-md text-on-surface">
                        {action.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

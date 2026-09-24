const EVENTS = [
  {
    number: "Event 01",
    cohortTag: "Private Circle",
    title: "Mehendi & High Tea",
    description: "Intimate bridal henna ritual with traditional Rajasthani folk artists.",
    guests: "180 Guests",
    dressCode: "Mint, Sage & Blush",
    location: "Lakeside Lawn",
  },
  {
    number: "Event 02",
    cohortTag: "Family Only",
    title: "Haldi & Chooda",
    description: "Auspicious turmeric blessing ceremony followed by poolside brunch.",
    guests: "120 Guests",
    dressCode: "Shades of Mustard & Ochre",
    location: "Courtyard Fountain",
  },
  {
    number: "Event 03",
    cohortTag: "All Guests",
    title: "Vedic Wedding & Pheras",
    description: "Sacred marital vows under the heritage mandap at sunset.",
    guests: "350 Guests",
    dressCode: "Formal Indian Traditional",
    location: "Mewar Mandap",
  },
  {
    number: "Event 04",
    cohortTag: "Full Registry",
    title: "The Grand Gala",
    description: "Black-tie banquet, celebratory toasts, live symphony orchestra.",
    guests: "380 Guests",
    dressCode: "Black Tie / Royal Velvet",
    location: "The Palace Ballroom",
  },
] as const;

export function EventsGrid() {
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-space-xl px-margin-mobile py-space-xl lg:px-margin lg:py-28">
      <div className="flex max-w-2xl flex-col gap-space-xs">
        <span className="font-label-sm text-label-sm font-semibold text-primary uppercase tracking-widest">
          Granular Guest Flow
        </span>
        <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
          Every event. Every guest. Organized.
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Not all guests attend every ceremony. Filter invitees automatically by event cohort so
          guests only see itineraries and dress codes intended for them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-4">
        {EVENTS.map((event) => (
          <div
            key={event.number}
            className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                  {event.number}
                </span>
                <span className="font-label-sm text-label-sm font-semibold text-primary">
                  {event.cohortTag}
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{event.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {event.description}
              </p>
            </div>
            <div className="flex flex-col gap-space-xs pt-space-xs">
              <div className="flex items-center justify-between text-body-sm">
                <span className="font-label-sm text-on-surface-variant">Invited Cohort:</span>
                <span className="font-label-sm font-semibold text-on-surface">{event.guests}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="font-label-sm text-on-surface-variant">Dress Code:</span>
                <span className="font-label-sm text-on-surface">{event.dressCode}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="font-label-sm text-on-surface-variant">Location:</span>
                <span className="font-label-sm text-on-surface">{event.location}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

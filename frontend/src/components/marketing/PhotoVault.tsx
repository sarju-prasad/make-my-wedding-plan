import Image from "next/image";
import couplePortrait from "../../../public/images/couple-portrait.png";
import mehndiChai from "../../../public/images/mehndi-chai.png";

const VAULT_STATS = [
  {
    title: "Original RAW",
    description: "Zero compression image resolution preservation",
  },
  {
    title: "Facial Tagging",
    description: "Guests easily locate their own portraits in seconds",
  },
] as const;

const MOSAIC = [
  {
    src: mehndiChai,
    alt: "Henna adorned hands holding clay chai cup during Indian wedding celebration",
    caption: "Mehendi Chai Ritual",
    credit: "Captured by Guest: Sneha K. • 12:44 PM",
  },
  {
    src: couplePortrait,
    alt: "Bride and groom sharing joyful glance in traditional golden and beige wedding ensembles",
    caption: "First Look at Mewar Courtyard",
    credit: "Official Photographer Vault • 38 Photos",
  },
] as const;

export function PhotoVault() {
  return (
    <section className="w-full bg-surface-container-low py-space-xl">
      <div className="mx-auto max-w-[1440px] px-margin-mobile lg:px-margin">
        <div className="grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
          <div className="flex flex-col gap-space-md lg:col-span-5">
            <div className="inline-flex items-center gap-space-xs self-start rounded-full bg-surface-container-high px-space-md py-1 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              <span>Digital Vault</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-normal text-on-surface">
              The moments don&apos;t end with the ceremony.
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Collect candid smiles, high tea laughter, and sangeet dance videos from every guest
              without compressed messaging apps. Private QR upload tables let guests contribute
              instantaneously.
            </p>
            <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
              {VAULT_STATS.map((stat) => (
                <div
                  key={stat.title}
                  className="flex flex-col rounded-lg bg-surface-container-lowest p-space-sm shadow-sm"
                >
                  <span className="font-headline-sm text-headline-sm text-primary">
                    {stat.title}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {stat.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:col-span-7">
            {MOSAIC.map((photo) => (
              <div
                key={photo.caption}
                className="group relative h-80 overflow-hidden rounded-xl shadow-md"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-end bg-linear-to-t from-on-background/70 via-transparent to-transparent p-space-md">
                  <div className="flex flex-col">
                    <span className="font-headline-sm text-[16px] text-surface-bright">
                      {photo.caption}
                    </span>
                    <span className="font-body-sm text-body-sm text-surface-bright/80">
                      {photo.credit}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

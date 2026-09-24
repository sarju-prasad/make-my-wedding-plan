import { Icon } from "./Icon";

export function FinalCta() {
  return (
    <section className="w-full bg-surface-container-lowest py-space-xl lg:py-24">
      <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-space-lg px-margin-mobile text-center lg:px-margin">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <Icon name="favorite" className="text-[24px]" />
        </div>
        <div className="flex max-w-xl flex-col gap-space-xs">
          <h2 className="font-headline-xl text-headline-xl font-normal text-on-surface">
            Plan the celebration. <br />
            <span className="text-primary italic">Enjoy the moments.</span>
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Everything you need to organize your wedding, together. Step into a calm, unified
            planning workspace tailored to your special day.
          </p>
        </div>
        <div className="flex w-full flex-col items-center justify-center gap-space-md sm:w-auto sm:flex-row">
          <a
            href="#"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary-container px-space-xl py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-all hover:bg-secondary sm:w-auto"
          >
            <span>Plan your wedding</span>
            <Icon name="arrow_forward" className="ml-2 text-[18px]" />
          </a>
          <a
            href="#"
            className="inline-flex w-full items-center justify-center rounded-lg bg-surface-container-high px-space-lg py-space-sm font-label-lg text-label-lg text-on-surface transition-all hover:bg-surface-container sm:w-auto"
          >
            <span>Sign in to existing wedding</span>
          </a>
        </div>
        <div className="flex items-center gap-space-xs pt-space-xs font-label-sm text-label-sm text-on-surface-variant">
          <Icon name="verified" className="text-[16px] text-primary" />
          <span>
            Invitation-only workspaces &bull; No credit card required for consultation preview
          </span>
        </div>
      </div>
    </section>
  );
}

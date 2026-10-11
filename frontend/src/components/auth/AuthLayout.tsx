import Link from "next/link";
import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-margin-mobile py-space-xl">
      <Link href="/" className="mb-space-xl flex items-center gap-space-sm">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <span className="font-headline-sm text-[15px] leading-none font-bold text-on-primary">
            M
          </span>
        </div>
        <span className="font-headline-sm text-headline-sm tracking-tight text-primary">
          Make My Wedding Plan
        </span>
      </Link>

      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-space-xl shadow-sm">
        <div className="mb-space-lg flex flex-col gap-1 text-center">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{title}</h1>
          {subtitle && (
            <p className="font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

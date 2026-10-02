import type { WeddingEvent } from "@/lib/api";

const STATUS_STYLES: Record<WeddingEvent["status"], string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800",
  DRAFT: "bg-surface-container-high text-on-surface-variant",
  CANCELLED: "bg-error-container text-on-error-container",
  ARCHIVED: "bg-surface-container-high text-on-surface-variant",
};

export function EventStatusBadge({
  status,
  className = "px-2.5 py-0.5",
}: {
  status: WeddingEvent["status"];
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-[11px] font-semibold tracking-wider uppercase ${STATUS_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}

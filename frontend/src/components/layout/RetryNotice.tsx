/** The message + "Try again" button shown when a page's initial data load fails. */
export function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-space-md text-center">
      <p className="font-body-md text-body-md text-on-surface-variant">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary transition-all hover:bg-secondary"
      >
        Try again
      </button>
    </div>
  );
}

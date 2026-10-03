"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Generic accessible dialog overlay — focus moves inside on open, Tab/
 * Shift+Tab cycle among whatever's actually focusable inside `children`
 * (not a hardcoded pair), and Escape calls `onClose`. Shared by every modal
 * in the app rather than each one reimplementing this, which is exactly
 * what started happening before this existed (the Edit Wedding page's
 * discard-changes modal had its own hand-rolled, two-button-only version).
 */
export function Modal({
  titleId,
  onClose,
  children,
  widthClassName = "max-w-lg",
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Every caller passes a fresh inline `onClose` arrow on each of its own
  // renders (e.g. MembersSection re-rendering when its invitations list
  // finishes loading while this modal is open). Without this ref, that
  // would re-run the effect below on every such render — recapturing
  // `focusable` is harmless, but it also calls `focusable[0]?.focus()`
  // again, so focus visibly jumps back to the first focusable element any
  // time an unrelated parent state update happens to land while the modal
  // is open. Routing calls through a ref keeps the effect running exactly
  // once per mount while still always calling the latest onClose — same
  // pattern as VenueAddressField.tsx's onChangeRef.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const focusable = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusable[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Return focus to whatever opened the modal (e.g. the "Invite" button)
      // rather than leaving it on <body>.
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-space-md backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        className={`w-full ${widthClassName} rounded-xl bg-surface-container-lowest p-space-lg shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}

import { useRef } from "react";

/**
 * Focus handlers for a controlled Radix dialog. Without a Trigger component
 * Radix has nothing to return focus to on close, so focus fell to <body> and a
 * keyboard user started over at the top of the page. This remembers the
 * element that had focus when the dialog opened and returns to it, or to the
 * main content if it is gone (a deleted card, a closed menu).
 */
export function useReturnFocus(onOpen?: (e: Event) => void, onClose?: (e: Event) => void) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (e: Event) => {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpen?.(e);
    },
    onCloseAutoFocus: (e: Event) => {
      onClose?.(e);
      if (e.defaultPrevented) return;
      const target = opener.current?.isConnected ? opener.current : document.getElementById("main");
      if (target) {
        e.preventDefault();
        target.focus();
      }
    },
  };
}

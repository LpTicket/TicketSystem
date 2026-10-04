'use client';

import { useEffect, useRef } from 'react';

/** Keep keyboard navigation inside the active dialog and restore its opener. */
export function useModalFocus(active: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (!panel) return;
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    )).filter((element) => element.getClientRects().length > 0);
    (panel.querySelector<HTMLElement>('[data-modal-autofocus]') || controls()[0] || panel).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
      if (dialogs[dialogs.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          panel.focus();
        } else if (!panel.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active]);

  return panelRef;
}

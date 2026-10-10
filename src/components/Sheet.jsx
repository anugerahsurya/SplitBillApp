import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

let lockCount = 0;

function lockScroll() {
  if (lockCount === 0) {
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Di ponsel ini bottom sheet, di desktop dialog di tengah — satu komponen,
 * perbedaannya murni CSS. Ia tetap ter-mount sebentar setelah ditutup supaya
 * animasi keluarnya terlihat, bukan hilang mendadak.
 */
export function Sheet({ open, onClose, title, description, children, actions, wide = false }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  const restoreTo = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      restoreTo.current = document.activeElement;
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 340);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    lockScroll();
    return unlockScroll;
  }, [mounted]);

  useEffect(() => {
    if (!visible) return undefined;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first ?? panel)?.focus({ preventScroll: true });
    return () => {
      const target = restoreTo.current;
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    };
  }, [visible]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!mounted) return null;

  return (
    <div
      className="overlay"
      data-open={visible}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`sheet${wide ? ' sheet--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="sheet__grip" aria-hidden="true" />
        {(title || description) && (
          <div className="sheet__head">
            {title && (
              <h2 className="title" id={titleId}>
                {title}
              </h2>
            )}
            {description && <p className="subtitle">{description}</p>}
          </div>
        )}
        {children}
        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </div>
  );
}

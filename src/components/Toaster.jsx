import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check, X, Info } from 'lucide-react';

const ToastContext = createContext(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const LIFETIME = 3200;
const EXIT_MS = 240;
const MAX_VISIBLE = 3;

const ICONS = { success: Check, error: X, info: Info };

/**
 * Toast pakai transition, bukan keyframes: kalau beberapa toast datang
 * beruntun, animasinya saling memotong dengan mulus alih-alih restart.
 * Timer juga berhenti saat tab disembunyikan — kalau tidak, pesan sudah
 * hilang sebelum orangnya kembali melihat.
 */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());
  const seq = useRef(0);

  const clearTimer = useCallback((id) => {
    const t = timers.current.get(id);
    if (t?.handle) clearTimeout(t.handle);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id) => {
      clearTimer(id);
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, show: false } : t)));
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
    },
    [clearTimer],
  );

  const arm = useCallback(
    (id, ms) => {
      clearTimer(id);
      timers.current.set(id, {
        remaining: ms,
        startedAt: Date.now(),
        handle: setTimeout(() => dismiss(id), ms),
      });
    },
    [clearTimer, dismiss],
  );

  const toast = useCallback(
    (message, type = 'success') => {
      seq.current += 1;
      const id = `${Date.now()}-${seq.current}`;

      setItems((prev) => {
        // Pesan identik yang berulang tidak perlu menumpuk.
        const duplicate = prev.find((t) => t.message === message && t.type === type && t.show);
        if (duplicate) {
          arm(duplicate.id, LIFETIME);
          return prev;
        }
        const next = [...prev, { id, message, type, show: false }];
        const overflow = next.slice(0, Math.max(0, next.length - MAX_VISIBLE));
        overflow.forEach((t) => dismiss(t.id));
        return next;
      });

      requestAnimationFrame(() =>
        setItems((prev) => prev.map((t) => (t.id === id ? { ...t, show: true } : t))),
      );
      arm(id, LIFETIME);
      return id;
    },
    [arm, dismiss],
  );

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      timers.current.forEach((t, id) => {
        if (hidden) {
          clearTimeout(t.handle);
          t.remaining = Math.max(400, t.remaining - (Date.now() - t.startedAt));
          t.handle = null;
        } else if (!t.handle) {
          t.startedAt = Date.now();
          t.handle = setTimeout(() => dismiss(id), t.remaining);
        }
      });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach((t) => t.handle && clearTimeout(t.handle)), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.type] ?? Info;
          return (
            <button
              key={t.id}
              type="button"
              className={`toast toast--${t.type}`}
              data-show={t.show}
              onClick={() => dismiss(t.id)}
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="toast__icon">
                <Icon size={15} strokeWidth={3} />
              </span>
              <span className="grow">{t.message}</span>
            </button>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

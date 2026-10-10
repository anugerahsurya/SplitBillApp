import React, { useEffect, useRef, useState } from 'react';
import { formatNumber, formatRupiah, parseRupiah } from '../lib/money.js';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Segmented control. Label-nya dirender dua lapis — lapisan aktif di-clip
 * selebar satu segmen — jadi warna teks ikut bergeser bersama thumb,
 * bukan berganti mendadak di tengah animasi.
 */
export function Segmented({ options, value, onChange, brand = false, label }) {
  const n = options.length;
  const active = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const style = {
    '--seg-n': n,
    '--seg-i': active,
    '--clip-l': `${(active / n) * 100}%`,
    '--clip-r': `${((n - active - 1) / n) * 100}%`,
  };

  const renderLabel = (o) => (
    <>
      {o.icon}
      {o.label}
    </>
  );

  return (
    <div className={`seg${brand ? ' seg--brand' : ''}`} style={style} role="tablist" aria-label={label}>
      <span className="seg__thumb" aria-hidden="true" />
      <div className="seg__row">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={o.value === value}
            className="seg__btn"
            onClick={() => onChange(o.value)}
          >
            {renderLabel(o)}
          </button>
        ))}
      </div>
      <div className="seg__row seg__row--on" aria-hidden="true">
        {options.map((o) => (
          <span key={o.value} className="seg__btn">
            {renderLabel(o)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Input rupiah: menyimpan bilangan bulat, menampilkan pemisah ribuan,
 * dan memunculkan papan angka di ponsel. `type="number"` tidak dipakai karena
 * ia menolak pemisah ribuan dan malah menerima "e", tanda minus, dan desimal.
 */
export function MoneyInput({ value, onChange, placeholder = '0', className = '', ...rest }) {
  return (
    <div className="money-wrap">
      <span className="money-wrap__prefix">Rp</span>
      <input
        {...rest}
        className={`input input--money ${className}`}
        value={value ? formatNumber(value) : ''}
        onChange={(e) => onChange(parseRupiah(e.target.value))}
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        placeholder={placeholder}
      />
    </div>
  );
}

/** Angka besar yang berjalan ke nilai baru, jadi perubahannya terasa, bukan berkedip. */
export function AnimatedRupiah({ value, className = '' }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    const to = Number(value) || 0;
    if (from === to) return undefined;

    if (prefersReducedMotion()) {
      shownRef.current = to;
      setShown(to);
      return undefined;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 460);
      const eased = 1 - (1 - p) ** 3;
      const next = Math.round(from + (to - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{formatRupiah(shown)}</span>;
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      {title && <div style={{ fontWeight: 700, color: 'var(--text-soft)' }}>{title}</div>}
      {children && <div style={{ marginTop: '0.2rem' }}>{children}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r, style }) {
  return (
    <div
      className="skel"
      style={{ height: h, width: w, borderRadius: r, flex: 'none', ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="card stack" aria-busy="true" aria-label="Memuat">
      <Skeleton h={22} w="45%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={48} r={12} />
      ))}
    </div>
  );
}

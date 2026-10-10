import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Moon, Receipt, Sun } from 'lucide-react';
import { ToastProvider } from './components/Toaster';
import { ConfirmProvider } from './components/Confirm';
import { SkeletonCard } from './components/ui';
import UserView from './pages/UserView';

// Halaman admin hanya dipakai sebagian kecil pengunjung, jadi tidak perlu
// ikut terunduh di muatan pertama.
const AdminView = lazy(() => import('./pages/AdminView'));

const THEME_COLOR = { light: '#ffffff', dark: '#0b1120' };

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* mode privat: tema cukup berlaku untuk sesi ini */
    }
    // Warna bar status ikut tema pilihan, bukan tema sistem.
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute('content', THEME_COLOR[theme]));
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return [theme, toggle];
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const isDark = theme === 'dark';

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="shell">
          <header className="topbar">
            <div className="topbar__inner">
              <Link to="/" className="brand" style={{ color: 'inherit' }}>
                <span className="brand__mark">
                  <Receipt size={19} strokeWidth={2.4} />
                </span>
                <span className="brand__text">
                  <span className="brand__name">SplitBill</span>
                  <span className="brand__tag">Bagi tagihan tanpa drama</span>
                </span>
              </Link>

              <span className="topbar__spacer" />

              <button
                type="button"
                onClick={toggleTheme}
                className="btn btn--ghost btn--icon theme-toggle"
                aria-label={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
                title={isDark ? 'Tema terang' : 'Tema gelap'}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </header>

          <main className="main">
            <Routes>
              <Route path="/" element={<UserView />} />
              <Route
                path="/admin"
                element={
                  <Suspense fallback={<SkeletonCard rows={3} />}>
                    <AdminView />
                  </Suspense>
                }
              />
            </Routes>
          </main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}

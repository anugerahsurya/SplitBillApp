import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Banknote, Moon, Sun, CheckCircle, AlertCircle } from 'lucide-react';
import AdminView from './pages/AdminView';
import UserView from './pages/UserView';

export const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={showToast}>
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Banknote size={32} className="text-primary" />
              <div>
                <h1 style={{ margin: 0 }}>SplitBill</h1>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <p className="header-subtitle" style={{ margin: 0 }}>Bagi tagihan jadi lebih gampang!</p>
              <button 
                onClick={toggleTheme} 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem', borderRadius: '50%', backgroundColor: 'transparent' }}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<UserView />} />
            <Route path="/admin" element={<AdminView />} />
          </Routes>
        </main>

        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

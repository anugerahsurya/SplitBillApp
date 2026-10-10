import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Sheet } from './Sheet';

const ConfirmContext = createContext(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

/**
 * Pengganti window.confirm: tampilannya ikut tema, bisa ditutup dengan Esc,
 * dan di ponsel muncul sebagai sheet — bukan dialog sistem yang menempel
 * di pucuk browser dan memutus alur.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setState({
      title: 'Yakin?',
      message: '',
      confirmText: 'Ya, lanjut',
      cancelText: 'Batal',
      tone: 'danger',
      ...(typeof options === 'string' ? { message: options } : options),
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={state !== null}
        onClose={() => settle(false)}
        title={state?.title}
        actions={
          <>
            <button type="button" className="btn btn--soft" onClick={() => settle(false)}>
              {state?.cancelText}
            </button>
            <button
              type="button"
              className={`btn ${state?.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
              onClick={() => settle(true)}
            >
              {state?.confirmText}
            </button>
          </>
        }
      >
        {state?.message && (
          <div className={`notice notice--${state.tone === 'danger' ? 'bad' : 'warn'}`}>
            <AlertTriangle size={16} />
            <span>{state.message}</span>
          </div>
        )}
      </Sheet>
    </ConfirmContext.Provider>
  );
}

import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'ok') => {
    setToast({ message, type });
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && <div className={`toast ${toast.type === 'err' ? 'err' : ''}`}>{toast.message}</div>}
    </ToastContext.Provider>
  );
}

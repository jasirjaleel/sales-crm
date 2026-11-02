import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

import { TOAST_EVENT } from '../lib/notify';

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handle = (e) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, ...e.detail }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), e.detail.type === 'error' ? 7000 : 3500);
    };
    window.addEventListener(TOAST_EVENT, handle);
    return () => window.removeEventListener(TOAST_EVENT, handle);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:w-96 z-[300] flex flex-col gap-2" role="status">
      {toasts.map(t => (
        <div
          key={t.id}
          className="flex items-start gap-3 p-4 rounded-xl text-sm text-[var(--text)] shadow-2xl animate-in fade-in"
          style={{
            background: 'var(--bg-surface-elevated)',
            border: `1px solid ${t.type === 'error' ? 'rgba(255,90,90,0.35)' : 'rgba(0,196,140,0.35)'}`,
          }}
        >
          {t.type === 'error'
            ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--danger)]" />
            : <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--success)]" />}
          <p className="flex-1 leading-snug break-words">{t.message}</p>
          <button
            aria-label="Dismiss"
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

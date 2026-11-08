'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'danger' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void } | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(list => [...list, { id, message, tone }]);
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 3500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className="neu-card rounded-xl px-4 py-3 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200">
            {t.tone === 'danger'
              ? <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              : <CheckCircle2 className={cn('w-4 h-4 mt-0.5 flex-shrink-0', t.tone === 'success' ? 'text-emerald-500' : 'text-blue-500')} />}
            <p className="text-sm text-foreground flex-1">{t.message}</p>
            <button aria-label="Dismiss notification" onClick={() => setToasts(list => list.filter(x => x.id !== t.id))} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

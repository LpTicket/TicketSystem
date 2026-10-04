'use client';

import { useEffect, useState } from 'react';
import { useModalFocus } from './useModalFocus';
import { HiOutlineExclamation, HiOutlineX } from 'react-icons/hi';
import { useLang } from '@/context/LanguageContext';
import { DIALOG_REQUEST_EVENT, DialogRequest } from '@/lib/dialog';

export default function ConfirmDialogHost() {
  const { lang } = useLang();
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const handleRequest = (event: Event) => {
      const next = (event as CustomEvent<DialogRequest>).detail;
      setDialog((current) => {
        if (current?.kind === 'confirm') current.resolve(false);
        if (current?.kind === 'prompt') current.resolve(null);
        return next;
      });
      setInputValue('');
    };

    window.addEventListener(DIALOG_REQUEST_EVENT, handleRequest as EventListener);
    return () => window.removeEventListener(DIALOG_REQUEST_EVENT, handleRequest as EventListener);
  }, []);

  const close = (value: boolean | string | null) => {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(value === true);
    else dialog.resolve(typeof value === 'string' ? value : null);
    setDialog(null);
  };

  const panelRef = useModalFocus(Boolean(dialog), () => close(null));

  if (!dialog) return null;

  const isPrompt = dialog.kind === 'prompt';
  const title = dialog.title || (lang === 'es' ? 'Confirmar acción' : 'Confirm action');
  const confirmLabel = dialog.confirmLabel || (lang === 'es' ? 'Aceptar' : 'Confirm');
  const cancelLabel = dialog.cancelLabel || (lang === 'es' ? 'Cancelar' : 'Cancel');
  const isDanger = !isPrompt && dialog.tone === 'danger';

  return (
    <div
      className="lp-confirm-overlay fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close(null);
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lpticket-dialog-title"
        aria-describedby="lpticket-dialog-message"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1c2e] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start gap-4 px-6 pb-4 pt-6">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${isDanger ? 'border-red-400/35 bg-red-500/15 text-red-300' : 'border-orange-400/35 bg-orange-500/15 text-orange-300'}`}>
            <HiOutlineExclamation className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="lpticket-dialog-title" className="text-lg font-bold text-white">{title}</h2>
            <p id="lpticket-dialog-message" className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-300">{dialog.message}</p>
          </div>
          <button
            onClick={() => close(null)}
            className="-mr-2 -mt-2 min-h-11 min-w-11 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={cancelLabel}
          >
            <HiOutlineX className="h-5 w-5" />
          </button>
        </div>

        {isPrompt && (
          <div className="px-6 pb-2">
            <input
              data-modal-autofocus
              aria-label={dialog.placeholder || title}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && inputValue.trim()) close(inputValue.trim());
              }}
              placeholder={dialog.placeholder}
              className="w-full rounded-xl border border-white/15 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            onClick={() => close(null)}
            className="min-h-11 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => close(isPrompt ? inputValue.trim() || null : true)}
            disabled={isPrompt && !inputValue.trim()}
            className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isDanger ? 'bg-red-500 hover:bg-red-400' : 'bg-[#f97316] hover:bg-[#fb923c]'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

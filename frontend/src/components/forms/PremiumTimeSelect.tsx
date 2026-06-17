'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlineCheck, HiOutlineChevronDown, HiOutlineClock } from 'react-icons/hi';

type TimeOption = {
  value: string;
  label: string;
};

type PremiumTimeSelectProps = {
  value: string;
  options: TimeOption[];
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
  className?: string;
  compact?: boolean;
};

export default function PremiumTimeSelect({
  value,
  options,
  onChange,
  placeholder,
  clearLabel,
  className = '',
  compact = false,
}: PremiumTimeSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`group/time flex w-full items-center gap-3 rounded-2xl border border-[rgba(255,122,24,0.26)] bg-gradient-to-b from-white to-orange-50/45 ${compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'} text-left text-sm font-bold text-gray-900 shadow-[0_14px_34px_rgba(10,55,90,0.08)] outline-none transition-all hover:-translate-y-0.5 hover:border-primary-500/70 hover:shadow-[0_18px_42px_rgba(255,104,0,0.14)] focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15`}
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-orange-200/70 bg-white/80 text-primary-500 shadow-inner">
          <HiOutlineClock className="h-5 w-5 transition-transform group-hover/time:scale-110" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${selected ? 'text-gray-950' : 'text-gray-400'}`}>
            {selected?.label || (value ? value : placeholder)}
          </span>
          <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.22em] text-primary-500/70">
            Time
          </span>
        </span>
        <HiOutlineChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180 text-primary-500' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[90] mt-3 overflow-hidden rounded-3xl border border-[rgba(255,122,24,0.26)] bg-[#071827]/95 shadow-[0_28px_80px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary-400">
                {placeholder}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                {selected?.label || (clearLabel ? clearLabel : '15 min intervals')}
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
              15 min
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,122,24,0.7)_rgba(255,255,255,0.08)]">
            {clearLabel && (
              <button
                type="button"
                onClick={() => selectOption('')}
                className={`mb-2 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm font-bold transition-all ${!value ? 'border-primary-400/70 bg-primary-500 text-white shadow-[0_14px_34px_rgba(255,104,0,0.22)]' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-primary-400/50 hover:bg-primary-500/10 hover:text-white'}`}
              >
                <span>{clearLabel}</span>
                {!value && <HiOutlineCheck className="h-5 w-5" />}
              </button>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options.map((option) => {
                const active = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectOption(option.value)}
                    className={`flex min-h-[46px] items-center justify-between rounded-2xl border px-3 text-left text-sm font-extrabold transition-all ${active ? 'border-primary-400/80 bg-gradient-to-b from-[#ff8a18] via-[#f46c00] to-[#c93f00] text-white shadow-[0_14px_32px_rgba(255,104,0,0.28)]' : 'border-white/10 bg-white/[0.045] text-slate-200 hover:-translate-y-0.5 hover:border-primary-400/50 hover:bg-primary-500/12 hover:text-white'}`}
                  >
                    <span>{option.label}</span>
                    {active && <HiOutlineCheck className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

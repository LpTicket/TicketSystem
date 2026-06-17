'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlineChevronDown } from 'react-icons/hi';

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
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
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

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`input flex w-full items-center justify-between text-left !border-[#2b435c] !bg-[#0b2135] !text-white ${compact ? 'py-2.5' : 'py-3'}`}
        aria-expanded={open}
      >
        <span className="truncate text-white">
          {selected?.label || value || clearLabel || placeholder}
        </span>
        <HiOutlineChevronDown className={`ml-3 h-5 w-5 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[90] mt-2 overflow-hidden rounded-xl border border-gray-200 bg-[#071827] shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
          <div className="max-h-[104px] overflow-y-auto py-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,122,24,0.8)_rgba(255,255,255,0.08)]">
            {clearLabel && (
              <button
                type="button"
                onClick={() => choose('')}
                className={`flex h-12 w-full items-center px-4 text-left text-sm font-semibold transition-colors ${!value ? 'bg-primary-500 text-white' : 'text-slate-200 hover:bg-white/8 hover:text-white'}`}
              >
                {clearLabel}
              </button>
            )}

            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => choose(option.value)}
                  className={`flex h-12 w-full items-center justify-between px-4 text-left text-sm font-semibold transition-colors ${active ? 'bg-primary-500 text-white' : 'text-slate-200 hover:bg-white/8 hover:text-white'}`}
                >
                  <span>{option.label}</span>
                  {active && <span className="text-xs font-black uppercase tracking-[0.18em]">Selected</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

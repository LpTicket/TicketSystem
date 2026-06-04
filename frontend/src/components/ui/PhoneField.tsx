'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Country = { code: string; dial: string; flag: string; name: string };

// Americas-first list (the platform's main markets) + a few common others.
export const COUNTRIES: Country[] = [
  { code: 'US', dial: '1', flag: '🇺🇸', name: 'Estados Unidos / USA' },
  { code: 'AR', dial: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'MX', dial: '52', flag: '🇲🇽', name: 'México' },
  { code: 'CO', dial: '57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'CL', dial: '56', flag: '🇨🇱', name: 'Chile' },
  { code: 'PE', dial: '51', flag: '🇵🇪', name: 'Perú' },
  { code: 'BR', dial: '55', flag: '🇧🇷', name: 'Brasil' },
  { code: 'UY', dial: '598', flag: '🇺🇾', name: 'Uruguay' },
  { code: 'PY', dial: '595', flag: '🇵🇾', name: 'Paraguay' },
  { code: 'BO', dial: '591', flag: '🇧🇴', name: 'Bolivia' },
  { code: 'EC', dial: '593', flag: '🇪🇨', name: 'Ecuador' },
  { code: 'VE', dial: '58', flag: '🇻🇪', name: 'Venezuela' },
  { code: 'CR', dial: '506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: 'PA', dial: '507', flag: '🇵🇦', name: 'Panamá' },
  { code: 'GT', dial: '502', flag: '🇬🇹', name: 'Guatemala' },
  { code: 'SV', dial: '503', flag: '🇸🇻', name: 'El Salvador' },
  { code: 'HN', dial: '504', flag: '🇭🇳', name: 'Honduras' },
  { code: 'NI', dial: '505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: 'DO', dial: '1', flag: '🇩🇴', name: 'República Dominicana' },
  { code: 'PR', dial: '1', flag: '🇵🇷', name: 'Puerto Rico' },
  { code: 'CA', dial: '1', flag: '🇨🇦', name: 'Canadá' },
  { code: 'ES', dial: '34', flag: '🇪🇸', name: 'España' },
  { code: 'GB', dial: '44', flag: '🇬🇧', name: 'Reino Unido' },
  { code: 'IT', dial: '39', flag: '🇮🇹', name: 'Italia' },
  { code: 'FR', dial: '33', flag: '🇫🇷', name: 'Francia' },
  { code: 'DE', dial: '49', flag: '🇩🇪', name: 'Alemania' },
];

const DEFAULT_COUNTRY = COUNTRIES[0]; // US

/** Find the country whose dial code prefixes the given E.164 digits (longest first). */
function parseE164(value: string): { country: Country; national: string } {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return { country: DEFAULT_COUNTRY, national: '' };
  const byLongestDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byLongestDial) {
    if (digits.startsWith(c.dial)) return { country: c, national: digits.slice(c.dial.length) };
  }
  return { country: DEFAULT_COUNTRY, national: digits };
}

type Props = {
  value: string;
  onChange: (e164: string) => void;
  inputClassName?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
};

export default function PhoneField({ value, onChange, inputClassName = '', placeholder, required, id }: Props) {
  const initial = useMemo(() => parseE164(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState<string>(initial.national);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const combined = national ? `+${country.dial}${national}` : '';

  // Sync when the parent loads a value (e.g. profile fetched from the API).
  useEffect(() => {
    if (value && value.replace(/\D/g, '') !== combined.replace(/\D/g, '')) {
      const p = parseE164(value);
      setCountry(p.country);
      setNational(p.national);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const emit = (c: Country, n: string) => onChange(n ? `+${c.dial}${n}` : '');

  const handleNational = (raw: string) => {
    const n = raw.replace(/\D/g, '');
    setNational(n);
    emit(country, n);
  };

  const pickCountry = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setSearch('');
    emit(c, national);
  };

  const filtered = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search.replace('+', '')),
  );

  return (
    <div ref={wrapRef} className="relative flex gap-2">
      {/* Country selector */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-[#F97316] focus:border-[#F97316] focus:outline-none ${inputClassName.includes('dashboard') ? 'dashboard-premium-input' : ''}`}
        aria-label="Código de país"
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span>+{country.dial}</span>
        <span className="text-[10px] opacity-60">▼</span>
      </button>

      {/* National number */}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={national}
        onChange={(e) => handleNational(e.target.value)}
        placeholder={placeholder || 'Número sin código de país'}
        required={required}
        className={`flex-1 ${inputClassName}`}
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 max-w-[85vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar país o código…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316]"
            />
          </div>
          <div className="max-h-60 overflow-y-auto pb-2">
            {filtered.length === 0 && <p className="px-4 py-3 text-center text-xs text-slate-400">Sin resultados</p>}
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickCountry(c)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-orange-50 ${c.code === country.code ? 'bg-orange-50/60 font-bold text-[#0A375A]' : 'text-slate-700'}`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs font-bold text-slate-400">+{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

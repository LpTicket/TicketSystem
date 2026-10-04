'use client';
import { useSearchParams } from 'next/navigation';

export function useListNavigation(defaultFilter: string, allowedFilters: readonly string[]) {
  const params = useSearchParams();
  const rawPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const requestedFilter = params.get('filter') || defaultFilter;
  const filter = allowedFilters.includes(requestedFilter) ? requestedFilter : defaultFilter;
  const search = params.get('search') || '';
  const updateFilters = (changes: { page?: number; filter?: string; search?: string }, replace = false) => {
    // Read the current URL so consecutive changes preserve one another.
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (!value || (key === 'page' && value === 1) || (key === 'filter' && value === defaultFilter)) next.delete(key);
      else next.set(key, String(value));
    }
    const url = `${window.location.pathname}${next.size ? `?${next}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      if (replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    }
  };
  return { page, filter, search, updateFilters };
}

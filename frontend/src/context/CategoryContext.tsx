'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import { normalizeCategoryForDisplay } from '@/lib/i18nDisplay';

export interface Category {
  id: string;
  slug: string;
  labelEs: string;
  labelEn: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  imageData?: string | null;
  imageUrl?: string | null;
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  getCategoryInfo: (slug: string) => Category | undefined;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType>({
  categories: [],
  loading: true,
  getCategoryInfo: () => undefined,
  refreshCategories: async () => {},
});

const CATEGORY_CACHE_KEY = 'lp_categories_v2';
const CATEGORY_VERSION_KEY = 'lp_categories_version';
const POLL_INTERVAL_MS = 30_000;

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      const mapped = (res.data || []).map(normalizeCategoryForDisplay);
      setCategories(mapped);
      try {
        window.localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(mapped));
      } catch {
        /* storage unavailable — ignore */
      }
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Paint instantly from cache on reload, then refresh in the background.
    try {
      const cached = window.localStorage.getItem(CATEGORY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length) {
          setCategories(parsed);
          setLoading(false);
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
    fetchCategories();

    // Poll /categories/version every 30s — only reload full list when it changes.
    let knownVersion = '';
    try { knownVersion = window.localStorage.getItem(CATEGORY_VERSION_KEY) || ''; } catch { /* ignore */ }

    const interval = setInterval(async () => {
      try {
        const res = await api.get('/categories/version');
        const v: string = res.data?.version ?? '';
        if (v && v !== knownVersion) {
          knownVersion = v;
          try { window.localStorage.setItem(CATEGORY_VERSION_KEY, v); } catch { /* ignore */ }
          await fetchCategories();
        }
      } catch { /* ignore poll errors */ }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const getCategoryInfo = (slug: string) => {
    return categories.find(c => c.slug === slug);
  };

  return (
    <CategoryContext.Provider value={{ categories, loading, getCategoryInfo, refreshCategories: fetchCategories }}>
      {children}
    </CategoryContext.Provider>
  );
}

export const useCategories = () => useContext(CategoryContext);

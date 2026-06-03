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

const CATEGORY_CACHE_KEY = 'lp_categories_v1';

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

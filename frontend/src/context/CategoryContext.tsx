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

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories((res.data || []).map(normalizeCategoryForDisplay));
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

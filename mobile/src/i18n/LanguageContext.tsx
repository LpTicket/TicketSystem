import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type AppLanguage = 'es' | 'en';

type LanguageContextValue = {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  isEs: boolean;
  t: (es: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>('en');

  const value = useMemo(
    () => ({
      lang,
      setLang,
      isEs: lang === 'es',
      t: (es: string, en: string) => (lang === 'es' ? es : en),
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}

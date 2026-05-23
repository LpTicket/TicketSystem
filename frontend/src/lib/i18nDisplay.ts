export type DisplayLang = 'es' | 'en' | string;

const clean = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const CATEGORY_LABELS: Record<string, { es: string; en: string }> = {
  concierto: { es: 'Concierto', en: 'Concert' },
  concert: { es: 'Concierto', en: 'Concert' },
  teatro: { es: 'Teatro', en: 'Theater' },
  theater: { es: 'Teatro', en: 'Theater' },
  theatre: { es: 'Teatro', en: 'Theater' },
  festival: { es: 'Festival', en: 'Festival' },
  comedia: { es: 'Comedia', en: 'Comedy' },
  comedy: { es: 'Comedia', en: 'Comedy' },
  deporte: { es: 'Deporte', en: 'Sports' },
  deportes: { es: 'Deporte', en: 'Sports' },
  sports: { es: 'Deporte', en: 'Sports' },
  conferencia: { es: 'Conferencia', en: 'Conference' },
  conference: { es: 'Conferencia', en: 'Conference' },
  infantil: { es: 'Infantil', en: 'Kids' },
  kids: { es: 'Infantil', en: 'Kids' },
  networking: { es: 'Networking', en: 'Networking' },
  'professional networking': { es: 'Networking profesional', en: 'Professional networking' },
  taller: { es: 'Taller', en: 'Workshop' },
  talleres: { es: 'Talleres', en: 'Workshops' },
  workshop: { es: 'Taller', en: 'Workshop' },
  workshops: { es: 'Talleres', en: 'Workshops' },
  expo: { es: 'Expo', en: 'Expo' },
  expos: { es: 'Expos', en: 'Expos' },
  otro: { es: 'Otro', en: 'Other' },
  other: { es: 'Otro', en: 'Other' },
};

const SECTION_LABELS: Record<string, { es: string; en: string }> = {
  general: { es: 'General', en: 'General' },
  'general area': { es: 'Área General', en: 'General Area' },
  'area general': { es: 'Área General', en: 'General Area' },
  'área general': { es: 'Área General', en: 'General Area' },
  'general admission': { es: 'Entrada General', en: 'General Admission' },
  'entrada general': { es: 'Entrada General', en: 'General Admission' },
  ga: { es: 'Entrada General', en: 'General Admission' },
  vip: { es: 'VIP', en: 'VIP' },
};

export function translateCategoryLabel(value: string | undefined | null, lang: DisplayLang) {
  const original = String(value || '').trim();
  const translated = CATEGORY_LABELS[clean(original)];
  if (!translated) return original;
  return lang === 'en' ? translated.en : translated.es;
}

export function translateSectionLabel(value: string | undefined | null, lang: DisplayLang) {
  const original = String(value || '').trim();
  const translated = SECTION_LABELS[clean(original)];
  if (!translated) return original;
  return lang === 'en' ? translated.en : translated.es;
}

export function normalizeCategoryForDisplay<T extends { slug?: string; labelEs?: string; labelEn?: string }>(category: T): T {
  const slug = clean(category.slug);
  const bySlug = CATEGORY_LABELS[slug];
  const byEs = CATEGORY_LABELS[clean(category.labelEs)];
  const byEn = CATEGORY_LABELS[clean(category.labelEn)];
  const translated = bySlug || byEs || byEn;

  if (!translated) return category;

  return {
    ...category,
    labelEs: translated.es,
    labelEn: translated.en,
  };
}

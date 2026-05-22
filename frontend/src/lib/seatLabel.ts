import { translateSectionLabel } from '@/lib/i18nDisplay';

type SeatLabelInput = {
  rowLabel?: string | null;
  seatNumber?: number | string | null;
  sectionName?: string | null;
  sectionType?: string | null;
};

type SectionLabelInput = {
  name?: string | null;
  sectionName?: string | null;
  sectionType?: string | null;
};

const isTableName = (value?: string | null) => /^(mesa|table)\b|^(mesa|table)\d+/i.test(String(value || '').trim());

export function formatSeatLabel(
  seat: SeatLabelInput,
  section?: SectionLabelInput | string | null,
  lang: 'es' | 'en' | string = 'es',
) {
  const rawSectionName =
    typeof section === 'string'
      ? section
      : section?.name || section?.sectionName || seat.sectionName || '';

  const rowLabel = String(seat.rowLabel || '').trim();
  const seatNumber = seat.seatNumber ?? '';

  const cleanSection = translateSectionLabel(rawSectionName, lang).trim();
  const shouldShowSection = cleanSection && 
    !['general', 'general admission', 'ga', 'default', 'default section', 'null', 'undefined', 'sección única', 'seccion unica'].includes(cleanSection.toLowerCase());

  const sectionSuffix = shouldShowSection ? ` (${cleanSection})` : '';

  // 1. Check if seatNumber matches mesaX (e.g. MESA1, mesa 2, table 2)
  const seatMesaMatch = String(seatNumber || '').trim().match(/^(mesa|table)\s*(\d+)$/i);
  if (seatMesaMatch) {
    const tableWord = lang === 'en' ? 'Table' : 'Mesa';
    const chairWord = lang === 'en' ? 'Chair' : 'Silla';
    const chairNum = seatMesaMatch[2];
    
    let tableLabel = rowLabel;
    if (/^\d+$/.test(rowLabel)) {
      tableLabel = `${tableWord} ${rowLabel}`;
    } else {
      const hasTableWord = /^(mesa|table)\b/i.test(rowLabel);
      if (!hasTableWord) {
        tableLabel = `${tableWord} ${rowLabel}`;
      }
    }
    return `${tableLabel} - ${chairWord} ${chairNum}${sectionSuffix}`;
  }

  // 2. Check if rowLabel matches mesaX (e.g. mesa2, mesa 2, table 2)
  const mesaMatch = rowLabel.match(/^(mesa|table)\s*(\d+)$/i);
  if (mesaMatch) {
    const tableWord = lang === 'en' ? 'Table' : 'Mesa';
    const chairWord = lang === 'en' ? 'Chair' : 'Silla';
    const tableNum = mesaMatch[2];
    const chairNum = seatNumber;
    return `${tableWord} ${tableNum} - ${chairWord} ${chairNum}${sectionSuffix}`;
  }

  const isTable =
    seat.sectionType === 'table' ||
    (typeof section !== 'string' && section?.sectionType === 'table') ||
    isTableName(rowLabel);

  if (isTable) {
    const tableWord = lang === 'en' ? 'Table' : 'Mesa';
    const chairWord = lang === 'en' ? 'Chair' : 'Silla';
    let tableLabel: string;
    if (cleanSection) {
      // If section name is purely numeric (e.g. "23"), prefix with "Mesa"
      if (/^\d+$/.test(cleanSection)) {
        tableLabel = `${tableWord} ${cleanSection}`;
      } else if (isTableName(cleanSection)) {
        // Already has "Mesa"/"Table" word in it, use as-is
        tableLabel = cleanSection;
      } else {
        // Generic name like "New Table" or "VIP Table"
        tableLabel = cleanSection;
      }
    } else {
      tableLabel = tableWord;
    }
    return `${tableLabel} - ${chairWord} ${seatNumber}`;
  }

  if (!rowLabel || rowLabel === 'GA') {
    return (shouldShowSection ? cleanSection : (lang === 'en' ? 'General Admission' : 'Entrada General'));
  }

  if (rowLabel.length > 2) {
    if (seatNumber === 1 || seatNumber === '1') {
      return `${rowLabel}${sectionSuffix}`;
    }
    return `${rowLabel} - ${lang === 'en' ? 'Chair' : 'Silla'} ${seatNumber}${sectionSuffix}`;
  }

  if (rowLabel.length === 1) {
    return `${lang === 'en' ? 'Row' : 'Fila'} ${rowLabel}, ${lang === 'en' ? 'Seat' : 'Asiento'} ${seatNumber}${sectionSuffix}`;
  }

  return `${rowLabel}-${seatNumber}${sectionSuffix}`;
}

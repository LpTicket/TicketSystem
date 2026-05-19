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

  const cleanSection = rawSectionName.trim();
  const shouldShowSection = cleanSection && 
    !['general', 'general admission', 'ga', 'default', 'default section', 'null', 'undefined', 'sección única', 'seccion unica'].includes(cleanSection.toLowerCase());

  const sectionSuffix = shouldShowSection ? ` (${cleanSection})` : '';

  // 1. Check if rowLabel matches mesaX (e.g. mesa2, mesa 2, table 2)
  const mesaMatch = rowLabel.match(/^(mesa|table)\s*(\d+)$/i);
  if (mesaMatch) {
    const tableWord = lang === 'en' ? 'Table' : 'Mesa';
    const chairWord = lang === 'en' ? 'Chair' : 'Silla';
    const chairNum = mesaMatch[2];
    const tableNum = seatNumber;
    return `${tableWord} ${tableNum} - ${chairWord} ${chairNum}${sectionSuffix}`;
  }

  const isTable =
    seat.sectionType === 'table' ||
    (typeof section !== 'string' && section?.sectionType === 'table') ||
    isTableName(rowLabel);

  if (isTable) {
    const tableWord = lang === 'en' ? 'Table' : 'Mesa';
    const chairWord = lang === 'en' ? 'Chair' : 'Silla';
    const tableLabel = cleanSection
      ? (isTableName(cleanSection) ? cleanSection : `${tableWord} ${cleanSection}`)
      : tableWord;

    return `${tableLabel} - ${chairWord} ${seatNumber}${sectionSuffix}`.trim();
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

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
  const sectionName =
    typeof section === 'string'
      ? section
      : section?.name || section?.sectionName || seat.sectionName || '';

  const rowLabel = String(seat.rowLabel || '').trim();
  const seatNumber = seat.seatNumber ?? '';

  const isTable =
    seat.sectionType === 'table' ||
    (typeof section !== 'string' && section?.sectionType === 'table') ||
    isTableName(rowLabel);

  if (isTable) {
    const tableWord = lang === 'en' ? 'Table' : 'Mesa';
    const chairWord = lang === 'en' ? 'Chair' : 'Silla';
    const tableLabel = sectionName
      ? isTableName(sectionName) ? sectionName : `${tableWord} ${sectionName}`
      : tableWord;

    return `${tableLabel} - ${chairWord} ${seatNumber}`.trim();
  }

  if (!rowLabel || rowLabel === 'GA') {
    return sectionName || (lang === 'en' ? 'General Admission' : 'Entrada General');
  }

  return `${rowLabel}${seatNumber}`;
}

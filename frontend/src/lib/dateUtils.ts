/**
 * Safely parses any date string or Date object into a valid Date instance.
 * Replaces space-separated date strings (e.g. from SQL) with 'T' so they parse
 * correctly across all browsers, including Safari/iOS.
 */
export const parseSafeDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;

  const str = String(dateVal).trim();

  // Replace space with T for ISO compliance (e.g., "2026-05-19 20:00:00" -> "2026-05-19T20:00:00")
  const cleaned = str.replace(' ', 'T');
  const d = new Date(cleaned);

  if (!isNaN(d.getTime())) return d;

  // Fallback to direct constructor if T replacement didn't work
  const originalDate = new Date(str);
  if (!isNaN(originalDate.getTime())) return originalDate;

  // Default fallback instead of returning an Invalid Date object
  return new Date();
};

/**
 * Formats a date in a specific IANA timezone (e.g. "America/Chicago").
 * Always uses the event's own timezone so the time stays consistent across
 * browsers regardless of where the viewer is located.
 */
export const formatDateInTimezone = (
  dateVal: any,
  timezone: string = 'UTC',
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const date = parseSafeDate(dateVal);
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    ...options,
  }).format(date);
};

/**
 * Returns the short timezone abbreviation (e.g. "CDT", "ART") for a given
 * IANA timezone at the moment of the provided date.
 */
export const getTimezoneAbbr = (timezone: string = 'UTC', dateVal?: any): string => {
  try {
    const date = dateVal ? parseSafeDate(dateVal) : new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
};

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

// Detects common email typos so buyers don't enter an address that bounces
// (e.g. `icloud.con` -> NXDOMAIN). Mirrors backend/src/common/utils/email-typo.ts.

const DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gamil.com': 'gmail.com',
  'gmail.comm': 'gmail.com', 'gmail.cmo': 'gmail.com', 'gmailcom': 'gmail.com',
  'icloud.con': 'icloud.com', 'iclould.com': 'icloud.com', 'icloud.co': 'icloud.com',
  'icloud.cm': 'icloud.com', 'icould.com': 'icloud.com', 'iclud.com': 'icloud.com',
  'icloud.comm': 'icloud.com', 'icloud.cmo': 'icloud.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.cm': 'hotmail.com',
  'hotmail.comm': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'outlook.co': 'outlook.com',
  'outloo.com': 'outlook.com', 'outlook.cm': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'yhaoo.com': 'yahoo.com', 'yahoo.cm': 'yahoo.com',
};

const TLD_FIXES: Record<string, string> = {
  con: 'com', cmo: 'com', vom: 'com', xom: 'com', comm: 'com', cpm: 'com',
  ocm: 'com', cim: 'com', net1: 'net',
};

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
}

/** Returns a corrected email if the address has a likely typo, otherwise null. */
export function suggestEmailFix(email: string): string | null {
  const e = (email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1 || at === e.length - 1) return null;

  const local = e.slice(0, at);
  const domain = e.slice(at + 1);

  if (DOMAIN_FIXES[domain]) return `${local}@${DOMAIN_FIXES[domain]}`;

  const dot = domain.lastIndexOf('.');
  if (dot > 0) {
    const tld = domain.slice(dot + 1);
    if (TLD_FIXES[tld]) return `${local}@${domain.slice(0, dot)}.${TLD_FIXES[tld]}`;
  }
  return null;
}

// Indian numbers are stored as 10 digits. Other countries keep their prefix as +<digits>.
export function normalizePhone(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');

  if (hasPlus || digits.startsWith('00')) {
    const intl = digits.replace(/^00/, '');
    if (intl.startsWith('91') && intl.length === 12) return intl.slice(2);
    return intl.length >= 8 && intl.length <= 15 ? `+${intl}` : '';
  }
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return '';
}

// The digits wa.me expects: country code included, no plus.
export function toWhatsAppNumber(raw) {
  const value = String(raw ?? '').trim();
  const normalized = normalizePhone(value);
  if (normalized.startsWith('+')) return normalized.slice(1);
  if (normalized) return `91${normalized}`;
  return value.replace(/\D/g, '');
}

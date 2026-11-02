import { toWhatsAppNumber } from './phone';

export function buildWhatsAppLink(phone, businessName, customMessage) {
  if (!phone) return '#';

  const intlPhone = toWhatsAppNumber(phone);

  if (customMessage) {
    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(customMessage)}`;
  }

  // Load active template from localStorage, or use a default fallback
  const activeTemplate = localStorage.getItem('crm_active_wa_template')
    || "Hi {{name}},\n\nWe noticed your business online and had a few ideas that may help generate more leads.\n\nWould you be open to a quick conversation?";

  let message = activeTemplate;

  // Intelligent Name Replacement
  const isNameMissing = !businessName || businessName.trim().toLowerCase() === 'unknown';

  if (isNameMissing) {
    // If name is missing, gracefully replace "Hi {{name}}," with "Hi," or "Hello,"
    message = message.replace(/Hi\s+{{name}},/gi, "Hi,");
    message = message.replace(/Hello\s+{{name}},/gi, "Hello,");
    message = message.replace(/{{name}}/g, "there"); // catch-all for any other placement
  } else {
    // Standard replacement
    message = message.replace(/{{name}}/g, businessName.trim());
  }

  // Encode for URL
  const encoded = encodeURIComponent(message);

  return `https://wa.me/${intlPhone}?text=${encoded}`;
}

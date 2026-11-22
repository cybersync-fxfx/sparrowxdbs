export const WHATSAPP_SUPPORT_COUNTRY_CODE = "+91";
export const WHATSAPP_SUPPORT_LOCAL_NUMBER = "9025056678";
export const WHATSAPP_SUPPORT_DIGITS = "919025056678";
export const WHATSAPP_SUPPORT_DISPLAY = "+91 90250 56678";

/**
 * Builds a direct wa.me link to SparrowX India WhatsApp Support (+91 90250 56678)
 * with an optional pre-filled message for instant subscription or billing assistance.
 */
export function buildWhatsAppSupportUrl(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_SUPPORT_DIGITS}`;
  if (!message || !message.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}

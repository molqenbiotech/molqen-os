/**
 * MOLQEN OS — Cookie & Consent Storage Helper
 */

export const COOKIE_STORAGE_KEY = 'molqen_cookie_consent_v1';

export function getStoredCookieConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}


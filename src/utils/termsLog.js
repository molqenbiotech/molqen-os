/**
 * MOLQEN OS — Immutable Terms & Privacy Consent Logger
 * Records append-only acceptance audits into Firestore `terms_acceptance_logs`
 * in accordance with GDPR Art. 7(1) proof of consent obligations.
 */

import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const CURRENT_TERMS_VERSION = 'v2026.1';
export const CURRENT_PRIVACY_VERSION = 'v2026.1';

/**
 * Logs an immutable consent audit record to Firestore
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.userEmail
 * @param {string} params.acceptanceMethod - e.g. 'signup_checkbox', 'modal_consent'
 * @param {boolean} [params.marketingConsent=false]
 * @returns {Promise<string|null>} Document ID of log
 */
export async function logTermsAcceptance({
  userId,
  userEmail,
  acceptanceMethod = 'signup_checkbox',
  marketingConsent = false
}) {
  if (!userId) return null;

  try {
    const isGpcActive = typeof navigator !== 'undefined' && Boolean(navigator.globalPrivacyControl);

    const logPayload = {
      userId,
      userEmail: userEmail || 'anonymous',
      termsVersion: CURRENT_TERMS_VERSION,
      privacyPolicyVersion: CURRENT_PRIVACY_VERSION,
      timestampISO: new Date().toISOString(),
      acceptanceMethod,
      marketingConsent: Boolean(marketingConsent),
      gpcSignalActive: isGpcActive,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'terms_acceptance_logs'), logPayload);
    return docRef.id;
  } catch (err) {
    console.warn('Terms consent audit notice:', err);
    return null;
  }
}


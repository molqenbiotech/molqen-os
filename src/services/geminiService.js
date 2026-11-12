/**
 * MOLQEN OS — Hardened AI Proxy Client
 * Routes in-silico protocol & molecular queries exclusively through a secure backend proxy
 * (e.g., Cloudflare Worker / Cloud Run) with authenticated Firebase ID token verification.
 * Zero Gemini API keys are compiled into static frontend client bundles.
 */

export function isProxyConfigured() {
  const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL || import.meta.env.VITE_AI_PROXY_URL;
  return Boolean(proxyUrl && proxyUrl.trim() !== '');
}

/**
 * Execute AI prompt via secure authenticated proxy
 * @param {Object} params
 * @param {string} params.prompt
 * @param {Object} params.user - Firebase user object
 * @param {string} params.systemInstruction
 * @param {Object} params.currentLab
 * @param {string} params.role - 'faculty' | 'student'
 * @param {boolean} params.isPI
 * @param {Object} params.telemetry
 * @returns {Promise<{ answer: string|null, isLive: boolean, error?: string }>}
 */
export async function executeAiQuery({
  prompt,
  user,
  systemInstruction,
  currentLab,
  role = 'student',
  isPI = false,
  telemetry = {}
}) {
  const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL || import.meta.env.VITE_AI_PROXY_URL;

  if (!proxyUrl || proxyUrl.trim() === '') {
    return {
      answer: null,
      isLive: false,
      error: 'PROXY_NOT_CONFIGURED'
    };
  }

  try {
    // 1. Acquire authenticated Firebase ID token for zero-trust proxy verification
    let idToken = null;
    if (user && typeof user.getIdToken === 'function') {
      try {
        idToken = await user.getIdToken();
      } catch (authErr) {
        console.warn('Could not acquire user ID token for AI proxy:', authErr.message);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const headers = {
      'Content-Type': 'application/json',
      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
    };

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        prompt,
        systemInstruction,
        labId: currentLab?.id || 'unassigned',
        labName: currentLab?.name || 'MOLQEN Core',
        role,
        isPI,
        telemetry,
        model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'
      })
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const answerText = data?.answer || data?.text || data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answerText) {
        return {
          answer: answerText,
          isLive: true
        };
      }
    }

    console.warn(`AI proxy responded with HTTP ${res.status}`);
    return {
      answer: null,
      isLive: false,
      error: `PROXY_HTTP_${res.status}`
    };
  } catch (err) {
    console.warn('AI proxy fetch failed, falling back to in-silico engine:', err.message);
    return {
      answer: null,
      isLive: false,
      error: err.name === 'AbortError' ? 'PROXY_TIMEOUT' : 'PROXY_NETWORK_ERROR'
    };
  }
}

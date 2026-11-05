import React, { useState, useEffect } from 'react';
import { getStoredCookieConsent, COOKIE_STORAGE_KEY } from '../utils/cookieStorage';

export default function CookieConsent({ onOpenLegalCenter }) {
  const [showBanner, setShowBanner] = useState(() => !getStoredCookieConsent());
  const [showPreferences, setShowPreferences] = useState(false);
  const [isGpcDetected] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.globalPrivacyControl));
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Listen for custom open events from footer
  useEffect(() => {
    const handleOpenPreferences = () => {
      setShowPreferences(true);
      setShowBanner(true);
    };
    window.addEventListener('open_cookie_preferences', handleOpenPreferences);
    return () => window.removeEventListener('open_cookie_preferences', handleOpenPreferences);
  }, []);

  const saveConsent = (preferences) => {
    const consentRecord = {
      necessary: true,
      analytics: Boolean(preferences.analytics),
      marketing: Boolean(preferences.marketing),
      gpcHonored: isGpcDetected,
      timestamp: new Date().toISOString()
    };

    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(consentRecord));
      setShowBanner(false);
      setShowPreferences(false);
      window.dispatchEvent(new CustomEvent('molqen_consent_updated', { detail: consentRecord }));
    } catch (e) {
      console.warn('Could not persist cookie consent:', e);
    }
  };

  const handleAcceptAll = () => {
    saveConsent({ analytics: true, marketing: true });
  };

  const handleRejectNonEssential = () => {
    saveConsent({ analytics: false, marketing: false });
  };

  const handleSaveCustom = () => {
    saveConsent({ analytics: analyticsOptIn, marketing: marketingOptIn });
  };

  if (!showBanner) return null;

  return (
    <aside
      aria-label="Cookie and Privacy Consent"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        left: '20px',
        maxWidth: '560px',
        margin: '0 auto',
        background: '#FFFFFF',
        borderRadius: '14px',
        boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.2), 0 0 0 1px #E2E8F0',
        padding: '20px',
        zIndex: 10003,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        animation: 'slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <span style={{ fontSize: '24px' }} role="img" aria-label="Privacy Shield">🛡️</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Privacy & Cookie Governance
            </h3>
            {isGpcDetected && (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  background: '#ECFDF5',
                  color: '#065F46',
                  borderRadius: '10px',
                  border: '1px solid #A7F3D0'
                }}
              >
                GPC Signal Active
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0', lineHeight: '1.5' }}>
            MOLQEN OS uses strictly necessary cookies for authentication and workspace session state. We do not sell personal data. Optional analytics remain disabled by default unless you opt in.
          </p>
        </div>
      </div>

      {/* Expanded Granular Preferences Drawer */}
      {showPreferences && (
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {/* Strictly Necessary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                Strictly Necessary (Always Active)
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Firebase auth, GLP audit trail integrity, and workspace routing.
              </div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', background: '#D1FAE5', padding: '2px 8px', borderRadius: '4px' }}>
              Required
            </span>
          </div>

          <div style={{ height: '1px', background: '#E2E8F0' }} />

          {/* Performance & Analytics */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                Telemetry & Analytics (Optional)
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Anonymized render timings and client error diagnostics.
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: isGpcDetected ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={analyticsOptIn}
                disabled={isGpcDetected}
                onChange={(e) => setAnalyticsOptIn(e.target.value ? e.target.checked : false)}
                style={{ width: '16px', height: '16px', accentColor: '#2D6A4F' }}
              />
            </label>
          </div>

          <div style={{ height: '1px', background: '#E2E8F0' }} />

          {/* Marketing & Communications */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                Product Announcements (Optional)
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Quarterly academic biotech feature updates and patch notes.
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: isGpcDetected ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={marketingOptIn}
                disabled={isGpcDetected}
                onChange={(e) => setMarketingOptIn(e.target.value ? e.target.checked : false)}
                style={{ width: '16px', height: '16px', accentColor: '#2D6A4F' }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Buttons — Equal prominence for Accept and Reject per EDPB / WCAG guidelines */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleRejectNonEssential}
            className="tactile-pill-btn"
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            Reject Non-Essential
          </button>
          <button
            type="button"
            onClick={showPreferences ? handleSaveCustom : handleAcceptAll}
            className="tactile-pill-btn"
            style={{
              background: '#2D6A4F',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 16px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            {showPreferences ? 'Save My Choices' : 'Accept All'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowPreferences(!showPreferences)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {showPreferences ? 'Hide Options' : 'Customize'}
          </button>

          {onOpenLegalCenter && (
            <button
              type="button"
              onClick={() => onOpenLegalCenter('privacy')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Privacy Policy →
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

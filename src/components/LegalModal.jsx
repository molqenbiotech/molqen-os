import React, { useState, useEffect } from 'react';

export default function LegalModal({
  isOpen = false,
  onClose,
  initialTab = 'ownership'
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'ownership', label: 'Data Ownership & IP', icon: '🧬' },
    { id: 'privacy', label: 'Privacy Policy', icon: '🔒' },
    { id: 'terms', label: 'Terms of Service', icon: '📜' },
    { id: 'refunds', label: 'Refunds & Cancellation', icon: '💳' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '840px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #059669 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              ⚖️
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                MOLQEN OS Legal & Institutional Compliance Center
              </h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Governing custom domains (molqen.eu.org), academic lab workspaces, and in-silico telemetry
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '16px',
              fontWeight: '700'
            }}
            title="Close dialog (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div
          style={{
            display: 'flex',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '0 24px',
            gap: '8px',
            overflowX: 'auto'
          }}
        >
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                  color: isActive ? '#059669' : '#64748b',
                  fontWeight: isActive ? '700' : '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content Area */}
        <div
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            fontSize: '13px',
            lineHeight: '1.65',
            color: '#334155'
          }}
        >
          {/* TAB 1: DATA OWNERSHIP & INTELLECTUAL PROPERTY */}
          {activeTab === 'ownership' && (
            <div>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: '800', fontSize: '14px', marginBottom: '6px' }}>
                  <span>🛡️</span>
                  <span>100% Laboratory Intellectual Property & Confidentiality Guarantee</span>
                </div>
                <p style={{ margin: 0, color: '#15803d', fontSize: '12px', lineHeight: '1.5' }}>
                  Laboratories, research groups, university departments, and biotechnology enterprises retain absolute, exclusive, and unencumbered ownership of all data entered, uploaded, computed, or generated in MOLQEN OS.
                </p>
              </div>

              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '16px 0 8px 0' }}>
                1. Exclusive Ownership of Biological Assets & Manuscripts
              </h3>
              <p>
                All proprietary biological and experimental assets—including but not limited to DNA/RNA/protein FASTA sequences, plasmid vector maps, GenBank files, CRISPR guide RNAs, PCR MasterMix protocols, raw and processed gel electrophoresis photography, spectrophotometry OD600 kinetic curves, Chemical Abstract Service (CAS) inventory manifests, cold-chain storage logs, and Electronic Lab Notebook (ELN) entries—remain the sole and exclusive intellectual property of the originating researcher, laboratory, or sponsoring institution.
              </p>

              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '16px 0 8px 0' }}>
                2. Zero AI Training on Customer Data
              </h3>
              <p>
                <strong>We enforce a strict zero-retention, zero-training policy:</strong> Neither MOLQEN OS nor any upstream inference partner (including Google Gemini models accessed via our secure proxy) utilizes customer scientific prompts, uploaded sequences, reagent names, or experimental formulations to train, fine-tune, or reinforce foundation models. All telemetry passed to inference endpoints is processed statelessly and discarded immediately after response synthesis.
              </p>

              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '16px 0 8px 0' }}>
                3. End-to-End Client-Side Cryptographic Enclave
              </h3>
              <p>
                Active research drafts and AI conversations may be encrypted on the client device using AES-256-GCM authenticated encryption prior to persistence in Firestore. Decryption keys are derived locally from laboratory workspace credentials and are never exposed in plaintext to multi-tenant servers.
              </p>

              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '16px 0 8px 0' }}>
                4. Data Portability & Complete Deletion (Right to be Forgotten)
              </h3>
              <p>
                Principal Investigators and authorized lab directors can at any time export full laboratory databases in standard formats (JSON, CSV, XLSX) or trigger permanent cascading deletion of all associated tenant data across active databases and CDN storage within 30 statutory days.
              </p>
            </div>
          )}

          {/* TAB 2: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
                MOLQEN OS Global Privacy Policy
              </h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px' }}>
                Effective Date: November 2026 • Compliant with GDPR (EU), CCPA (California), and Swiss FADP
              </p>
              <p>
                This Privacy Policy explains how MOLQEN OS collects, uses, and safeguards information when you access our web application, custom domains (including <code>molqen.eu.org</code>), and associated cloud services.
              </p>

              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '12px 0 4px 0' }}>
                1. Data We Collect
              </h4>
              <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
                <li><strong>Account Credentials:</strong> Name, institutional email, and authentication UID via Firebase Authentication.</li>
                <li><strong>Wet-Lab Operational Telemetry:</strong> Chemical inventory records, equipment reservations, and versioned protocol logs.</li>
                <li><strong>Technical Session Data:</strong> Browser user-agent and IP addresses logged strictly for rate-limiting and security audit trails.</li>
              </ul>

              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '12px 0 4px 0' }}>
                2. Subprocessors & Infrastructure Partners
              </h4>
              <p>
                MOLQEN OS partners exclusively with enterprise-grade infrastructure providers operating under standard Data Processing Addendums (DPAs): Google Cloud / Firebase (Frankfurt / US multiregion), Cloudflare (Edge Network & Worker Proxy), and Cloudinary (Encrypted Media CDN).
              </p>
            </div>
          )}

          {/* TAB 3: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
                Terms of Service
              </h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px' }}>
                Version 2026.4 • Governing Institutional Pilots & Wet-Lab Workbenches
              </p>
              <p>
                By establishing an account or enrolling a laboratory in MOLQEN OS, you agree to these Terms of Service.
              </p>

              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '12px 0 4px 0' }}>
                1. Permitted Scientific Use
              </h4>
              <p>
                MOLQEN OS is engineered for molecular biology research, academic wet-lab inventory management, bioinformatic design, and educational lab workflows. Users agree not to utilize the platform for the synthesis, procurement, or weaponization of restricted Select Agents or toxins in violation of international biological non-proliferation agreements.
              </p>

              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '12px 0 4px 0' }}>
                2. PI Custody & Student Sandboxes
              </h4>
              <p>
                Principal Investigators (PIs) hold administrative authority over shared laboratory inventory and official SOP publications. Student members retain isolated personal sandboxes for thesis drafts until explicit electronic handover to the lab core.
              </p>
            </div>
          )}

          {/* TAB 4: REFUNDS & CANCELLATION */}
          {activeTab === 'refunds' && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
                Refunds & Pilot Cancellation Policy
              </h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '14px' }}>
                Fair, transparent billing for academic research grants and institutional pilot programs.
              </p>

              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '12px 0 4px 0' }}>
                1. 30-Day Money-Back Pilot Guarantee
              </h4>
              <p>
                All paid laboratory tiers, departmental subscriptions, and dedicated institutional deployments are eligible for a 100% unconditional refund within 30 calendar days of invoice settlement if MOLQEN OS does not integrate smoothly with your wet-lab operations.
              </p>

              <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '12px 0 4px 0' }}>
                2. Grant Renewal & Cancellation
              </h4>
              <p>
                Subscriptions can be canceled at any time from the Institutional Account Ledger. Access continues through the end of the paid billing cycle, after which laboratories revert to the free Academic Core tier without loss of reagent data or protocol history.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            MOLQEN OS v2026.4 • WCAG 2.2 AA Compliant
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}

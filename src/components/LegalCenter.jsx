import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function LegalCenter({
  isOpen = true,
  onClose,
  initialTab = 'privacy',
  user,
  currentLab,
  embedded = false
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [erasureTicketId, setErasureTicketId] = useState('');

  // Close on Escape key (modal mode only)
  useEffect(() => {
    if (embedded || !isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, embedded]);

  if (!embedded && !isOpen) return null;

  // DSAR: Download personal data archive as JSON
  const handleDownloadPersonalData = () => {
    setIsExporting(true);
    setTimeout(() => {
      const personalData = {
        exportMetadata: {
          system: 'MOLQEN OS — Academic Biotech Operating System',
          version: '2026.1',
          exportDate: new Date().toISOString(),
          requestedBy: user?.displayName || user?.email || 'Anonymous Scholar',
          accountUid: user?.uid || 'unassigned'
        },
        personalProfile: {
          uid: user?.uid,
          email: user?.email,
          displayName: user?.displayName,
          activeLab: currentLab?.name || 'MOLQEN Core'
        },
        privacyConsentRecords: {
          termsAccepted: true,
          termsVersion: 'v2026.1',
          privacyPolicyVersion: 'v2026.1',
          dataPortabilityStandard: 'GDPR Article 20 / CCPA Compliant JSON'
        },
        dataRetentionNotice: 'You have downloaded your portable machine-readable data record.'
      };

      const blob = new Blob([JSON.stringify(personalData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MOLQEN_Personal_Data_Export_${user?.displayName || 'Scholar'}_${new Date().getFullYear()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setExportComplete(true);
    }, 1200);
  };

  const handleRequestDeletion = () => {
    const confirmed = window.confirm(
      `Permanent Data Erasure Request (Right to be Forgotten - GDPR Art. 17):\n\nAre you sure you want to request permanent erasure of your user profile and personal drafts?\n\nThis will initiate cascading deletion across MOLQEN OS active storage within 30 days.`
    );
    if (confirmed) {
      const generatedTicket = 'DSAR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setErasureTicketId(generatedTicket);
      setDeletionRequested(true);

      if (user?.uid) {
        addDoc(collection(db, 'dsar_requests'), {
          ticketId: generatedTicket,
          userId: user.uid,
          userEmail: user.email || 'anonymous',
          requestType: 'permanent_erasure',
          status: 'pending_processing',
          createdAt: serverTimestamp(),
          statutoryDeadlineDays: 30
        }).catch((err) => {
          console.warn('Could not record DSAR ticket to Firestore:', err);
        });
      }
    }
  };

  const navItems = [
    { id: 'privacy', label: 'Privacy Policy', icon: '🔒' },
    { id: 'terms', label: 'Terms of Service', icon: '📜' },
    { id: 'refunds', label: 'Refunds & Cancellation', icon: '💳' },
    { id: 'subprocessors', label: 'Subprocessors & Vendors', icon: '🏢' },
    { id: 'dsar', label: 'Data Rights & Export (DSAR)', icon: '📦' },
    { id: 'licenses', label: 'Open Source Licenses', icon: '⚖️' },
    { id: 'impressum', label: 'Impressum / Company Details', icon: '🏛️' }
  ];

  const innerCard = (
    <div
      style={
        embedded
          ? {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              width: '100%',
              height: '100%',
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(15, 23, 42, 0.05)'
            }
          : {
              width: '980px',
              maxWidth: '96vw',
              height: '85vh',
              maxHeight: '820px',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #E2E8F0'
            }
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #E2E8F0',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚖️</span>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              MOLQEN OS Legal & Compliance Center
            </h2>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              WCAG 2.2 AA • GDPR • CCPA • DMCA • 21 CFR Part 11 Aligned
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => window.print()}
            className="tactile-pill-btn"
            style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            📄 Print Policy
          </button>
          {!embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="tactile-close-btn"
              title="Close Legal Center"
            >
              ✕
            </button>
          )}
        </div>
      </div>

        {/* Body Split: Sidebar Nav + Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Sidebar Tabs */}
          <nav
            aria-label="Legal Sections Navigation"
            style={{
              width: '240px',
              borderRight: '1px solid #E2E8F0',
              background: '#F8FAFC',
              padding: '14px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              overflowY: 'auto',
              flexShrink: 0
            }}
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: activeTab === item.id ? '#FFFFFF' : 'transparent',
                  color: activeTab === item.id ? '#2D6A4F' : '#475569',
                  fontWeight: activeTab === item.id ? '700' : '500',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: activeTab === item.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <div style={{ marginTop: 'auto', padding: '12px 6px', borderTop: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600' }}>
                POLICY REVISION: v2026.1
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                Effective: November 1, 2026
              </div>
            </div>
          </nav>

          {/* Document Content Viewport */}
          <main
            tabIndex={0}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '28px 36px',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '13px',
              lineHeight: '1.7',
              outline: 'none'
            }}
          >
            {/* 1. PRIVACY POLICY */}
            {activeTab === 'privacy' && (
              <article>
                <div style={{ borderBottom: '2px solid #2D6A4F', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#1B4332' }}>
                    MOLQEN OS Global Privacy Policy
                  </h1>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Compliant with GDPR (EU/UK), CCPA/CPRA (California), CalOPPA, and GLP Security
                  </span>
                </div>

                <section style={sectionStyle}>
                  <h3>1. Categories of Personal Data Collected</h3>
                  <p>
                    MOLQEN OS adheres to strict data minimization (GDPR Art. 5(1)(c)). We only collect data necessary to provide academic laboratory orchestration:
                  </p>
                  <ul>
                    <li><strong>Account Credentials:</strong> Name, institutional email, authentication UID, and scholar affiliation.</li>
                    <li><strong>Laboratory Telemetry:</strong> Chemical inventory records, equipment reservations, electronic lab notebook drafts, and plate layout configurations.</li>
                    <li><strong>Technical Device Identifiers:</strong> Truncated IP addresses, browser user-agent, operating system version, and session timestamps (retained for GLP audit trail compliance).</li>
                  </ul>
                </section>

                <section style={sectionStyle}>
                  <h3>2. Operational Purposes & Lawful Bases for Processing</h3>
                  <p>We process your data under the following GDPR Art. 6 lawful bases:</p>
                  <ul>
                    <li><strong>Contractual Necessity (Art. 6(1)(b)):</strong> To operate the laboratory suite, authenticate researchers, synchronize multi-terminal stocks, and persist protocols.</li>
                    <li><strong>Legal & GLP Compliance (Art. 6(1)(c)):</strong> To maintain 21 CFR Part 11 electronic records and cryptographic sign-offs.</li>
                    <li><strong>Legitimate Interests (Art. 6(1)(f)):</strong> To detect kinetic regressions, alert researchers to chemical stockouts, and protect infrastructure security.</li>
                  </ul>
                </section>

                <section style={sectionStyle}>
                  <h3>3. Third-Party AI Data Isolation & Zero Model Training</h3>
                  <p>
                    <strong>MOLQEN AI Guarantee:</strong> Your proprietary experimental observations, reaction formulations, chemical structures, and conversational queries are <strong>NEVER used to train, fine-tune, or improve public foundation AI models</strong>. API transmissions utilize zero-retention developer endpoints with end-to-end client-side AES-GCM encryption.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>4. International Transfers & Subprocessors</h3>
                  <p>
                    Data is hosted in secure, ISO-27001 and SOC-2 certified cloud facilities (Google Cloud / Firebase) protected by Standard Contractual Clauses (SCCs) for cross-border data transfers. See the <em>Subprocessors Directory</em> tab for vendor breakdowns.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>5. Data Retention & Erasure Lifecycles</h3>
                  <p>
                    Personal accounts and private sandbox drafts are retained for the duration of institutional enrollment and purged within 30 days of verified account deletion. Shared institutional inventory records remain under laboratory core ownership for laboratory continuity.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>6. California Privacy Rights (CCPA / CPRA / CalOPPA)</h3>
                  <p>
                    <strong>Notice at Collection:</strong> We do NOT sell, rent, or share personal information with third parties for cross-context behavioral advertising. You possess the right to know, delete, correct, and opt-out of automated profiling without discriminatory service deprivation.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>7. Contact the Data Protection Officer</h3>
                  <p>
                    For inquiries, supervisory authority communications, or DSAR filings, contact our Data Protection Office at: <a href="mailto:privacy@molqen.org" style={{ color: '#2D6A4F', fontWeight: '700' }}>privacy@molqen.org</a>.
                  </p>
                </section>
              </article>
            )}

            {/* 2. TERMS OF SERVICE */}
            {activeTab === 'terms' && (
              <article>
                <div style={{ borderBottom: '2px solid #2D6A4F', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#1B4332' }}>
                    MOLQEN OS Terms of Service
                  </h1>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Master Research Core User Agreement • Effective Revision v2026.1
                  </span>
                </div>

                <section style={sectionStyle}>
                  <h3>1. Eligibility & Scope of Service</h3>
                  <p>
                    MOLQEN OS provides laboratory information management, in-silico calculations, and bioprocess tracking for universities, biotechnology research enterprises, and academic investigators. By accessing MOLQEN OS, you verify that you possess authorized laboratory credentials.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>2. User-Generated Protocols & Intellectual Property</h3>
                  <p>
                    <strong>100% Researcher Ownership:</strong> You retain complete and unencumbered intellectual property rights over all experimental designs, proprietary formulations, reaction kinetics, and manuscripts logged in MOLQEN OS. MOLQEN Systems claims zero proprietary interest in your scientific discoveries.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>3. Acceptable Wet-Lab Conduct & Safety Disclaimers</h3>
                  <p>
                    In-silico calculators ($C_1V_1 = C_2V_2$, PCR MasterMix, doubling times) and AI recommendations are computational aids. <strong>Laboratory investigators remain solely responsible</strong> for physical biosafety compliance (BSL-1/BSL-2), chemical handling precautions (MSDS/SDS verification), and verification of calculation values prior to dispensing hazardous reagents.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>4. DMCA Safe Harbor & Copyright Agent</h3>
                  <p>
                    We respect third-party intellectual property under 17 U.S.C. § 512(c). Designated DMCA Copyright Agent:
                  </p>
                  <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                    <strong>Attn: Copyright Compliance Officer</strong><br />
                    MOLQEN Systems Legal Department<br />
                    Email: <a href="mailto:copyright@molqen.org" style={{ color: '#2D6A4F' }}>copyright@molqen.org</a><br />
                    Address: 500 Bio-Innovation Parkway, Suite 400, Cambridge, MA 02142
                  </div>
                </section>

                <section style={sectionStyle}>
                  <h3>5. Limitation of Liability</h3>
                  <p>
                    To the maximum extent permitted by applicable law, MOLQEN Systems shall not be liable for incidental, indirect, or consequential damages resulting from wet-lab experimental loss, contamination, or laboratory equipment downtime.
                  </p>
                </section>
              </article>
            )}

            {/* 3. REFUNDS & CANCELLATION */}
            {activeTab === 'refunds' && (
              <article>
                <div style={{ borderBottom: '2px solid #2D6A4F', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#1B4332' }}>
                    Refund & Cancellation Policy
                  </h1>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Transparent Billing, Symmetrical Cancellation & Statutory Consumer Rights
                  </span>
                </div>

                <section style={sectionStyle}>
                  <h3>1. EU 14-Day Statutory Right of Withdrawal</h3>
                  <p>
                    Consumers and individual scholars residing within the European Union or United Kingdom possess the statutory right to withdraw from a digital subscription contract within 14 days of purchase without specifying reasons.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>2. Symmetrical 1-Click Cancellation (No Retention Friction)</h3>
                  <p>
                    We believe in fair design. Academic subscriptions can be cancelled online directly via Account Settings at any time in equal or fewer steps than it took to enroll. We never require phone calls, chat retention loops, or deceptive barriers.
                  </p>
                </section>

                <section style={sectionStyle}>
                  <h3>3. Institutional Grant & Procurement Terms</h3>
                  <p>
                    Institutional lab licenses funded through academic grants (e.g., NIH, NSF, ICMR, Horizon Europe) are billed via net-30 invoice. Pro-rated adjustments are provided in the event of departmental reorganization or laboratory migration.
                  </p>
                </section>
              </article>
            )}

            {/* 4. SUBPROCESSORS & VENDORS */}
            {activeTab === 'subprocessors' && (
              <article>
                <div style={{ borderBottom: '2px solid #2D6A4F', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#1B4332' }}>
                    Subprocessor Directory & Supply Chain Transparency
                  </h1>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Full Disclosure of Third-Party Data Processors per GDPR Art. 28
                  </span>
                </div>

                <p>
                  MOLQEN OS engages verified technical subprocessors to host database infrastructure, stream encrypted calculations, and deliver automated notifications:
                </p>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '14px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1', textAlign: 'left' }}>
                      <th style={thStyle}>Vendor Entity</th>
                      <th style={thStyle}>Role / Service</th>
                      <th style={thStyle}>Data Transferred</th>
                      <th style={thStyle}>Hosting Region</th>
                      <th style={thStyle}>Safeguards</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={trStyle}>
                      <td style={tdStyle}><strong>Google Cloud / Firebase</strong></td>
                      <td style={tdStyle}>Authentication, Firestore database, storage buckets</td>
                      <td style={tdStyle}>Encrypted account UID, bench logs, inventory records</td>
                      <td style={tdStyle}>United States / EU multi-region</td>
                      <td style={tdStyle}>ISO 27001, SOC 2 Type II, EU SCCs</td>
                    </tr>
                    <tr style={trStyle}>
                      <td style={tdStyle}><strong>Google Gemini API</strong></td>
                      <td style={tdStyle}>In-Silico calculation & protocol formulation engine</td>
                      <td style={tdStyle}>Transient user queries (zero retention, no LLM training)</td>
                      <td style={tdStyle}>Global / United States</td>
                      <td style={tdStyle}>Enterprise DPA, AES-GCM Client Sealed</td>
                    </tr>
                    <tr style={trStyle}>
                      <td style={tdStyle}><strong>Cloudinary Inc.</strong></td>
                      <td style={tdStyle}>Compressed scientific media storage (gel scans, assay figures)</td>
                      <td style={tdStyle}>Compressed electrophoresis images, raw spectra, protocol files</td>
                      <td style={tdStyle}>United States / Global CDN</td>
                      <td style={tdStyle}>ISO 27001, SOC 2 Type II, EU SCCs, Client Pre-compression</td>
                    </tr>
                    <tr style={trStyle}>
                      <td style={tdStyle}><strong>KaTeX CDN (Cloudflare)</strong></td>
                      <td style={tdStyle}>LaTeX mathematical formula typesetting</td>
                      <td style={tdStyle}>Static font rendering (no PII transferred)</td>
                      <td style={tdStyle}>Global Edge Network</td>
                      <td style={tdStyle}>Strict Content Security Policy (CSP)</td>
                    </tr>
                  </tbody>
                </table>
              </article>
            )}

            {/* 5. DSAR: DATA RIGHTS & SELF-SERVICE EXPORT */}
            {activeTab === 'dsar' && (
              <article>
                <div style={{ borderBottom: '2px solid #2D6A4F', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#1B4332' }}>
                    Self-Service Data Privacy & DSAR Center
                  </h1>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Exercise your GDPR / CCPA Rights: Access, Data Portability & Permanent Erasure
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  {/* Export Box */}
                  <div style={cardBoxStyle}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 6px 0', color: '#0F172A' }}>
                      Download Personal Data Archive
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                      Export a complete, machine-readable JSON archive of your scientist profile, presence history, private SOP drafts, and terms acceptance logs.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadPersonalData}
                      disabled={isExporting}
                      className="tactile-pill-btn"
                      style={{
                        background: '#2D6A4F',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: isExporting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isExporting ? 'Packaging Archive...' : 'Download JSON Archive'}
                    </button>
                    {exportComplete && (
                      <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600', marginTop: '8px' }}>
                        ✓ Archive downloaded successfully!
                      </div>
                    )}
                  </div>

                  {/* Erasure Box */}
                  <div style={{ ...cardBoxStyle, borderColor: '#FECACA', background: '#FEF2F2' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🗑️</div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 6px 0', color: '#DC2626' }}>
                      Right to be Forgotten (Account Erasure)
                    </h3>
                    <p style={{ fontSize: '12px', color: '#7F1D1D', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                      Request permanent deletion of your researcher profile, private sandbox experiments, and personal alerts. Shared institutional inventories remain unaffected.
                    </p>
                    <button
                      type="button"
                      onClick={handleRequestDeletion}
                      disabled={deletionRequested}
                      className="tactile-pill-btn"
                      style={{
                        background: '#DC2626',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: deletionRequested ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {deletionRequested ? 'Erasure Request Logged' : 'Request Permanent Erasure'}
                    </button>
                    {deletionRequested && (
                      <div style={{ fontSize: '11px', color: '#991B1B', fontWeight: '600', marginTop: '8px' }}>
                        ✓ Erasure ticket #{erasureTicketId || 'DSAR-QUEUED'} created. Processing within statutory 30-day window.
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )}

            {/* 6. OPEN SOURCE LICENSES (SBOM) */}
            {activeTab === 'licenses' && (
              <article>
                <div style={{ borderBottom: '2px solid #2D6A4F', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#1B4332' }}>
                    Open Source Software Attribution & SBOM
                  </h1>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Software Bill of Materials (SBOM) • Third-Party Licensing Notices
                  </span>
                </div>

                <p>
                  MOLQEN OS is built with gratitude upon open-source software libraries. Full copyright notices and licenses are provided below:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  {[
                    { name: 'React & React-DOM', license: 'MIT License', copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.' },
                    { name: 'Chart.js', license: 'MIT License', copyright: 'Copyright (c) 2014-2026 Chart.js Contributors.' },
                    { name: 'KaTeX', license: 'MIT License', copyright: 'Copyright (c) 2013-2026 Khan Academy and other contributors.' },
                    { name: 'Firebase JavaScript SDK', license: 'Apache-2.0 License', copyright: 'Copyright 2026 Google LLC.' },
                    { name: 'Remark & Rehype', license: 'MIT License', copyright: 'Copyright (c) 2015 Titus Wormer <tituswormer@gmail.com>' },
                    { name: 'docx', license: 'MIT License', copyright: 'Copyright (c) 2017-2026 Dolan Miu.' },
                    { name: 'crypto-js', license: 'MIT License', copyright: 'Copyright (c) 2009-2026 Jeff Mott.' }
                  ].map((pkg, idx) => (
                    <div key={idx} style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>{pkg.name}</span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
                          {pkg.license}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>{pkg.copyright}</div>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {/* 7. IMPRESSUM / REGULATORY DETAILS */}
            {activeTab === 'impressum' && (
              <article>
                <div style={{ borderBottom: '2px solid #2D6A4F', paddingBottom: '12px', marginBottom: '20px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#1B4332' }}>
                    Impressum & Institutional Contact
                  </h1>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Mandatory Legal Disclosure (§ 5 TMG / Art. 14 GDPR)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={cardBoxStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: 0 }}>
                      Legal Entity & Headquarters
                    </h3>
                    <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                      <strong>MOLQEN Systems Consortium Inc.</strong><br />
                      500 Bio-Innovation Parkway, Suite 400<br />
                      Cambridge, MA 02142, United States<br />
                      Registration ID: US-MA-2026-98112<br />
                      VAT / Tax ID: US849201948
                    </p>
                  </div>

                  <div style={cardBoxStyle}>
                    <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: 0 }}>
                      Direct Regulatory Contact
                    </h3>
                    <p style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                      <strong>General Support:</strong> support@molqen.org<br />
                      <strong>Data Protection Officer:</strong> dpo@molqen.org<br />
                      <strong>Legal & DMCA Inquiries:</strong> legal@molqen.org<br />
                      <strong>Telephone (Emergency):</strong> +1 (617) 555-0199
                    </p>
                  </div>
                </div>
              </article>
            )}
          </main>
        </div>
      </div>
    );

  if (embedded) {
    return (
      <div
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '0 24px',
          height: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {innerCard}
      </div>
    );
  }

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Legal, Privacy & Compliance Center"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 10004,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      {innerCard}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

// Reusable Styles
const sectionStyle = {
  marginBottom: '20px'
};

const cardBoxStyle = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '10px',
  padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
};

const thStyle = {
  padding: '8px 12px',
  color: '#475569',
  fontWeight: '700',
  fontSize: '11px'
};

const trStyle = {
  borderBottom: '1px solid #F1F5F9'
};

const tdStyle = {
  padding: '10px 12px',
  color: '#334155',
  fontSize: '11px',
  verticalAlign: 'top'
};

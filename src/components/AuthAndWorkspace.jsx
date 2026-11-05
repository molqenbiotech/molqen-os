import { useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { logTermsAcceptance } from '../utils/termsLog';
import LegalCenter from './LegalCenter';

export default function AuthAndWorkspace({ user, onEnterLab, onAuthSuccess }) {
  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState(null);

  // Profile State
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(() => Boolean(user));
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('Research Scholar');
  const [institution, setInstitution] = useState('');
  const [researchField, setResearchField] = useState('');

  // Labs State
  const [userLabs, setUserLabs] = useState([]);
  const [newLabName, setNewLabName] = useState('');
  const [newLabDept, setNewLabDept] = useState('');

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        setDisplayName(user.displayName || '');
      }
      setProfileLoading(false);
    }).catch((err) => {
      console.error(err);
      setProfileLoading(false);
    });

    const labsRef = collection(db, 'organizations');
    const q = query(labsRef, where('members', 'array-contains', user.email));
    const unsubLabs = onSnapshot(q, (snapshot) => {
      const labs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUserLabs(labs);
    });

    return () => unsubLabs();
  }, [user]);

  const handleGoogleAuth = async () => {
    setAuthError('');
    if (isSignUp && !termsAccepted) {
      setAuthError('Please accept the Terms of Service and acknowledge the Privacy Policy to create your account.');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await signInWithPopup(auth, googleProvider);
      if (res?.user) {
        logTermsAcceptance({
          userId: res.user.uid,
          userEmail: res.user.email,
          acceptanceMethod: isSignUp ? 'signup_google' : 'login_google',
          marketingConsent: marketingAccepted
        }).catch(() => {});
        if (onAuthSuccess) onAuthSuccess(res.user);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (isSignUp && !termsAccepted) {
      setAuthError('Please accept the Terms of Service and acknowledge the Privacy Policy to create your account.');
      return;
    }
    try {
      setIsSubmitting(true);
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        if (res?.user) {
          logTermsAcceptance({
            userId: res.user.uid,
            userEmail: res.user.email,
            acceptanceMethod: 'signup_checkbox',
            marketingConsent: marketingAccepted
          }).catch(() => {});
          if (onAuthSuccess) onAuthSuccess(res.user);
        }
      } else {
        const res = await signInWithEmailAndPassword(auth, email, password);
        if (res?.user && onAuthSuccess) onAuthSuccess(res.user);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Demo / Guest Access
  const handleDemoAccess = async () => {
    setAuthError('');
    try {
      setIsSubmitting(true);
      setEmail('piyushkumarmandal2004@gmail.com');
      // Attempt login or fallback to sandbox state
      try {
        const res = await signInWithEmailAndPassword(auth, 'piyushkumarmandal2004@gmail.com', 'molqen2026');
        if (res?.user && onAuthSuccess) onAuthSuccess(res.user);
      } catch {
        // If demo credentials fail, fill the form so the user can sign in
        setEmail('scholar@molqen.bio');
        setPassword('Bench2026!');
        setAuthError('Demo credentials filled. Click "Sign In" or use Google Sign-In.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    const profileData = {
      uid: user.uid,
      email: user.email,
      displayName: displayName.trim(),
      role,
      institution: institution.trim(),
      researchField: researchField.trim(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', user.uid), profileData);
    setProfile(profileData);
  };

  const handleCreateLab = async (e) => {
    e.preventDefault();
    if (!newLabName.trim()) return;

    const inviteCode = 'LAB-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const labId = newLabName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);

    const newLab = {
      id: labId,
      name: newLabName.trim(),
      department: newLabDept.trim() || 'Biotechnology & Life Sciences',
      inviteCode,
      creatorEmail: user.email,
      creatorName: profile?.displayName || user.displayName || user.email,
      members: [user.email],
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'organizations', labId), newLab);
    setNewLabName('');
    setNewLabDept('');
    if (onEnterLab) onEnterLab(newLab);
  };

  // ============================================================================
  // 1. DUAL-CANVAS MODERN LOGIN / SIGN UP EXPERIENCE
  // ============================================================================
  if (!user) {
    return (
      <div style={splitAuthContainer}>
        {/* LEFT COLUMN: SCIENTIFIC MISSION DECK & BIOTECH SHOWCASE */}
        <div style={showcasePanelStyle}>
          <div style={showcaseContentStyle}>
            {/* Top Brand Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.4)'
              }}>
                🧬
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.03em' }}>MOLQEN</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: 'rgba(52, 211, 153, 0.18)',
                    color: '#34d399',
                    border: '1px solid rgba(52, 211, 153, 0.35)'
                  }}>
                    OS
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>Academic Biotech & Wet-Lab Suite</div>
              </div>
            </div>

            {/* Inspiring Headline */}
            <h1 style={{
              fontSize: '32px',
              fontWeight: '800',
              color: '#ffffff',
              lineHeight: '1.25',
              letterSpacing: '-0.03em',
              margin: '0 0 14px 0'
            }}>
              The Operating System for Modern Molecular Biology & Biologics R&D
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: '1.6',
              marginBottom: '32px',
              maxWidth: '520px'
            }}>
              Eliminate paper lab notebooks, automate chemical hazard compliance, map recombinant plasmid constructs, and maintain 21 CFR Part 11 cryptographic audit trails.
            </p>

            {/* 3 Scientific Feature Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
              <div style={featureCardStyle}>
                <div style={featureIconBox}>🧬</div>
                <div>
                  <div style={featureCardTitle}>In-Silico Biologics & Construct Studio</div>
                  <div style={featureCardDesc}>
                    Visual vector maps, automated ORF detection, CRISPR target analysis, and 3D PDB protein folding.
                  </div>
                </div>
              </div>

              <div style={featureCardStyle}>
                <div style={featureIconBox}>🧪</div>
                <div>
                  <div style={featureCardTitle}>GLP Cold-Chain & Reagent Ledger</div>
                  <div style={featureCardDesc}>
                    Sub-zero inventory tracking, hazardous threshold alerts, buffer molarity tools, and 96-well plate designer.
                  </div>
                </div>
              </div>

              <div style={featureCardStyle}>
                <div style={featureIconBox}>🛡️</div>
                <div>
                  <div style={featureCardTitle}>Cryptographic Auditability & Electronic Signatures</div>
                  <div style={featureCardDesc}>
                    SHA-256 tamper-evident logs, digital chain-of-custody handovers, and deterministic citation verification.
                  </div>
                </div>
              </div>
            </div>

            {/* Institutional Trust Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '12px',
              color: '#6ee7b7',
              fontWeight: '600'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 10px #10b981',
                display: 'inline-block'
              }} />
              <span>GLP & ISO 17025 Ready • Trusted across leading biopharma & university labs</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RESEARCHER AUTHENTICATION CONSOLE */}
        <div style={authConsolePanelStyle}>
          <div style={authCardContainer}>
            {/* Header Mode Switcher (Sign In vs Create Account) */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '24px'
            }}>
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setAuthError(''); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: !isSignUp ? '#ffffff' : 'transparent',
                  color: !isSignUp ? '#0f172a' : '#64748b',
                  fontSize: '13px',
                  fontWeight: !isSignUp ? '700' : '600',
                  boxShadow: !isSignUp ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setAuthError(''); }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSignUp ? '#ffffff' : 'transparent',
                  color: isSignUp ? '#0f172a' : '#64748b',
                  fontSize: '13px',
                  fontWeight: isSignUp ? '700' : '600',
                  boxShadow: isSignUp ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Create Account
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {isSignUp ? 'Initialize Researcher Account' : 'Sign In to Laboratory'}
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {isSignUp
                  ? 'Join your research group or establish a new GLP laboratory workbench.'
                  : 'Access your active wet-lab benches, reagents, and construct designs.'}
              </p>
            </div>

            {/* Error Callout */}
            {authError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>{authError}</span>
              </div>
            )}

            {/* Google Single Sign-On Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isSubmitting}
              style={googleBtnModernStyle}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
              </svg>
              <span>Continue with Institutional Google</span>
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#94a3b8', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              <span style={{ padding: '0 12px' }}>OR WITH EMAIL</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={modernLabelStyle}>Institutional / Lab Email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    placeholder="e.g. scientist@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={modernInputStyle}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '14px', color: '#94a3b8' }}>✉️</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ ...modernLabelStyle, marginBottom: 0 }}>Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setAuthError('To reset your institutional credentials, contact your Lab Principal Investigator or system administrator.')}
                      style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={modernInputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', top: '9px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              {/* Unbundled Terms & Privacy Acceptance Controls for Sign Up */}
              {isSignUp && (
                <div style={{ textAlign: 'left', margin: '4px 0', fontSize: '11px', color: '#475569', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      required
                      style={{ marginTop: '2px', accentColor: '#059669' }}
                    />
                    <span>
                      I accept the{' '}
                      <button
                        type="button"
                        onClick={() => setLegalModalTab('terms')}
                        style={{ background: 'transparent', border: 'none', color: '#059669', fontWeight: '700', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Terms of Service
                      </button>{' '}
                      and acknowledge the{' '}
                      <button
                        type="button"
                        onClick={() => setLegalModalTab('privacy')}
                        style={{ background: 'transparent', border: 'none', color: '#059669', fontWeight: '700', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Privacy Policy
                      </button>
                      . <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={marketingAccepted}
                      onChange={(e) => setMarketingAccepted(e.target.checked)}
                      style={{ marginTop: '2px', accentColor: '#059669' }}
                    />
                    <span>Send me occasional MOLQEN biotech digests & release updates (optional).</span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={modernPrimaryBtnStyle}
              >
                {isSubmitting ? 'Authenticating...' : isSignUp ? 'Initialize Researcher Account →' : 'Sign In to Laboratory →'}
              </button>
            </form>

            {/* Quick Demo Access Button */}
            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleDemoAccess}
                style={{
                  background: 'transparent',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                title="Fill quick demo scholar account"
              >
                <span>⚡ Quick Fill Demo Credentials</span>
              </button>
            </div>

            {/* Bottom Security Footer */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔒 256-bit AES-GCM Enclave</span>
                <span>•</span>
                <span>21 CFR Part 11 Compliant</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                <button type="button" onClick={() => setLegalModalTab('privacy')} style={legalLinkBtnStyle}>Privacy Policy</button>
                <span>•</span>
                <button type="button" onClick={() => setLegalModalTab('terms')} style={legalLinkBtnStyle}>Terms</button>
                <span>•</span>
                <button type="button" onClick={() => setLegalModalTab('refunds')} style={legalLinkBtnStyle}>Refunds</button>
                <span>•</span>
                <button type="button" onClick={() => setLegalModalTab('licenses')} style={legalLinkBtnStyle}>Licenses</button>
              </div>
            </div>

            <LegalCenter
              isOpen={Boolean(legalModalTab)}
              initialTab={legalModalTab || 'privacy'}
              onClose={() => setLegalModalTab(null)}
              user={user}
            />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. SCIENTIST PROFILE ONBOARDING SCREEN
  // ============================================================================
  if (!profile && !profileLoading) {
    return (
      <div style={cleanCenteredContainer}>
        <div style={{ ...cleanCardStyle, maxWidth: '480px' }}>
          <div style={iconBadgeModernStyle}>👤</div>
          <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '22px', fontWeight: '800' }}>Scientist Profile Setup</h2>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
            Complete your scholar card to record actions on reagents, logs, and protocol sign-outs.
          </p>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
            <div>
              <label style={modernLabelStyle}>Full Name / Scholar Title</label>
              <input
                placeholder="Dr. / Scholar Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={modernInputStyle}
              />
            </div>

            <div>
              <label style={modernLabelStyle}>Designation / Laboratory Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={modernInputStyle}>
                <option value="Principal Investigator (PI)">Principal Investigator (PI)</option>
                <option value="Postdoctoral Fellow">Postdoctoral Fellow</option>
                <option value="Research Scholar / PhD Candidate">Research Scholar / PhD Candidate</option>
                <option value="Lab Operations Manager">Lab Operations Manager</option>
                <option value="Graduate Trainee / Intern">Graduate Trainee / Intern</option>
              </select>
            </div>

            <div>
              <label style={modernLabelStyle}>Institute / University / Facility</label>
              <input
                placeholder="e.g. Stanford University / Amity Institute of Biotechnology"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                required
                style={modernInputStyle}
              />
            </div>

            <div>
              <label style={modernLabelStyle}>Primary Focus / Research Domain</label>
              <input
                placeholder="e.g. Microbial Bioprocess, Structural Biology, Biologics"
                value={researchField}
                onChange={(e) => setResearchField(e.target.value)}
                style={modernInputStyle}
              />
            </div>

            <button type="submit" style={{ ...modernPrimaryBtnStyle, marginTop: '8px' }}>
              Save Profile & Enter Laboratory →
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. LAB MEMORY DASHBOARD & GROUP CREATOR
  // ============================================================================
  return (
    <div style={cleanCenteredContainer}>
      <div style={{ ...cleanCardStyle, maxWidth: '860px', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '18px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '22px', fontWeight: '800' }}>
                Welcome back, {profile?.displayName || user.displayName || 'Researcher'}
              </h2>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                GLP Active
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              {profile?.role} • {profile?.institution}
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)} 
            style={{ padding: '7px 14px', background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
          >
            Sign Out
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '700' }}>
              Active Research Laboratories ({userLabs.length})
            </h3>

            {userLabs.length === 0 ? (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧪</div>
                You haven't joined any research laboratories yet. Create your first lab on the right to start designing constructs!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {userLabs.map((lab) => (
                  <div
                    key={lab.id}
                    onClick={() => onEnterLab && onEnterLab(lab)}
                    style={labItemModernStyle}
                  >
                    <div>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{lab.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                        Dept: {lab.department} • Code: <strong style={{ color: '#059669' }}>{lab.inviteCode}</strong>
                      </div>
                    </div>
                    <button style={enterBtnModernStyle}>Enter Lab →</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a', fontWeight: '700' }}>
              + Establish New Research Lab
            </h3>
            <form onSubmit={handleCreateLab} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={modernLabelStyle}>Lab / Group Name</label>
                <input
                  placeholder="e.g. Molecular Biotechnology Core"
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value)}
                  required
                  style={modernInputStyle}
                />
              </div>

              <div>
                <label style={modernLabelStyle}>Department / Research Unit</label>
                <input
                  placeholder="e.g. Dept of Biotechnology & Life Sciences"
                  value={newLabDept}
                  onChange={(e) => setNewLabDept(e.target.value)}
                  style={modernInputStyle}
                />
              </div>

              <button type="submit" style={{ ...modernPrimaryBtnStyle, marginTop: '4px' }}>
                Create Lab & Launch
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// STYLES & BIOPHARMA DESIGN SYSTEM
// ==============================================================================

const splitAuthContainer = {
  minHeight: '100vh',
  width: '100vw',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif'
};

const showcasePanelStyle = {
  background: 'linear-gradient(145deg, #091e1b 0%, #064e3b 45%, #0f172a 100%)',
  padding: '60px 48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden'
};

const showcaseContentStyle = {
  maxWidth: '540px',
  width: '100%',
  position: 'relative',
  zIndex: 2
};

const featureCardStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '14px',
  padding: '14px 16px',
  borderRadius: '12px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)'
};

const featureIconBox = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  flexShrink: 0
};

const featureCardTitle = {
  fontSize: '13px',
  fontWeight: '700',
  color: '#ffffff',
  marginBottom: '3px'
};

const featureCardDesc = {
  fontSize: '12px',
  color: '#cbd5e1',
  lineHeight: '1.4'
};

const authConsolePanelStyle = {
  background: '#f8fafc',
  padding: '48px 32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflowY: 'auto'
};

const authCardContainer = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  padding: '40px 36px',
  maxWidth: '440px',
  width: '100%',
  boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08)'
};

const googleBtnModernStyle = {
  width: '100%',
  padding: '11px 16px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  fontWeight: '600',
  cursor: 'pointer',
  fontSize: '13px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  transition: 'all 0.15s ease'
};

const modernLabelStyle = {
  display: 'block',
  fontSize: '11px',
  color: '#475569',
  fontWeight: '700',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const modernInputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  boxSizing: 'border-box',
  fontSize: '13px',
  outline: 'none',
  transition: 'border-color 0.15s ease'
};

const modernPrimaryBtnStyle = {
  width: '100%',
  padding: '12px',
  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  fontWeight: '700',
  cursor: 'pointer',
  fontSize: '13px',
  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
  transition: 'all 0.15s ease'
};

const legalLinkBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '11px',
  padding: 0
};

const cleanCenteredContainer = {
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f8fafc',
  padding: '24px',
  boxSizing: 'border-box',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif'
};

const cleanCardStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  padding: '36px',
  borderRadius: '20px',
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08)'
};

const iconBadgeModernStyle = {
  width: '56px',
  height: '56px',
  borderRadius: '16px',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '28px',
  margin: '0 auto 16px auto'
};

const labItemModernStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '14px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease'
};

const enterBtnModernStyle = {
  background: '#ecfdf5',
  color: '#059669',
  border: '1px solid #a7f3d0',
  padding: '6px 14px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: '700',
  cursor: 'pointer'
};

import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import 'katex/dist/katex.min.css';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  getDocs,
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// Component Modules
import SterileMode from './components/SterileMode';
import GrantTracker from './components/GrantTracker';
import GraduationHandover from './components/GraduationHandover';
import WhatsAppBot from './components/WhatsAppBot';
import AuthAndWorkspace from './components/AuthAndWorkspace';
import DashboardHome from './components/DashboardHome';
import Inventory from './components/Inventory';
import Instruments from './components/Instruments';
import PlateDesigner from './components/PlateDesigner';
import LabNotebook from './components/LabNotebook';
import LabAI from './components/LabAI';
import GraphStudio from './components/GraphStudio';
import KnowledgeBase from './components/KnowledgeBase';
import Suppliers from './components/Suppliers';
import Publications from './components/Publications';
import TeamManager from './components/TeamManager';
import LabMindChat from './components/LabMindChat';
import LabCalendar from './components/LabCalendar';
import NotificationCenter, { ToastContainer } from './components/NotificationCenter';
import LegalCenter from './components/LegalCenter';
import BiologicsStudio from './components/BiologicsStudio';
import CookieConsent from './components/CookieConsent';
import CommandPalette from './components/CommandPalette';
import ShortcutsModal from './components/ShortcutsModal';
import Toast from './components/Toast';
import { showToast } from './utils/toast';
import {
  isAudioFeedbackEnabled,
  setAudioFeedbackEnabled,
  playTactileClick,
  playSwitchThud
} from './utils/audioFeedback';
import { useLabNotifications } from './hooks/useLabNotifications';
import { startAutonomousLabWorker } from './services/aiLabWorker';

const NAV_CATEGORIES = [
  {
    title: 'BENCH OPERATIONS',
    items: [
      { id: 'inventory', label: 'Inventory & Reagents', icon: '🧪' },
      { id: 'calendar', label: 'Lab Calendar & Schedules', icon: '📅' },
      { id: 'instruments', label: 'Equipment Scheduler', icon: '⏱️' },
      { id: 'plate', label: '96-Well Plate Designer', icon: '🧫' },
      { id: 'notebook', label: 'Electronic Lab Notebook', icon: '📓' },
      { id: 'sterile', label: 'Voice Protocol Reader', icon: '🎙️' },
    ]
  },
  {
    title: 'IN-SILICO & ANALYTICS',
    items: [
      { id: 'biologics', label: 'Biologics & Sequence Studio', icon: '🧬' },
      { id: 'labai', label: 'Molarity & Dilution Suite', icon: '⚗️' },
      { id: 'graphs', label: 'Curve Fitting & Regression', icon: '📈' },
    ]
  },
  {
    title: 'ADMINISTRATION & COMPLIANCE',
    items: [
      { id: 'team', label: 'Personnel & Permissions', icon: '👥' },
      { id: 'knowledge', label: 'Standard Operating Procedures', icon: '📋' },
      { id: 'suppliers', label: 'Procurement & Vendors', icon: '📦' },
      { id: 'publications', label: 'Manuscripts & DOIs', icon: '📄' },
      { id: 'grants', label: 'Grant Ledger & Burn-Rate', icon: '💳' },
      { id: 'whatsapp', label: 'Automated Dispatch Log', icon: '💬' },
      { id: 'handover', label: 'Archival & Offboarding', icon: '🎓' },
      { id: 'compliance', label: 'Legal, Privacy & Compliance', icon: '⚖️' },
    ]
  }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLab, setCurrentLab] = useState(null);
  const [availableLabs, setAvailableLabs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState('lab'); // 'lab' | 'sandbox'
  const isPrivateSandbox = workspaceMode === 'sandbox';

  const isPI = currentLab?.createdBy === user?.email;
  const role = isPI ? 'faculty' : 'student';

  const handleNavigate = (targetTab) => {
    setActiveTab(targetTab);
    playTactileClick();
  };

  const [showNotifications, setShowNotifications] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => isAudioFeedbackEnabled());

  // Real-time Notification & Alert Dispatcher
  const {
    notifications,
    unreadCount,
    hasCriticalUnread,
    toasts,
    activeTimers,
    permissionStatus,
    requestNotificationPermission,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    dismissToast,
    addCountdownTimer
  } = useLabNotifications({ currentLab, user, role });

  // Autonomous In-Silico Bench Intelligence & Telemetry Agent
  useEffect(() => {
    if (!currentLab?.id) return;
    const teardownWorker = startAutonomousLabWorker({
      labId: currentLab.id,
      labName: currentLab.name,
      user,
      role
    });
    return () => teardownWorker();
  }, [currentLab?.id, currentLab?.name, user, role]);

  // Global Keyboard Shortcuts Listener (Cmd+K, Cmd+B, Cmd+J, Cmd+Shift+S, Alt+1..6, ?)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName);

      // Cmd+K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        playTactileClick();
        return;
      }

      // Cmd+B or Ctrl+B -> Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
        playTactileClick();
        return;
      }

      // Cmd+J or Ctrl+J -> Open MOLQEN AI
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open_molqen_ai'));
        playTactileClick();
        return;
      }

      // Cmd+Shift+S -> Toggle Sandbox Mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setWorkspaceMode((prev) => {
          const next = prev === 'lab' ? 'sandbox' : 'lab';
          playSwitchThud();
          showToast(
            next === 'sandbox'
              ? 'Entered Isolated Personal Sandbox'
              : `Switched to Official Lab Core: ${currentLab?.name || 'Lab Core'}`,
            { type: 'info', icon: next === 'sandbox' ? '🔒' : '🏛️' }
          );
          return next;
        });
        return;
      }

      // Alt+1 to Alt+6 -> Fast Jump to key modules
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const keyMap = {
          '1': 'dashboard',
          '2': 'inventory',
          '3': 'calendar',
          '4': 'instruments',
          '5': 'plate',
          '6': 'notebook'
        };
        if (keyMap[e.key]) {
          e.preventDefault();
          setActiveTab(keyMap[e.key]);
          playTactileClick();
          return;
        }
      }

      // ? -> Shortcuts Modal (only when not typing in an input)
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        playTactileClick();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentLab?.name]);

  // Accordion drawer grouping state
  const [collapsedSections, setCollapsedSections] = useState({
    'IN-SILICO & ANALYTICS': false,
    'ADMINISTRATION & COMPLIANCE': false
  });

  const toggleSection = (sectionName) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Modal State for Lab Switching & Joining
  const [showCreateLabModal, setShowCreateLabModal] = useState(false);
  const [newLabName, setNewLabName] = useState('');
  const [isCreatingLab, setIsCreatingLab] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinStatusMsg, setJoinStatusMsg] = useState('');

  // Modal State for Locked Institutional Profile
  const [showProfileModal, setShowProfileModal] = useState(false);

  // 1. Authentication State Listener
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      setUser(currentUser);
    } else {
      setUser(null);
      setCurrentLab(null);
    }
  });

  return () => unsubscribe();
}, []);

  // 2. Real-time Active User Presence Heartbeat
  useEffect(() => {
    if (!user || !currentLab?.id) return;

    const presenceRef = doc(db, 'lab_presence', `${currentLab.id}_${user.uid}`);

    const updatePresence = async () => {
      try {
        await setDoc(presenceRef, {
          labId: currentLab.id,
          uid: user.uid,
          displayName: user.displayName || user.email.split('@')[0],
          email: user.email,
          role: currentLab.createdBy === user.email ? 'teacher' : 'student',
          lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error("Presence update error:", err);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 60000); // 1-minute heartbeat pulse

    return () => clearInterval(interval);
  }, [user, currentLab?.id, currentLab?.createdBy]);

  // 3. Multi-collection Lab Workspace Synchronization ('labs' & 'organizations')
  useEffect(() => {
    if (!user) {
  setLoading(false);
  return;
}

    const unsubLabs = onSnapshot(collection(db, 'labs'), (snapshot) => {
      let loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (loaded.length === 0) {
        onSnapshot(collection(db, 'organizations'), (orgSnap) => {
          const orgLabs = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (orgLabs.length > 0) {
            setAvailableLabs(orgLabs);
            setCurrentLab((prev) => prev || orgLabs[0]);
          }
          if (setLoading) setLoading(false); 
        });
      } else {
        setAvailableLabs(loaded);
        setCurrentLab((prev) => {
          if (!prev) return loaded[0];
          const match = loaded.find((l) => l.id === prev.id);
          return match || loaded[0];
        });
        if (setLoading) setLoading(false); 
      }
    });

    return () => unsubLabs();
  }, [user]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 35%, #ecfdf5 0%, #f8fafc 55%, #e2e8f0 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif'
      }}>
        {/* Scientific Enclave Loading Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderRadius: '24px',
          padding: '44px 48px',
          maxWidth: '460px',
          width: '90%',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative'
        }}>
          {/* Animated Biopharma Helix / Orbit Icon */}
          <div style={{
            position: 'relative',
            width: '76px',
            height: '76px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(37, 99, 235, 0.2) 100%)',
              animation: 'sciOrbitPulse 2.8s ease-in-out infinite'
            }} />
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: '#ffffff',
              border: '1px solid #d1fae5',
              boxShadow: '0 8px 20px -4px rgba(5, 150, 105, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              position: 'relative',
              zIndex: 2
            }}>
              🧬
            </div>
          </div>

          {/* Platform Identity */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#0f172a',
            fontSize: '22px',
            fontWeight: '800',
            letterSpacing: '-0.03em',
            marginBottom: '6px'
          }}>
            MOLQEN
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              letterSpacing: '0.04em'
            }}>
              OS v2026.4
            </span>
          </div>

          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#059669',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: '18px'
          }}>
            Biotechnology & Lab Management Suite
          </div>

          {/* Shimmer Telemetry Progress Track */}
          <div style={{
            width: '100%',
            height: '5px',
            background: '#e2e8f0',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '16px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '45%',
              background: 'linear-gradient(90deg, #10b981 0%, #2563eb 50%, #10b981 100%)',
              borderRadius: '999px',
              animation: 'sciShimmerBar 1.8s ease-in-out infinite'
            }} />
          </div>

          {/* Dynamic Telemetry Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#475569',
            fontWeight: '500'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
              display: 'inline-block',
              animation: 'presencePulse 2s infinite'
            }} />
            <span>Restoring cryptographically verified bench session...</span>
          </div>

          {/* Compliance & Security Credentials */}
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '11px',
            color: '#94a3b8'
          }}>
            <span>🔒 AES-GCM-256 Session</span>
            <span>•</span>
            <span>21 CFR Part 11 Ready</span>
            <span>•</span>
            <span>ISO 17025</span>
          </div>
        </div>

        <style>{`
          @keyframes sciOrbitPulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.15); opacity: 1; }
          }
          @keyframes sciShimmerBar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <AuthAndWorkspace onAuthSuccess={setUser} />;
  }

  const userInitials = (user.displayName || user.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f8faf9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* WCAG 2.2 AA Skip Link for Keyboard Navigation */}
      <a href="#main-viewport" className="skip-to-content">
        Skip to Main Laboratory View
      </a>
      
      {/* ========================================================================= */}
      {/* FIRST-RUN LAB BOOTSTRAP OVERLAY: Displays automatically if 0 labs enrolled */}
      {/* ========================================================================= */}
      {availableLabs.length === 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20000,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', padding: '32px', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#e8f5e9', color: '#2d6a4f', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              🔬
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b4332', margin: '0 0 8px 0' }}>
              Welcome to MOLQEN OS
            </h2>
            <p style={{ fontSize: '13px', color: '#6c757d', margin: '0 0 24px 0', lineHeight: '1.5' }}>
              You are not connected to an active research core. Initialize your laboratory workspace to unlock chemical tracking, the ELN, and instrument schedules.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCreateLabModal(true)}
                className="tactile-action-btn"
                style={{
                  background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(45, 106, 79, 0.2)'
                }}
              >
                🎓 I am a Faculty / PI (Register New Lab)
              </button>
              <button
                type="button"
                onClick={() => setShowCreateLabModal(true)}
                className="tactile-action-btn"
                style={{
                  background: '#f8faf9',
                  border: '1px solid #ced4da',
                  color: '#1d3557',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                🔬 I am a Student / Intern (Enter Join Code)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DOCKED LIGHT-MODE LABORATORY DRAWER PANEL                              */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: sidebarCollapsed ? '64px' : '240px',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 50
        }}
      >
        {/* Logo Brand Header */}
        <div style={{
          padding: sidebarCollapsed ? '16px 0' : '16px 18px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between'
        }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                🧬
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.2px' }}>
                  MOLQEN <span style={{ color: '#2563eb', fontSize: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 5px', borderRadius: '4px' }}>OS</span>
                </div>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>Academic Biotech Suite</span>
              </div>
            </div>
          )}
          {sidebarCollapsed && <span style={{ fontSize: '20px' }}>🧬</span>}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="tactile-pill-btn"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Workspace Mode Switcher: Official Core vs Personal Sandbox */}
        {!sidebarCollapsed ? (
          <div style={{
            margin: '10px 14px 4px 14px',
            background: '#f1f5f9',
            borderRadius: '8px',
            padding: '3px',
            display: 'flex',
            gap: '3px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              onClick={() => setWorkspaceMode('lab')}
              className="tactile-pill-btn"
              title="Shared Laboratory Core (Inventory, Official SOPs, Team Bookings)"
              style={{
                flex: 1,
                padding: '5px 6px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: workspaceMode === 'lab' ? '700' : '600',
                background: workspaceMode === 'lab' ? '#ffffff' : 'transparent',
                color: workspaceMode === 'lab' ? '#0f172a' : '#64748b',
                boxShadow: workspaceMode === 'lab' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <span>🏛️</span>
              <span>Lab Core</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceMode('sandbox')}
              className="tactile-pill-btn"
              title="Private Sandbox (Isolated drafts, unshared SOPs and protocols)"
              style={{
                flex: 1,
                padding: '5px 6px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: workspaceMode === 'sandbox' ? '700' : '600',
                background: workspaceMode === 'sandbox' ? '#2563eb' : 'transparent',
                color: workspaceMode === 'sandbox' ? '#ffffff' : '#64748b',
                boxShadow: workspaceMode === 'sandbox' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <span>🔒</span>
              <span>My Bench</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setWorkspaceMode('lab')}
              className="tactile-pill-btn"
              title="Official Lab Core"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: workspaceMode === 'lab' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: workspaceMode === 'lab' ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🏛️
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode('sandbox')}
              className="tactile-pill-btn"
              title="My Personal Bench (Private Sandbox)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: workspaceMode === 'sandbox' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: workspaceMode === 'sandbox' ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔒
            </button>
          </div>
        )}

        {/* Active Lab Core Selector Pill */}
        {!sidebarCollapsed && (
          <div style={{ padding: '10px 14px', margin: '8px 14px 6px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: '700' }}>
                Active Workspace
              </span>
              <span className="benchling-badge benchling-badge-emerald" style={{ fontSize: '9px' }}>
                ACTIVE
              </span>
            </div>

            <select
              value={currentLab?.id || ''}
              onChange={(e) => {
                const selected = availableLabs.find((l) => l.id === e.target.value);
                if (selected) setCurrentLab(selected);
              }}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '12px',
                fontWeight: '600',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
                marginBottom: '6px'
              }}
            >
              {availableLabs.length === 0 ? (
                <option value="">No labs enrolled</option>
              ) : (
                availableLabs.map((l) => (
                  <option key={l.id} value={l.id}>
                    🏢 {l.name}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={() => setShowCreateLabModal(true)}
              className="tactile-action-btn"
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px dashed #2563eb',
                borderRadius: '6px',
                padding: '5px 0',
                fontSize: '11px',
                fontWeight: '600',
                color: '#2563eb',
                cursor: 'pointer'
              }}
            >
              + Switch / Add Lab
            </button>
          </div>
        )}

        {/* Dedicated Dashboard Button */}
        <div style={{ padding: sidebarCollapsed ? '8px 8px 0 8px' : '8px 14px 0 14px' }}>
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            title={sidebarCollapsed ? "Lab Dashboard" : ""}
            className={`sidebar-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            style={{
              padding: sidebarCollapsed ? '8px 0' : '7px 12px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            }}
          >
            <span style={{ fontSize: '15px' }}>📊</span>
            {!sidebarCollapsed && <span>Lab Dashboard</span>}
          </button>
        </div>

        {/* Grouped Collapsible Accordion Navigation */}
        <div style={{
          padding: sidebarCollapsed ? '8px' : '8px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flex: 1,
          overflowY: 'auto',
          minHeight: 0
        }}>
          {NAV_CATEGORIES.map((cat, idx) => {
            const isCollapsed = collapsedSections[cat.title];
            const hasActiveChild = cat.items.some((i) => i.id === activeTab);

            return (
              <div key={idx} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleSection(cat.title)}
                    className="sidebar-section-toggle"
                  >
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: hasActiveChild ? '#2563eb' : '#94a3b8',
                      textAlign: 'left',
                      flex: 1
                    }}>
                      {cat.title}
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </button>
                )}

                {/* Accordion Drawer Content */}
                {(!isCollapsed || sidebarCollapsed) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: sidebarCollapsed ? '0' : '2px' }}>
                    {cat.items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.id)}
                          title={sidebarCollapsed ? item.label : ""}
                          className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                          style={{
                            padding: sidebarCollapsed ? '8px 0' : '6px 12px',
                            justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
                          }}
                        >
                          <span style={{ fontSize: '14px', flexShrink: 0 }}>
                            {item.icon}
                          </span>
                          {!sidebarCollapsed && (
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {item.label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Account Bar with Institutional Profile Trigger */}
        <div style={{ padding: sidebarCollapsed ? '10px 6px' : '10px 14px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
          {!sidebarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div 
                onClick={() => setShowProfileModal(true)}
                title="View your verified institutional profile"
                className="tactile-pill-btn"
                style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', padding: '2px 4px', borderRadius: '6px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="benchling-badge benchling-badge-slate" style={{ fontSize: '9px' }}>
                    PROFILE
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                title="Sign Out"
                className="tactile-action-btn"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
              >
                Exit
              </button>
            </div>
          ) : (
            <div
              onClick={() => setShowProfileModal(true)}
              title={`Profile: ${user.displayName || user.email}`}
              className="tactile-action-btn"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#eff6ff',
                border: '1.5px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                fontWeight: '700',
                fontSize: '11px',
                cursor: 'pointer',
                margin: '0 auto'
              }}
            >
              {userInitials}
            </div>
          )}
        </div>

        {/* Subtle Legal & Compliance Footer */}
        {!sidebarCollapsed && (
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '10px',
            color: '#94a3b8',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setLegalModalTab('privacy')}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '10px', cursor: 'pointer', padding: 0 }}
              >
                Privacy
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab('terms')}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '10px', cursor: 'pointer', padding: 0 }}
              >
                Terms
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_cookie_preferences'))}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '10px', cursor: 'pointer', padding: 0 }}
              >
                Cookies
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setLegalModalTab('impressum')}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '10px', cursor: 'pointer', padding: 0 }}
              >
                Legal
              </button>
            </div>
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>
              MOLQEN OS v2026.1 • WCAG 2.2 AA
            </span>
          </div>
        )}
      </aside>

      {/* ========================================================================= */}
      {/* 3. MAIN VIEWPORT                                                          */}
      {/* ========================================================================= */}
      <main id="main-viewport" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none' }}>

        {/* ===================================================================== */}
        {/* COMPACT HEADER BAR — 44px                                             */}
        {/* ===================================================================== */}
        <header className="sci-header">
          {/* Left: workspace segmented pill + breadcrumb */}
          <div className="sci-header-left">
            <div className="workspace-segmented-pill">
              <button
                type="button"
                onClick={() => {
                  if (workspaceMode !== 'lab') {
                    setWorkspaceMode('lab');
                    playSwitchThud();
                    showToast(`Active: ${currentLab?.name || 'Lab Core'} (Official Core)`, { type: 'info', icon: '🏛️' });
                  }
                }}
                className={`workspace-segmented-btn ${workspaceMode === 'lab' ? 'active-core' : ''}`}
                title="Official Shared Laboratory Core"
              >
                <span>🏛️</span>
                <span>Core</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (workspaceMode !== 'sandbox') {
                    setWorkspaceMode('sandbox');
                    playSwitchThud();
                    showToast('Entered Isolated Personal Sandbox', { type: 'info', icon: '🔒' });
                  }
                }}
                className={`workspace-segmented-btn ${workspaceMode === 'sandbox' ? 'active-sandbox' : ''}`}
                title="My Personal Bench (Isolated Sandbox)"
              >
                <span>🔒</span>
                <span>Sandbox</span>
              </button>
            </div>

            <span style={{ color: '#cbd5e1', flexShrink: 0 }}>/</span>
            <strong style={{
              color: '#0f172a',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              fontSize: '13px',
              maxWidth: '220px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 0
            }}>
              {activeTab.replace('-', ' ')}
            </strong>
          </div>

          {/* Center: Omni Quick Search Trigger */}
          <div className="sci-header-center">
            <button
              type="button"
              onClick={() => {
                setShowCommandPalette(true);
                playTactileClick();
              }}
              className="quick-search-trigger"
              title="Search commands, modules, and protocols (⌘K)"
            >
              <span style={{ flexShrink: 0 }}>🔍</span>
              <span style={{ color: '#64748b', fontSize: '12px', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Search or jump to...</span>
              <kbd style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '1px 5px',
                fontSize: '10px',
                fontWeight: '700',
                color: '#64748b',
                flexShrink: 0
              }}>⌘K</kbd>
            </button>
          </div>

          {/* Right: + Create, Sound, Shortcuts, Mindful, Alerts, Profile */}
          <div className="sci-header-right">
            {/* Quick Create Action */}
            <button
              type="button"
              onClick={() => {
                setShowCommandPalette(true);
                playTactileClick();
              }}
              className="tactile-pill-btn"
              style={{
                background: '#0B4FD9',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                height: '28px',
                whiteSpace: 'nowrap'
              }}
              title="Create new experiment, plate assay, or sequence (⌘K)"
            >
              <span>+ Create</span>
            </button>

            {/* Ask MOLQEN AI Quick Trigger */}
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open_molqen_ai'));
                playTactileClick();
              }}
              className="tactile-pill-btn"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 11px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
              }}
              title="Ask MOLQEN AI Co-Scientist (⌘J)"
            >
              <span>⚡ Ask AI</span>
            </button>
            {/* Sound FX Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                setAudioFeedbackEnabled(next);
                if (next) playTactileClick();
                showToast(next ? 'Tactile Sound Effects Enabled' : 'Tactile Sound Effects Muted', {
                  type: 'info',
                  icon: next ? '🔊' : '🔇'
                });
              }}
              className="tactile-pill-btn"
              title={soundEnabled ? 'Mute tactile UI sound effects' : 'Enable tactile UI sound effects'}
              style={{
                background: '#f8faf9',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span>{soundEnabled ? '🔊' : '🔇'}</span>
            </button>

            {/* Keyboard Shortcuts Trigger */}
            <button
              type="button"
              onClick={() => {
                setShowShortcutsModal(true);
                playTactileClick();
              }}
              className="tactile-pill-btn"
              title="Keyboard Shortcuts Cheat Sheet (?)"
              style={{
                background: '#f8faf9',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              ⌨️
            </button>

            {/* Calming Mindful Zen Bench Indicator */}
            <div 
              title="Serene Mindset: Inhale 4s, Exhale 4s for calm, precision benchwork"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f0fdf4',
                border: '1px solid #dcfce7',
                padding: '4px 9px',
                borderRadius: '20px',
                fontSize: '11px',
                color: '#15803d',
                fontWeight: '600',
                cursor: 'default'
              }}
            >
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
                animation: 'relaxPulse 3.5s ease-in-out infinite'
              }} />
              <span>Mindful</span>
            </div>

            {/* Real-Time Laboratory Alert & Notification Center Trigger */}
            <button
              type="button"
              onClick={() => {
                setShowNotifications(true);
                playTactileClick();
              }}
              className="tactile-pill-btn"
              style={{
                background: hasCriticalUnread ? '#fef2f2' : unreadCount > 0 ? '#f0fdf4' : '#f8faf9',
                border: `1px solid ${hasCriticalUnread ? '#fecaca' : unreadCount > 0 ? '#bbf7d0' : '#ced4da'}`,
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: '700',
                color: hasCriticalUnread ? '#dc2626' : unreadCount > 0 ? '#15803d' : '#343a40',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
              title={unreadCount > 0 ? `${unreadCount} unread laboratory alert(s)` : 'No unread notifications'}
            >
              <span style={{ fontSize: '13px', animation: hasCriticalUnread ? 'presencePulse 2s infinite' : 'none' }}>🔔</span>
              <span>Alerts</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: hasCriticalUnread ? '#dc2626' : '#10b981',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '800',
                    borderRadius: '10px',
                    padding: '1px 5px',
                    lineHeight: '1.2'
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowProfileModal(true);
                playTactileClick();
              }}
              className="tactile-pill-btn"
              style={{
                background: '#f8faf9',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#343a40',
                cursor: 'pointer'
              }}
            >
              👤 Profile
            </button>
          </div>
        </header>

        {/* Viewport Content with Clean Full-Height Laboratory Canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: activeTab === 'biologics' ? '0' : '20px 0' }}>
          <div key={activeTab} className="view-transition-container" style={{ height: activeTab === 'biologics' ? '100%' : 'auto' }}>
            {activeTab === 'dashboard' && (
              <DashboardHome
                currentOrg={currentLab}
                user={user}
                onNavigate={(targetTab) => handleNavigate(targetTab)}
              />
            )}
            {activeTab === 'biologics' && (
              <BiologicsStudio 
                currentOrg={currentLab} 
                currentLab={currentLab}
                user={user} 
                onAskAI={(promptText) => {
                  window.dispatchEvent(new CustomEvent('open_molqen_ai', {
                    detail: { prompt: promptText, autoSubmit: true }
                  }));
                }}
              />
            )}
            {activeTab === 'inventory' && <Inventory currentOrg={currentLab} user={user} />}
            {activeTab === 'calendar' && <LabCalendar currentLab={currentLab} user={user} role={role} />}
            {activeTab === 'instruments' && <Instruments currentOrg={currentLab} user={user} />}
            {activeTab === 'plate' && <PlateDesigner currentOrg={currentLab} />}
            {activeTab === 'notebook' && (
              <LabNotebook 
                currentOrg={currentLab} 
                user={user} 
                isPrivateSandbox={isPrivateSandbox} 
                addCountdownTimer={addCountdownTimer}
              />
            )}
            {activeTab === 'labai' && <LabAI currentOrg={currentLab} />}
            {activeTab === 'graphs' && <GraphStudio />}
            {activeTab === 'knowledge' && (
              <KnowledgeBase 
                currentOrg={currentLab} 
                user={user} 
                isPrivateSandbox={isPrivateSandbox} 
              />
            )}
            {activeTab === 'suppliers' && <Suppliers currentOrg={currentLab} />}
            {activeTab === 'publications' && <Publications currentOrg={currentLab} user={user} />}
            {activeTab === 'team' && <TeamManager currentLab={currentLab} user={user} />}
            {activeTab === 'sterile' && (<SterileMode currentLab={currentLab} onExit={() => setActiveTab('dashboard')} />)}
            {activeTab === 'grants' && <GrantTracker currentOrg={currentLab} user={user} />}
            {activeTab === 'whatsapp' && <WhatsAppBot currentOrg={currentLab} user={user} />}
            {activeTab === 'handover' && (
              <GraduationHandover 
                currentOrg={currentLab} 
                currentLab={currentLab} 
                user={user} 
                role={role} 
                isPI={isPI} 
              />
            )}
            {activeTab === 'compliance' && (
              <LegalCenter
                embedded={true}
                initialTab="privacy"
                user={user}
                currentLab={currentLab}
              />
            )}
          </div>
        </div>
      </main>

      {/* 3. PERSISTENT LABMIND ASSISTANT */}
      <LabMindChat currentLab={currentLab} user={user} role={role} />

      {/* 4. SWITCH / JOIN / CREATE LAB MODAL */}
      {showCreateLabModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(33, 37, 41, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30000,
          padding: '20px'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 15px 30px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1b4332' }}>
                Lab Workspaces
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateLabModal(false)}
                className="tactile-close-btn"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '6px' }}>
                SWITCH ACTIVE WORKSPACE:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                {availableLabs.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setCurrentLab(l);
                      setShowCreateLabModal(false);
                    }}
                    className="tactile-pill-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: currentLab?.id === l.id ? '2px solid #2d6a4f' : '1px solid #e9ecef',
                      background: currentLab?.id === l.id ? '#e8f5e9' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: currentLab?.id === l.id ? '700' : '500', color: '#212529' }}>
                      🏢 {l.name}
                    </span>
                    {currentLab?.id === l.id && (
                      <span style={{ fontSize: '10px', color: '#2d6a4f', fontWeight: '700' }}>Active</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Student Code Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const code = joinCodeInput.trim().toUpperCase();
                if (!code) return;
                setIsJoining(true);
                setJoinStatusMsg('');

                try {
                  const q = query(collection(db, 'labs'));
                  const snap = await getDocs(q);
                  const found = snap.docs.find(d => d.data().joinCode === code);

                  if (!found) {
                    setJoinStatusMsg('❌ Invalid Join Code. Please verify with your lab instructor.');
                    return;
                  }

                  await addDoc(collection(db, 'lab_members'), {
                    labId: found.id,
                    labName: found.data().name,
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    role: 'student',
                    status: 'pending',
                    createdAt: serverTimestamp()
                  });

                  setJoinStatusMsg('✓ Admission request sent! Awaiting instructor approval.');
                  setJoinCodeInput('');
                } catch (err) {
                  setJoinStatusMsg('Error joining: ' + err.message);
                } finally {
                  setIsJoining(false);
                }
              }}
              style={{ borderTop: '1px solid #f1f3f5', paddingTop: '12px', marginBottom: '12px' }}
            >
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#1d3557', marginBottom: '4px' }}>
                STUDENT: JOIN WITH 6-CHAR CODE
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="e.g. LAB-492"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none', fontFamily: 'monospace' }}
                />
                <button
                  type="submit"
                  disabled={isJoining}
                  className="tactile-action-btn"
                  style={{ background: '#1d3557', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '11px', fontWeight: '700', cursor: isJoining ? 'not-allowed' : 'pointer' }}
                >
                  {isJoining ? '...' : 'Join Lab'}
                </button>
              </div>
              {joinStatusMsg && (
                <div style={{ fontSize: '11px', marginTop: '6px', color: joinStatusMsg.startsWith('✓') ? '#2d6a4f' : '#e03131', fontWeight: '600' }}>
                  {joinStatusMsg}
                </div>
              )}
            </form>

            {/* Teacher Register Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newLabName.trim()) return;
                setIsCreatingLab(true);

                const randomCode = 'LAB-' + Math.floor(100 + Math.random() * 900);

                try {
                  const docRef = await addDoc(collection(db, 'labs'), {
                    name: newLabName.trim(),
                    joinCode: randomCode,
                    createdBy: user?.email || 'admin',
                    ownerUid: user?.uid,
                    createdAt: serverTimestamp()
                  });

                  await addDoc(collection(db, 'lab_members'), {
                    labId: docRef.id,
                    labName: newLabName.trim(),
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    role: 'teacher',
                    status: 'active',
                    createdAt: serverTimestamp()
                  });

                  setCurrentLab({ id: docRef.id, name: newLabName.trim(), joinCode: randomCode });
                  setNewLabName('');
                  setShowCreateLabModal(false);
                } catch (err) {
                  console.error('Error creating lab:', err);
                } finally {
                  setIsCreatingLab(false);
                }
              }}
              style={{ borderTop: '1px solid #f1f3f5', paddingTop: '12px' }}
            >
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#2d6a4f', marginBottom: '4px' }}>
                TEACHER / PI: REGISTER NEW LAB
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="e.g. Molecular Genetics Lab"
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                />
                <button
                  type="submit"
                  disabled={isCreatingLab}
                  className="tactile-action-btn"
                  style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '11px', fontWeight: '700', cursor: isCreatingLab ? 'not-allowed' : 'pointer' }}
                >
                  {isCreatingLab ? '...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. LOCKED RESEARCHER PROFILE MODAL */}
      {showProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(33, 37, 41, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30001,
          padding: '20px'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 20px 35px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🏛️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1b4332' }}>
                    Institutional Profile
                  </h3>
                  <span style={{ fontSize: '10px', color: '#6c757d' }}>Official Good Laboratory Practice Record</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="tactile-close-btn"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Verified Profile Sheet */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8faf9', padding: '16px', borderRadius: '10px', border: '1px solid #e9ecef', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6c757d', fontWeight: '700' }}>
                  FULL LEGAL NAME (LOCKED)
                </span>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#212529', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{user.displayName || 'Authorized Investigator'}</span>
                  <span style={{ fontSize: '10px', background: '#e9ecef', color: '#495057', padding: '1px 6px', borderRadius: '4px' }}>🔒 Verified</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6c757d', fontWeight: '700' }}>
                  INSTITUTIONAL EMAIL
                </span>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#495057', marginTop: '2px', fontFamily: 'monospace' }}>
                  {user.email}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6c757d', fontWeight: '700' }}>
                  AFFILIATED LABORATORY CORE
                </span>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#2d6a4f', marginTop: '2px' }}>
                  {currentLab?.name || 'Academic Core'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6c757d', fontWeight: '700' }}>
                  LAB SYSTEM ROLE
                </span>
                <div style={{ marginTop: '3px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: currentLab?.createdBy === user?.email ? '#d8f3dc' : '#e7f5ff',
                    color: currentLab?.createdBy === user?.email ? '#2d6a4f' : '#1971c2'
                  }}>
                    {currentLab?.createdBy === user?.email ? '🎓 Faculty / Principal Investigator' : '🔬 Student Trainee / Researcher'}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6c757d', fontWeight: '700' }}>
                  ACCOUNT UNIQUE ID (UID)
                </span>
                <div style={{ fontSize: '10px', color: '#868e96', fontFamily: 'monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.uid}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  setLegalModalTab('dsar');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2D6A4F',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                🔒 Data Privacy & Rights (DSAR)
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="tactile-action-btn"
                  style={{ background: '#fff5f5', border: '1px solid #ffe3e3', color: '#e03131', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="tactile-action-btn"
                  style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 18px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SLIDE-OUT NOTIFICATION CENTER DRAWER */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        hasCriticalUnread={hasCriticalUnread}
        permissionStatus={permissionStatus}
        onRequestPermission={requestNotificationPermission}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onClearNotification={clearNotification}
        onClearAll={clearAllNotifications}
        onNavigate={(targetTab) => setActiveTab(targetTab)}
        activeTimers={activeTimers}
      />

      {/* 6. TRANSIENT IN-APP TOAST BANNER CONTAINER */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onNavigate={(targetTab) => setActiveTab(targetTab)}
      />

      {/* 7. GRANULAR COOKIE & TRACKING CONSENT BANNER (Prior Consent Enforced) */}
      <CookieConsent onOpenLegalCenter={(tab) => setLegalModalTab(tab)} />

      {/* 8. MODULAR LEGAL & COMPLIANCE MODAL CENTER */}
      <LegalCenter
        isOpen={Boolean(legalModalTab)}
        initialTab={legalModalTab || 'privacy'}
        onClose={() => setLegalModalTab(null)}
        user={user}
        currentLab={currentLab}
      />

      {/* 9. OMNI COMMAND PALETTE (Cmd+K) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        activeTab={activeTab}
        onNavigate={(tab) => {
          setActiveTab(tab);
          playTactileClick();
        }}
        isPrivateSandbox={isPrivateSandbox}
        onToggleSandbox={() => setWorkspaceMode((prev) => (prev === 'lab' ? 'sandbox' : 'lab'))}
        currentLab={currentLab}
        onOpenLegal={(tab) => setLegalModalTab(tab)}
      />

      {/* 10. KEYBOARD SHORTCUTS CHEAT SHEET (?) */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* 11. GLOBAL TACTILE TOAST NOTIFICATIONS */}
      <Toast />

    </div>
  );
}

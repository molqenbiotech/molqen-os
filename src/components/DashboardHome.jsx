import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import ExperimentDesigner from './ExperimentDesigner';
import { playTactileClick } from '../utils/audioFeedback';
import { showToast } from '../utils/toast';

export default function DashboardHome({ currentOrg, user, onNavigate }) {
  const [stats, setStats] = useState({
    totalReagents: 0,
    lowStock: 0,
    activeBookings: 0,
    totalNotebookEntries: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [urgentAlerts, setUrgentAlerts] = useState([]);

  useEffect(() => {
    if (!currentOrg?.id) return;

    // 1. Reagents count & low-stock check
    const qReagents = query(collection(db, 'reagents'), where('labId', '==', currentOrg.id));
    const unsubReagents = onSnapshot(qReagents, (snap) => {
      const items = snap.docs.map(d => d.data());
      const low = items.filter(r => (r.quantity || 0) <= (r.minThreshold || 0));
      const expiring = items.filter(r => r.expiryDate && new Date(r.expiryDate) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
      
      setStats(prev => ({ ...prev, totalReagents: items.length, lowStock: low.length }));
      
      const alerts = [];
      if (low.length > 0) alerts.push(`${low.length} reagent(s) below threshold.`);
      if (expiring.length > 0) alerts.push(`${expiring.length} chemical(s) expiring soon.`);
      setUrgentAlerts(alerts);
    });

    // 2. Equipment bookings
    const qBookings = query(collection(db, 'equipment_bookings'), where('labId', '==', currentOrg.id));
    const unsubBookings = onSnapshot(qBookings, (snap) => {
      setStats(prev => ({ ...prev, activeBookings: snap.docs.length }));
    });

    // 3. Notebook runs
    const qNotebook = query(collection(db, 'lab_notebook'), where('labId', '==', currentOrg.id));
    const unsubNotebook = onSnapshot(qNotebook, (snap) => {
      setStats(prev => ({ ...prev, totalNotebookEntries: snap.docs.length }));
    });

    // 4. Activity Audit Stream
    const qAudit = query(collection(db, 'audit_trail'), limit(8));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecentActivities(logs);
    });

    // 5. Live Active Personnel (Heartbeat within last 5 minutes)
    const qPresence = query(collection(db, 'lab_presence'), where('labId', '==', currentOrg.id));
    const unsubPresence = onSnapshot(qPresence, (snap) => {
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      const online = snap.docs
        .map(d => d.data())
        .filter(u => u.lastSeen?.toMillis ? u.lastSeen.toMillis() >= fiveMinsAgo : true);
      setActiveUsers(online);
    });

    return () => {
      unsubReagents();
      unsubBookings();
      unsubNotebook();
      unsubAudit();
      unsubPresence();
    };
  }, [currentOrg?.id]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 60%, #40916c 100%)',
        borderRadius: '16px',
        padding: '26px 30px',
        color: '#ffffff',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 10px 20px -5px rgba(45, 106, 79, 0.2)'
      }}>
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', background: 'rgba(255,255,255,0.18)', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
            OPERATIONAL COMMAND CENTER
          </span>
          <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '8px 0 4px 0', letterSpacing: '-0.3px' }}>
            Welcome back, {user?.displayName || 'Lead Researcher'}
          </h1>
          <p style={{ fontSize: '13px', margin: 0, opacity: 0.9 }}>
            Active workspace: <strong style={{ color: '#d8f3dc' }}>{currentOrg?.name || 'Academic Core Lab'}</strong>. Real-time GLP records and presence active.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => {
              onNavigate('inventory');
              playTactileClick();
            }}
            className="tactile-action-btn"
            style={{ background: '#ffffff', color: '#1b4332', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
          >
            🧪 Manage Stock
          </button>
          <button
            onClick={() => {
              onNavigate('notebook');
              playTactileClick();
            }}
            className="tactile-action-btn"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '9px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
          >
            📖 Open ELN
          </button>
        </div>
      </div>

      {/* Urgent Inventory Alert Strip */}
      {urgentAlerts.length > 0 && (
        <div style={{
          background: '#fff5f5',
          border: '1px solid #ffc9c9',
          borderRadius: '12px',
          padding: '12px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c92a2a', fontSize: '12px', fontWeight: '600' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span>{urgentAlerts.join(' • ')}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="tactile-pill-btn"
            style={{
              background: '#e03131',
              color: '#ffffff',
              border: 'none',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Review Chemical Stock
          </button>
        </div>
      )}

      {/* 1. LIVE ACTIVE PERSONNEL MONITOR */}
      <div style={{ background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🟢</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1b4332' }}>
              Currently Active in this Portal ({activeUsers.length || 1})
            </div>
            <span style={{ fontSize: '11px', color: '#6c757d' }}>Live researcher presence across bench terminals</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {activeUsers.length === 0 ? (
            <div
              className="tactile-pill-btn"
              onClick={() => {
                playTactileClick();
                showToast(`Logged in as ${user.displayName || user.email}`, { type: 'info', icon: '👤' });
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8faf9', border: '1px solid #e9ecef', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer' }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d6a4f' }} />
              <strong>{user.displayName || user.email.split('@')[0]}</strong> (You)
            </div>
          ) : (
            activeUsers.map((u, i) => (
              <div
                key={i}
                className="tactile-pill-btn"
                onClick={() => {
                  playTactileClick();
                  showToast(`Researcher: ${u.displayName || u.email}`, { type: 'info', icon: '👤' });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8faf9', border: '1px solid #e9ecef', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer' }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2d6a4f' }} />
                <strong>{u.displayName || u.email.split('@')[0]}</strong>
                <span style={{ fontSize: '9px', color: '#6c757d', background: '#e9ecef', padding: '1px 5px', borderRadius: '4px' }}>
                  {u.role === 'teacher' ? 'Faculty' : 'Student'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div
          className="interactive-stat-card"
          style={kpiCardStyle}
          onClick={() => {
            onNavigate('inventory');
            playTactileClick();
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Chemical Stock</span>
            <span className="stat-icon" style={{ fontSize: '18px' }}>🧪</span>
          </div>
          <div style={kpiValStyle}>{stats.totalReagents}</div>
          <span style={{ fontSize: '11px', color: stats.lowStock > 0 ? '#e03131' : '#2d6a4f', fontWeight: '600' }}>
            {stats.lowStock > 0 ? `⚠️ ${stats.lowStock} Below Threshold` : '✓ All Stocks Adequate'}
          </span>
        </div>

        <div
          className="interactive-stat-card"
          style={kpiCardStyle}
          onClick={() => {
            onNavigate('instruments');
            playTactileClick();
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Active Bookings</span>
            <span className="stat-icon" style={{ fontSize: '18px' }}>⏱️</span>
          </div>
          <div style={kpiValStyle}>{stats.activeBookings}</div>
          <span style={{ fontSize: '11px', color: '#6c757d' }}>Scheduled runs</span>
        </div>

        <div
          className="interactive-stat-card"
          style={kpiCardStyle}
          onClick={() => {
            onNavigate('notebook');
            playTactileClick();
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Documented Experiments</span>
            <span className="stat-icon" style={{ fontSize: '18px' }}>📖</span>
          </div>
          <div style={kpiValStyle}>{stats.totalNotebookEntries}</div>
          <span style={{ fontSize: '11px', color: '#2d6a4f' }}>Verified ELN records</span>
        </div>

        <div
          className="interactive-stat-card"
          style={kpiCardStyle}
          onClick={() => {
            onNavigate('plate');
            playTactileClick();
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>96-Well Microplate</span>
            <span className="stat-icon" style={{ fontSize: '18px' }}>🧫</span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#212529', margin: '14px 0 6px 0' }}>Assay Designer</div>
          <span style={{ fontSize: '11px', color: '#1d3557', fontWeight: '600' }}>Launch qPCR / ELISA Grid →</span>
        </div>
      </div>

      {/* Main Two-Column View: Assay Auto-Deduction Engine + Audit Trail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '22px' }}>
        
        {/* Left Column: Automated Protocol Execution & Depletion */}
        <div>
          <ExperimentDesigner currentOrg={currentOrg} user={user} />
        </div>

        {/* Right Column: Live GLP Audit Trail */}
        <div style={{ background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '14px', padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1b4332' }}>
              Real-Time GLP Audit & Depletion Stream
            </h3>
            <span style={{ fontSize: '10px', color: '#2d6a4f', background: '#e8f5e9', border: '1px solid #d8f3dc', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
              ● LIVE AUDIT
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#adb5bd', fontSize: '12px' }}>
                No actions logged yet. Executing experiments on the left will immediately stream deduction events here.
              </div>
            ) : (
              recentActivities.map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8faf9', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px' }}>
                      {log.action === 'STOCK_DEDUCT' ? '🔻' : '🔺'}
                    </span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#212529' }}>
                        {log.user} used {Math.abs(log.delta || 1)} {log.unit} of {log.reagentName}
                      </div>
                      <span style={{ fontSize: '10px', color: '#6c757d' }}>
                        Protocol: <strong>{log.protocol || 'Manual Run'}</strong> • Remaining: {log.remaining} {log.unit}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', color: '#adb5bd', whiteSpace: 'nowrap' }}>
                    {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

const kpiCardStyle = { background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '12px', padding: '18px', cursor: 'pointer' };
const kpiLabelStyle = { fontSize: '12px', fontWeight: '600', color: '#6c757d' };
const kpiValStyle = { fontSize: '26px', fontWeight: '800', color: '#1b4332', margin: '8px 0 4px 0' };
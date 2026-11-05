import React, { useState, useMemo } from 'react';

// Category color and icon configuration
const TYPE_CONFIG = {
  inventory_alert: { label: 'Inventory & Reagents', icon: '🧪', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  deadline: { label: 'Milestone / Deadline', icon: '🎯', color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  experiment: { label: 'Experiment / Incubation', icon: '🧫', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  equipment_booking: { label: 'Equipment Schedule', icon: '⏱️', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  system: { label: 'System Notice', icon: '⚙️', color: '#475569', bg: '#f8fafc', border: '#cbd5e1' }
};

export default function NotificationCenter({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  hasCriticalUnread = false,
  permissionStatus,
  onRequestPermission,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotification,
  onClearAll,
  onNavigate,
  activeTimers = []
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'EXPERIMENTS' | 'REAGENTS'

  // Filter notifications by selected tab
  const filteredList = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'UNREAD') return !n.read;
      if (activeTab === 'EXPERIMENTS') return n.type === 'experiment' || n.type === 'deadline';
      if (activeTab === 'REAGENTS') return n.type === 'inventory_alert';
      return true;
    });
  }, [notifications, activeTab]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(3px)',
        zIndex: 10001,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '450px',
          maxWidth: '92vw',
          height: '100vh',
          background: '#FFFFFF',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. DRAWER HEADER */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🔔</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Laboratory Notifications
                </h2>
                {unreadCount > 0 && (
                  <span
                    style={{
                      background: hasCriticalUnread ? '#DC2626' : '#2D6A4F',
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '2px 7px',
                      borderRadius: '10px'
                    }}
                  >
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Live dispatch for active bench runs & inventory
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="tactile-close-btn"
            title="Close Drawer"
          >
            ✕
          </button>
        </div>

        {/* 2. BROWSER PUSH NOTIFICATION REQUEST BANNER */}
        {permissionStatus === 'default' && (
          <div
            style={{
              padding: '10px 16px',
              background: '#F0FDF4',
              borderBottom: '1px solid #BBF7D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}
          >
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: '500' }}>
              📢 Enable desktop alerts for incubation countdowns and critical stockouts?
            </div>
            <button
              type="button"
              onClick={onRequestPermission}
              className="tactile-action-btn"
              style={{
                background: '#15803D',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Allow Alerts
            </button>
          </div>
        )}

        {/* 3. ACTIVE INCUBATION TIMERS SECTION (If any running) */}
        {activeTimers.length > 0 && (
          <div
            style={{
              padding: '12px 16px',
              background: '#FAF5FF',
              borderBottom: '1px solid #E9D5FF'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#6B21A8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>⏱️</span>
              <span>ACTIVE BENCH RUN TIMERS ({activeTimers.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeTimers.map((timer) => {
                const mins = Math.floor(timer.remainingSeconds / 60);
                const secs = timer.remainingSeconds % 60;
                const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                const progressPct = ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100;

                return (
                  <div
                    key={timer.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      border: '1px solid #E9D5FF',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                        {timer.title}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#7C3AED', fontFamily: 'monospace' }}>
                        {formattedTime}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progressPct}%`, background: '#7C3AED', transition: 'width 1s linear' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. FILTER TABS & BULK ACTIONS */}
        <div
          style={{
            padding: '10px 16px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'ALL', label: 'All', count: notifications.length },
              { id: 'UNREAD', label: 'Unread', count: unreadCount },
              { id: 'REAGENTS', label: 'Stocks', count: notifications.filter(n => n.type === 'inventory_alert').length },
              { id: 'EXPERIMENTS', label: 'Runs', count: notifications.filter(n => n.type === 'experiment' || n.type === 'deadline').length }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? '#0F172A' : 'transparent',
                  color: activeTab === tab.id ? '#FFFFFF' : '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2D6A4F',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
                title="Mark all notifications as read"
              >
                ✓ Read All
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
                title="Clear all notifications"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* 5. NOTIFICATION LIST STREAM */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px',
            background: '#FAFBFC',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {filteredList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍃</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                All Clear at the Bench
              </div>
              <p style={{ fontSize: '11px', margin: '4px 0 0 0' }}>
                No active warnings, pending deadlines, or unread alerts in this view.
              </p>
            </div>
          ) : (
            filteredList.map((notif) => {
              const typeCfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
              const isCritical = notif.severity === 'critical';
              const isWarning = notif.severity === 'warning';

              return (
                <div
                  key={notif.id}
                  style={{
                    background: notif.read ? '#FFFFFF' : isCritical ? '#FEF2F2' : isWarning ? '#FFFBEB' : '#F0FDF4',
                    border: `1px solid ${notif.read ? '#E2E8F0' : isCritical ? '#FECACA' : isWarning ? '#FDE68A' : '#BBF7D0'}`,
                    borderRadius: '10px',
                    padding: '12px 14px',
                    boxShadow: notif.read ? 'none' : '0 2px 6px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    position: 'relative',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  {/* Top Bar: Icon + Category Badge + Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>{typeCfg.icon}</span>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: typeCfg.bg,
                          color: typeCfg.color,
                          border: `1px solid ${typeCfg.border}`,
                          textTransform: 'uppercase'
                        }}
                      >
                        {typeCfg.label}
                      </span>
                      {!notif.read && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isCritical ? '#DC2626' : '#10B981',
                            display: 'inline-block'
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                        {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onClearNotification(notif.id, notif.isPersonal)}
                        style={{ background: 'transparent', border: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: '12px', padding: '1px' }}
                        title="Dismiss alert"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Title & Message */}
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                    {notif.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.5' }}>
                    {notif.message}
                  </div>

                  {/* Action Link Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    {notif.actionUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!notif.read) onMarkAsRead(notif.id, notif.isPersonal);
                          if (onNavigate) onNavigate(notif.actionUrl);
                          onClose();
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: typeCfg.color,
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: 0
                        }}
                      >
                        <span>Open in {notif.actionUrl.toUpperCase()}</span>
                        <span>→</span>
                      </button>
                    ) : <span />}

                    {!notif.read && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(notif.id, notif.isPersonal)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748B',
                          fontSize: '10px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Transient In-App Toast Container
 * Displays non-intrusive floating alert toasts in bottom-right corner
 */
export function ToastContainer({ toasts = [], onDismiss, onNavigate }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10002,
        maxWidth: '380px'
      }}
    >
      {toasts.map((toast) => {
        const isCritical = toast.severity === 'critical';
        const isWarning = toast.severity === 'warning';

        return (
          <div
            key={toast.id}
            style={{
              background: '#FFFFFF',
              border: `1px solid ${isCritical ? '#FECACA' : isWarning ? '#FDE68A' : '#BBF7D0'}`,
              borderLeft: `4px solid ${isCritical ? '#DC2626' : isWarning ? '#D97706' : '#10B981'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '10px',
              animation: 'slideUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                {toast.title}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', lineHeight: '1.4' }}>
                {toast.message}
              </div>
              {toast.actionUrl && (
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) onNavigate(toast.actionUrl);
                    onDismiss(toast.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2D6A4F',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginTop: '4px',
                    padding: 0
                  }}
                >
                  View details →
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                fontSize: '13px',
                padding: '2px'
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}


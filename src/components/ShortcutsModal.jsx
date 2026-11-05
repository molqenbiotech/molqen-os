import React, { useEffect } from 'react';

export default function ShortcutsModal({ isOpen, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Global Navigation & Command',
      items: [
        { key: '⌘ K / Ctrl+K', desc: 'Open Command Palette & Quick Search' },
        { key: '⌘ B / Ctrl+B', desc: 'Toggle Sidebar Collapse / Expand' },
        { key: 'Esc', desc: 'Dismiss active modal, drawer, or palette' },
        { key: '?', desc: 'Toggle this keyboard shortcuts cheat sheet' }
      ]
    },
    {
      title: 'Bench AI & Workspace Mode',
      items: [
        { key: '⌘ J / Ctrl+J', desc: 'Launch MOLQEN AI Bench Copilot' },
        { key: '⌘ ⇧ S / Ctrl+Shift+S', desc: 'Toggle Personal Sandbox 🔒 / Official Lab Core 🏛️' },
        { key: '⌘ /', desc: 'Open Keyboard Shortcuts Help' }
      ]
    },
    {
      title: 'Direct Module Fast-Keys',
      items: [
        { key: 'Alt + 1', desc: 'Jump to Operational Command Center' },
        { key: 'Alt + 2', desc: 'Jump to Chemical Inventory & Stocks' },
        { key: 'Alt + 3', desc: 'Jump to Lab Calendar & Deadlines' },
        { key: 'Alt + 4', desc: 'Jump to Equipment & Instrument Scheduler' },
        { key: 'Alt + 5', desc: 'Jump to 96-Well Plate Designer' },
        { key: 'Alt + 6', desc: 'Jump to Electronic Lab Notebook (ELN)' }
      ]
    }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⌨️</span>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              MOLQEN OS Keyboard Shortcuts
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tactile-close-btn"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px', maxHeight: '65vh', overflowY: 'auto' }}>
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ marginBottom: gIdx === shortcutGroups.length - 1 ? 0 : '20px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: '#059669',
                  marginBottom: '10px'
                }}
              >
                {group.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#F8FAFC',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px'
                    }}
                  >
                    <span style={{ color: '#334155', fontWeight: '500' }}>{item.desc}</span>
                    <kbd
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#0F172A',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                      }}
                    >
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            textAlign: 'center',
            fontSize: '11px',
            color: '#64748B'
          }}
        >
          Pro-Tip: Press <kbd style={{ background: '#FFF', border: '1px solid #CBD5E1', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>?</kbd> anytime to open this helper.
        </div>
      </div>
    </div>
  );
}


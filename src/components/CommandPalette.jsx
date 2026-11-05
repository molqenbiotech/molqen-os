import React, { useState, useEffect, useRef } from 'react';
import { playTactileClick, playSwitchThud } from '../utils/audioFeedback';
import { showToast } from '../utils/toast';

export default function CommandPalette({
  isOpen,
  onClose,
  activeTab,
  onNavigate,
  isPrivateSandbox,
  onToggleSandbox,
  currentLab,
  onOpenLegal
}) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const allCommands = [
    // --- Bench Operations ---
    { id: 'dashboard', category: 'Bench Operations', label: 'Operational Command Center', icon: '🏛️', action: () => onNavigate('dashboard') },
    { id: 'inventory', category: 'Bench Operations', label: 'Chemical & Reagent Inventory', icon: '🧪', action: () => onNavigate('inventory') },
    { id: 'calendar', category: 'Bench Operations', label: 'Master Lab Calendar & Schedules', icon: '📅', action: () => onNavigate('calendar') },
    { id: 'instruments', category: 'Bench Operations', label: 'Equipment & Instrument Scheduler', icon: '⏱️', action: () => onNavigate('instruments') },
    { id: 'plate', category: 'Bench Operations', label: '96-Well Plate Microplate Designer', icon: '🧫', action: () => onNavigate('plate') },
    { id: 'notebook', category: 'Bench Operations', label: 'Electronic Lab Notebook (ELN)', icon: '📓', action: () => onNavigate('notebook') },
    { id: 'sterile', category: 'Bench Operations', label: 'Voice-Guided Sterile Protocol Reader', icon: '🎙️', action: () => onNavigate('sterile') },

    // --- In-Silico & Analytics ---
    { id: 'biologics', category: 'In-Silico & Analytics', label: 'Biologics & Molecular Sequence Studio', icon: '🧬', action: () => onNavigate('biologics') },
    { id: 'labai', category: 'In-Silico & Analytics', label: 'Molarity & Dilution Suite (C₁V₁ = C₂V₂)', icon: '⚗️', action: () => onNavigate('labai') },
    { id: 'graphs', category: 'In-Silico & Analytics', label: 'Kinetic Curve Fitting & Regression Studio', icon: '📈', action: () => onNavigate('graphs') },

    // --- Fast Bench Actions ---
    {
      id: 'action-copilot',
      category: 'Bench Actions',
      label: 'Launch MOLQEN AI Bench Copilot',
      icon: '⚡',
      badge: '⌘J',
      action: () => {
        window.dispatchEvent(new CustomEvent('open_molqen_ai'));
        showToast('MOLQEN AI Copilot Launched', { type: 'info', icon: '⚡' });
      }
    },
    {
      id: 'action-sandbox-toggle',
      category: 'Bench Actions',
      label: isPrivateSandbox ? 'Switch to Official Shared Lab Core' : 'Switch to My Personal Bench (Sandbox)',
      icon: isPrivateSandbox ? '🏛️' : '🔒',
      badge: '⌘⇧S',
      action: () => {
        onToggleSandbox();
        playSwitchThud();
        showToast(
          isPrivateSandbox ? `Switched to Official Lab: ${currentLab?.name || 'Lab Core'}` : 'Entered Isolated Personal Sandbox',
          { type: 'info', icon: isPrivateSandbox ? '🏛️' : '🔒' }
        );
      }
    },
    {
      id: 'action-new-eln',
      category: 'Bench Actions',
      label: 'Draft New Experiment Entry',
      icon: '📝',
      action: () => {
        onNavigate('notebook');
        showToast('Drafting new experiment in Lab Notebook', { type: 'info', icon: '📝' });
      }
    },

    // --- Administration & Governance ---
    { id: 'team', category: 'Governance & SOPs', label: 'Personnel & Permissions Directory', icon: '👥', action: () => onNavigate('team') },
    { id: 'knowledge', category: 'Governance & SOPs', label: 'Standard Operating Procedures (SOPs)', icon: '📋', action: () => onNavigate('knowledge') },
    { id: 'suppliers', category: 'Governance & SOPs', label: 'Procurement Ledger & Chemical Suppliers', icon: '📦', action: () => onNavigate('suppliers') },
    { id: 'publications', category: 'Governance & SOPs', label: 'Manuscripts, DOIs & Citations', icon: '📄', action: () => onNavigate('publications') },
    { id: 'grants', category: 'Governance & SOPs', label: 'Academic Grant Ledger & Burn Rate', icon: '💳', action: () => onNavigate('grants') },
    { id: 'compliance', category: 'Governance & SOPs', label: 'Legal, Privacy & Compliance Center', icon: '⚖️', action: () => onNavigate('compliance') },
    {
      id: 'action-dsar',
      category: 'Governance & SOPs',
      label: 'Download Personal Machine-Readable Data (DSAR)',
      icon: '📦',
      action: () => {
        if (onOpenLegal) onOpenLegal('dsar');
      }
    }
  ];

  // Filter commands by search term
  const filteredCommands = allCommands.filter((cmd) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q)
    );
  });

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        playTactileClick();
        selected.action();
        onClose();
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeEl = listEl.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 100000,
        animation: 'fadeIn 0.15s ease'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh'
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid #E2E8F0',
            gap: '12px',
            background: '#FFFFFF'
          }}
        >
          <span style={{ fontSize: '18px', color: '#64748B' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, modules, or bench actions... (↑↓ to navigate, ↵ to run)"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              color: '#0F172A',
              fontWeight: '500',
              background: 'transparent',
              padding: 0
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
          <span
            style={{
              fontSize: '10px',
              fontWeight: '700',
              color: '#64748B',
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            maxHeight: '440px'
          }}
        >
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No commands or modules match "<strong>{search}</strong>"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const isCurrent = cmd.id === activeTab;

              return (
                <div
                  key={cmd.id}
                  data-index={idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    playTactileClick();
                    cmd.action();
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#F0FDF4' : 'transparent',
                    borderLeft: isSelected ? '3px solid #10B981' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{cmd.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? '700' : '500',
                          color: isSelected ? '#065F46' : '#1E293B',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {cmd.label}
                      </span>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>{cmd.category}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          background: '#E2E8F0',
                          color: '#475569',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                    {cmd.badge && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          background: isSelected ? '#D1FAE5' : '#F1F5F9',
                          color: isSelected ? '#065F46' : '#64748B',
                          border: '1px solid #CBD5E1',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {cmd.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '800' }}>↵</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div
          style={{
            padding: '9px 16px',
            borderTop: '1px solid #F1F5F9',
            backgroundColor: '#F8FAFC',
            fontSize: '11px',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> Navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> Select</span>
            <span><kbd style={kbdStyle}>ESC</kbd> Close</span>
          </div>
          <span style={{ color: '#059669', fontWeight: '600' }}>MOLQEN OS Quick Engine</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle = {
  background: '#FFFFFF',
  border: '1px solid #CBD5E1',
  borderRadius: '4px',
  padding: '1px 5px',
  fontSize: '10px',
  fontWeight: '700',
  color: '#475569',
  boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
  marginRight: '2px'
};

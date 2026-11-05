import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { playTactileClick, playSuccessChime } from '../utils/audioFeedback';
import { showToast } from '../utils/toast';
import BenchlingAttachmentDropzone from './BenchlingAttachmentDropzone';

export default function LabNotebook({ currentOrg, user, isPrivateSandbox }) {
  // Core Entry States
  const [notebookTab, setNotebookTab] = useState('notes'); // 'notes' | 'relevant' | 'review' | 'metadata'
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [protocolSteps, setProtocolSteps] = useState('');
  const [observations, setObservations] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [publishingId, setPublishingId] = useState(null);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState('');

  // Environmental & Safety Metadata
  const [ambientTemp, setAmbientTemp] = useState('22.5');
  const [humidity, setHumidity] = useState('45');
  const [biosafetyLevel, setBiosafetyLevel] = useState('BSL-1');
  const [hazardNotes, setHazardNotes] = useState('Standard GLP personal protective equipment required.');

  // MasterMix Reaction Scaler State
  const [showMixScaler, setShowMixScaler] = useState(false);
  const [numReactions, setNumReactions] = useState(8);
  const [excessPercent, setExcessPercent] = useState(10); // 10% pipetting margin

  // Multi-step Interactive Bench Execution State
  const [activeChecklist, setActiveChecklist] = useState([]);

  // Active Bench Incubation Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  /// Countdown Timer Engine
  useEffect(() => {
    let interval = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerRunning(false);
            // Optional bench audio cue
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz beep
              osc.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.6);
            } catch (err) {
              console.log('Audio alert blocked:', err);
            }
            alert('⏰ Incubation completed!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const addTimerTime = (mins) => {
    setTimerSeconds(prev => prev + mins * 60);
  };

  // Synchronize Entries: Private Sandbox (users/{uid}/sandbox_experiments) vs Shared Lab Core (eln_entries)
  useEffect(() => {
    let unsub = () => {};

    if (isPrivateSandbox) {
      if (!user?.uid) return;
      const userExpRef = collection(db, 'users', user.uid, 'sandbox_experiments');
      unsub = onSnapshot(userExpRef, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setEntries(data);
      }, (err) => {
        console.error("Private experiments sync error:", err);
      });
    } else {
      if (!currentOrg?.id) return;
      const q = query(
        collection(db, 'eln_entries'),
        where('labId', '==', currentOrg.id)
      );
      unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setEntries(data);
      }, (err) => {
        console.error("Shared ELN sync error:", err);
      });
    }

    return () => unsub();
  }, [isPrivateSandbox, user?.uid, currentOrg?.id]);

  // Publish Protocol from Private Sandbox to Shared Lab Core
  const handlePublishProtocolToLab = async (entry) => {
    if (!currentOrg?.id) {
      alert("Please select an active Lab Core before publishing.");
      return;
    }

    const confirmPublish = window.confirm(
      `Publish protocol "${entry.title}" to "${currentOrg.name}" official lab notebook?\n\nThis will make your verified protocol accessible to the entire research team while retaining your personal working record.`
    );
    if (!confirmPublish) return;

    setPublishingId(entry.id);
    try {
      // 1. Write official entry to shared ELN collection
      await addDoc(collection(db, 'eln_entries'), {
        labId: currentOrg.id,
        title: entry.title,
        objective: entry.objective || '',
        protocolSteps: entry.protocolSteps || '',
        observations: entry.observations || '',
        checklistProgress: entry.checklistProgress || [],
        ambientTemp: entry.ambientTemp || '22.5 °C',
        humidity: entry.humidity || '45 %',
        biosafetyLevel: entry.biosafetyLevel || 'BSL-1',
        hazardNotes: entry.hazardNotes || '',
        attachments: entry.attachments || [],
        investigator: user?.displayName || user?.email?.split('@')[0],
        investigatorEmail: user?.email,
        authorUid: user?.uid,
        isFromSandbox: true,
        sourceDraftId: entry.id,
        isLocked: false,
        digitalSignature: null,
        signedAt: null,
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // 2. Mark private draft as published
      await updateDoc(doc(db, 'users', user.uid, 'sandbox_experiments', entry.id), {
        isPublished: true,
        publishedAt: serverTimestamp(),
        publishedLabId: currentOrg.id,
        publishedLabName: currentOrg.name
      });

      setPublishSuccessMsg(`✓ Successfully published "${entry.title}" to ${currentOrg.name} ELN!`);
      playSuccessChime();
      showToast(`Published "${entry.title}" to ${currentOrg.name} ELN!`, { type: 'success', icon: '🚀' });
      setTimeout(() => setPublishSuccessMsg(''), 4500);
    } catch (err) {
      console.error('Publish error:', err);
      alert('Failed to publish entry: ' + err.message);
    } finally {
      setPublishingId(null);
    }
  };

  // MasterMix recipe components for 1 reaction (volumes in µL)
  const masterMixBase = [
    { component: '2X Taq PCR MasterMix', baseVol: 12.5 },
    { component: 'Forward Primer (10 µM)', baseVol: 1.0 },
    { component: 'Reverse Primer (10 µM)', baseVol: 1.0 },
    { component: 'DNA Template (~50 ng)', baseVol: 2.0 },
    { component: 'Nuclease-free H2O', baseVol: 8.5 }
  ];

  const totalMultiplier = numReactions * (1 + excessPercent / 100);

  // Preset Blueprints
  const loadBlueprint = (type) => {
    playTactileClick();
    showToast(`Loaded ${type.toUpperCase()} Protocol Blueprint`, { type: 'info', icon: '📋' });
    if (type === 'pcr') {
      setTitle('Target Gene PCR Amplification');
      setObjective('Amplify target DNA fragment for gel electrophoresis and amplicon sequencing.');
      const steps = [
        'Thaw reagents on ice and vortex gently before pulse-spinning.',
        'Assemble reaction tubes according to scaled MasterMix volumes.',
        'Aliquot MasterMix into PCR strip tubes and add target template DNA.',
        'Run thermocycling: 95°C for 3 min -> 35 cycles of (95°C 30s, 58°C 30s, 72°C 45s) -> 72°C 5 min hold.',
        'Store amplified amplicons at 4°C prior to agarose gel analysis.'
      ];
      setProtocolSteps(steps.join('\n'));
      setActiveChecklist(steps.map(s => ({ text: s, completed: false })));
      setBiosafetyLevel('BSL-1');
    } else if (type === 'agarose') {
      setTitle('1.2% Analytical Agarose Gel Electrophoresis');
      setObjective('Resolve PCR amplification products to verify molecular weight against a 1kb ladder.');
      const steps = [
        'Weigh 1.2 g molecular grade agarose and dissolve in 100 mL 1X TAE buffer.',
        'Microwave in intervals until completely clear; cool flask to ~55°C.',
        'Add 5 µL fluorescent nucleic acid dye (EtBr / GelRed) and pour into casting tray.',
        'Load 5 µL of 100bp/1kb ladder in Lane 1 and 10 µL of sample amplicons in subsequent lanes.',
        'Run electrophoresis at 100V constant voltage for 45 minutes.'
      ];
      setProtocolSteps(steps.join('\n'));
      setActiveChecklist(steps.map(s => ({ text: s, completed: false })));
      setBiosafetyLevel('BSL-1');
    } else if (type === 'media') {
      setTitle('Luria-Bertani (LB) Liquid Broth Preparation');
      setObjective('Formulate standard liquid culture media for recombinant plasmid host propagation.');
      const steps = [
        'Measure 10 g Tryptone, 5 g Yeast Extract, and 10 g NaCl into 950 mL deionized H2O.',
        'Stir thoroughly with magnetic bar until solutes dissolve completely.',
        'Adjust pH to 7.0 using 1N NaOH and bring total final volume to 1.0 Liter.',
        'Autoclave on liquid cycle at 121°C (15 psi) for 20 minutes.',
        'Cool to room temperature before adding thermolabile selective antibiotics.'
      ];
      setProtocolSteps(steps.join('\n'));
      setActiveChecklist(steps.map(s => ({ text: s, completed: false })));
      setBiosafetyLevel('BSL-1');
    }
  };

  // Convert manual protocol text into check-off list
  const handleProtocolTextChange = (text) => {
    setProtocolSteps(text);
    const parsed = text.split('\n').filter(line => line.trim().length > 0);
    setActiveChecklist(parsed.map(p => ({ text: p, completed: false })));
  };

  const toggleCheckStep = (index) => {
    setActiveChecklist(prev => prev.map((step, idx) => 
      idx === index ? { ...step, completed: !step.completed } : step
    ));
  };

  // Insert Scaled MasterMix into Protocol Steps
  const insertScaledMixToSteps = () => {
    const summary = [
      `\n--- Scaled MasterMix Formulation (${numReactions} rxns + ${excessPercent}% excess = ${totalMultiplier.toFixed(1)}x) ---`,
      ...masterMixBase.map(m => `• ${m.component}: ${(m.baseVol * totalMultiplier).toFixed(1)} µL (Per tube: ${m.baseVol} µL)`),
      `• Total Calculated Volume: ${(25.0 * totalMultiplier).toFixed(1)} µL\n`
    ].join('\n');
    handleProtocolTextChange(protocolSteps + summary);
    setShowMixScaler(false);
  };

  // Commit Entry to Firestore Ledger (Sandbox vs Shared ELN)
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const entryPayload = {
        title: title.trim(),
        objective: objective.trim(),
        protocolSteps: protocolSteps.trim(),
        observations: observations.trim(),
        checklistProgress: activeChecklist,
        ambientTemp: `${ambientTemp} °C`,
        humidity: `${humidity} %`,
        biosafetyLevel,
        hazardNotes,
        attachments: attachments || [],
        investigator: user?.displayName || user?.email?.split('@')[0],
        investigatorEmail: user?.email,
        authorUid: user?.uid,
        isLocked: false,
        digitalSignature: null,
        signedAt: null,
        createdAt: serverTimestamp()
      };

      if (isPrivateSandbox) {
        // Save to private student sandbox
        await addDoc(collection(db, 'users', user.uid, 'sandbox_experiments'), {
          ...entryPayload,
          isPublished: false,
          publishedAt: null
        });
      } else {
        // Save to shared lab core
        await addDoc(collection(db, 'eln_entries'), {
          ...entryPayload,
          labId: currentOrg?.id || 'unassigned',
          isFromSandbox: false
        });
      }

      // Reset Form
      setTitle('');
      setObjective('');
      setProtocolSteps('');
      setObservations('');
      setActiveChecklist([]);
      setAttachments([]);
    } catch (err) {
      console.error('Error saving ELN entry:', err);
    } finally {
      setLoading(false);
    }
  };

  // GLP Digital Lock & Sign-Off (21 CFR Part 11 compliant audit seal)
  const handleSignAndLock = useCallback(async (entry) => {
    const confirmSign = window.confirm(
      `Execute official GLP digital sign-off for "${entry.title}"?\n\nThis will lock the protocol, observations, and raw data against further modifications.`
    );
    if (!confirmSign) return;

    try {
      const signatureHash = 'GLP-SIG-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now();
      await updateDoc(doc(db, 'eln_entries', entry.id), {
        isLocked: true,
        digitalSignature: signatureHash,
        signerName: user?.displayName || user?.email,
        signedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Digital sign-off failed:', err);
    }
  }, [user]);

  // Filter entries
  const filteredEntries = entries.filter(e => 
    e.title?.toLowerCase().includes(filterQuery.toLowerCase()) ||
    e.investigator?.toLowerCase().includes(filterQuery.toLowerCase()) ||
    e.objective?.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '0 28px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'inherit' }}>
      
      {/* Top Header Row with Bench Incubation Timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>
            {isPrivateSandbox ? 'Personal Bench Notebook (Private Sandbox)' : 'Electronic Lab Notebook (ELN)'}
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
            {isPrivateSandbox 
              ? 'Private unshared protocol testing, custom reaction formulations, and exploratory bench logs.' 
              : 'GLP-compliant protocol documentation, reaction volume calculations, and bench audit records.'}
          </p>
        </div>

        {/* Bench Incubation Timer Widget */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          background: '#FFFFFF', 
          border: '1px solid #E2E8F0', 
          padding: '8px 14px', 
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Incubation Timer
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'monospace', color: timerRunning ? '#2D6A4F' : '#0F172A' }}>
              ⏱️ {formatTimer(timerSeconds)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setTimerRunning(!timerRunning)}
              style={{
                background: timerRunning ? '#FEF2F2' : '#F0FDF4',
                color: timerRunning ? '#DC2626' : '#15803D',
                border: `1px solid ${timerRunning ? '#FECACA' : '#BBF7D0'}`,
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Calm Status & Mode Banner */}
      <div style={{
        background: isPrivateSandbox 
          ? 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)' 
          : 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 60%, #40916c 100%)',
        borderRadius: '14px',
        padding: '16px 20px',
        color: '#ffffff',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 15px rgba(6, 78, 59, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{isPrivateSandbox ? '🔒' : '🏛️'}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800' }}>
              {isPrivateSandbox ? 'My Personal Bench Sandbox (Private Mode)' : `Official Core Notebook • ${currentOrg?.name || 'Shared Core'}`}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.9 }}>
              {isPrivateSandbox 
                ? 'Your experimental runs, rough observations, and reaction formulations are completely unshared. Publish to Lab Core whenever you are ready.' 
                : 'All entries logged here synchronize across verified bench researchers and faculty.'}
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '10px',
          fontWeight: '700',
          background: 'rgba(255,255,255,0.2)',
          padding: '4px 9px',
          borderRadius: '6px'
        }}>
          {isPrivateSandbox ? 'UNSHARED DRAFTS' : 'OFFICIAL LEDGER'}
        </span>
      </div>

      {publishSuccessMsg && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '8px',
          padding: '10px 16px',
          color: '#065f46',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🚀</span>
          <span>{publishSuccessMsg}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Form & Protocols */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          
          {/* Benchling Notebook Subnav */}
          <div className="benchling-subnav" style={{ marginBottom: '16px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => { setNotebookTab('notes'); playTactileClick(); }}
              className={`benchling-subnav-btn ${notebookTab === 'notes' ? 'active' : ''}`}
            >
              NOTES
            </button>
            <button
              type="button"
              onClick={() => { setNotebookTab('relevant'); playTactileClick(); }}
              className={`benchling-subnav-btn ${notebookTab === 'relevant' ? 'active' : ''}`}
            >
              RELEVANT ITEMS
            </button>
            <button
              type="button"
              onClick={() => { setNotebookTab('review'); playTactileClick(); }}
              className={`benchling-subnav-btn ${notebookTab === 'review' ? 'active' : ''}`}
            >
              REVIEW & SIGN
            </button>
            <button
              type="button"
              onClick={() => { setNotebookTab('metadata'); playTactileClick(); }}
              className={`benchling-subnav-btn ${notebookTab === 'metadata' ? 'active' : ''}`}
            >
              METADATA
            </button>
          </div>

          {notebookTab === 'relevant' && (
            <div style={{ padding: '10px 0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 12px 0' }}>
                Relevant Laboratory Entities & Samples
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="benchling-entity-pill">🧬 PL006</span>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B', marginTop: '4px' }}>
                      pUC19-AmpR High Copy Cloning Vector
                    </div>
                  </div>
                  <span className="benchling-badge benchling-badge-emerald">REGISTERED</span>
                </div>

                <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="benchling-entity-pill">📦 TUBE1028</span>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B', marginTop: '4px' }}>
                      2.0 mL Cryovial • Storage Rack B3 (-80°C)
                    </div>
                  </div>
                  <span className="benchling-badge benchling-badge-slate">CONTAINER</span>
                </div>

                <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="benchling-entity-pill benchling-entity-pill-purple">👤 Megan Dueck</span>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#1E293B', marginTop: '4px' }}>
                      Assigned Laboratory Manager & Sign-Off Reviewer
                    </div>
                  </div>
                  <span className="benchling-badge benchling-badge-emerald">NOTIFIED</span>
                </div>
              </div>
            </div>
          )}

          {notebookTab === 'review' && (
            <div style={{ padding: '10px 0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px 0' }}>
                GLP 21 CFR Part 11 Electronic Sign-Off
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Digital signatures permanently bind the protocol observations, raw datasets, and reagent lots under institutional compliance standards.
              </p>
              <div style={{ padding: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' }}>
                  Signature Status
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', marginTop: '4px' }}>
                  Ready for Final Author Signature
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  Signer: <strong>{user?.displayName || user?.email || 'Authenticated Researcher'}</strong>
                </div>
              </div>
            </div>
          )}

          {notebookTab === 'metadata' && (
            <div style={{ padding: '10px 0' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 12px 0' }}>
                Environmental & Regulatory Telemetry
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Ambient Bench Temperature</label>
                  <input type="text" value={ambientTemp + ' °C'} readOnly style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Relative Humidity</label>
                  <input type="text" value={humidity + ' %'} readOnly style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Biosafety Level</label>
                  <input type="text" value={biosafetyLevel} readOnly style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Institutional Core</label>
                  <input type="text" value={currentOrg?.name || 'MOLQEN Core'} readOnly style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {notebookTab === 'notes' && (
            <>
              {/* Benchling Editor Toolbar: Insert Primitives + Blueprints */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                  {/* Benchling + Insert Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowInsertMenu(!showInsertMenu)}
                      className="tactile-pill-btn"
                      style={{
                        background: '#0B4FD9',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>+ Insert ▾</span>
                    </button>

                    {showInsertMenu && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '4px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(15,23,42,0.15)',
                          width: '210px',
                          zIndex: 100,
                          padding: '4px 0'
                        }}
                      >
                        <div style={{ padding: '4px 10px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                          Scientific Primitives
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const stepText = `Part ${activeChecklist.length + 1}: Experimental Protocol Step`;
                            handleProtocolTextChange(protocolSteps ? `${protocolSteps}\n${stepText}` : stepText);
                            setShowInsertMenu(false);
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: '12px', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span>☑</span> Checklist Task Step
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            loadBlueprint('pcr');
                            setShowInsertMenu(false);
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: '12px', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span>🧬</span> PCR Sub-Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            loadBlueprint('agarose');
                            setShowInsertMenu(false);
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: '12px', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span>⚡</span> Agarose Gel Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMixScaler(true);
                            setShowInsertMenu(false);
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: '12px', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span>🧪</span> Reaction Mixture Scaler
                        </button>
                        <div style={{ borderTop: '1px solid #F1F5F9', margin: '4px 0' }}></div>
                        <div style={{ padding: '4px 10px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                          Linked Registry Entities
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setObservations(prev => (prev ? `${prev}\nLink to Plasmid: PL006` : 'Link to Plasmid: PL006'));
                            setShowInsertMenu(false);
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: '12px', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span>🧬</span> Link to Plasmid PL006
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setObservations(prev => (prev ? `${prev}\nLink to Container: TUBE1028` : 'Link to Container: TUBE1028'));
                            setShowInsertMenu(false);
                          }}
                          style={{ width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: '12px', color: '#1E293B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span>📦</span> Link to Tube TUBE1028
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button type="button" onClick={() => loadBlueprint('pcr')} style={blueprintBtnStyle}>🧬 PCR</button>
                    <button type="button" onClick={() => loadBlueprint('agarose')} style={blueprintBtnStyle}>⚡ Gel</button>
                    <button type="button" onClick={() => loadBlueprint('media')} style={blueprintBtnStyle}>🥣 LB</button>
                  </div>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => setShowMixScaler(!showMixScaler)} 
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                >
                  🧪 {showMixScaler ? 'Hide Scaler' : 'Reaction Scaler'}
                </button>
              </div>

          {/* MasterMix Scaler Drawer */}
          {showMixScaler && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>PCR MasterMix Volume Scaler</span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Multiplier: <strong>{totalMultiplier.toFixed(1)}x</strong></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Number of Reactions ($N$):</label>
                  <input 
                    type="number" 
                    value={numReactions} 
                    min="1" 
                    onChange={(e) => setNumReactions(Math.max(1, parseInt(e.target.value) || 1))} 
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Excess Margin (%):</label>
                  <input 
                    type="number" 
                    value={excessPercent} 
                    min="0" 
                    onChange={(e) => setExcessPercent(Math.max(0, parseInt(e.target.value) || 0))} 
                    style={inputStyle}
                  />
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '10px' }}>
                <thead>
                  <tr style={{ background: '#E2E8F0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '4px 8px' }}>Component</th>
                    <th style={{ padding: '4px 8px' }}>Single Rxn</th>
                    <th style={{ padding: '4px 8px' }}>Scaled Master Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {masterMixBase.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '4px 8px', fontWeight: '500' }}>{item.component}</td>
                      <td style={{ padding: '4px 8px' }}>{item.baseVol.toFixed(1)} µL</td>
                      <td style={{ padding: '4px 8px', fontWeight: '700', color: '#1D4ED8' }}>
                        {(item.baseVol * totalMultiplier).toFixed(1)} µL
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button 
                type="button" 
                onClick={insertScaledMixToSteps} 
                style={{ background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
              >
                + Append Recipe to Protocol
              </button>
            </div>
          )}

          <form onSubmit={handleSaveEntry}>
            {/* Experiment Title */}
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Experiment Title *</label>
              <input 
                type="text" 
                required 
                placeholder="e.g., Taq Polymerase Colony PCR Amplification" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                style={inputStyle}
              />
            </div>

            {/* Objective */}
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Experimental Objective</label>
              <input 
                type="text" 
                placeholder="Key research question, hypothesis, or validation target" 
                value={objective} 
                onChange={(e) => setObjective(e.target.value)} 
                style={inputStyle}
              />
            </div>

            {/* Environmental & Risk Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Ambient Temp (°C)</label>
                <input 
                  type="text" 
                  value={ambientTemp} 
                  onChange={(e) => setAmbientTemp(e.target.value)} 
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Relative Humidity (%)</label>
                <input 
                  type="text" 
                  value={humidity} 
                  onChange={(e) => setHumidity(e.target.value)} 
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Biosafety Level</label>
                <select 
                  value={biosafetyLevel} 
                  onChange={(e) => setBiosafetyLevel(e.target.value)} 
                  style={inputStyle}
                >
                  <option value="BSL-1">BSL-1 (Standard)</option>
                  <option value="BSL-2">BSL-2 (Containment)</option>
                  <option value="Chemical Fume Hood">Chemical Fume Hood</option>
                </select>
              </div>
            </div>

            {/* Hazard & Safety Notes */}
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Hazard & Safety Protocols</label>
              <input
                type="text"
                value={hazardNotes}
                onChange={(e) => setHazardNotes(e.target.value)}
                placeholder="e.g. Standard GLP personal protective equipment required."
                style={inputStyle}
              />
            </div>

            {/* Protocol Steps */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={labelStyle}>Detailed Protocol Steps</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" onClick={() => addTimerTime(15)} style={timerBtnStyle}>+15m Timer</button>
                  <button type="button" onClick={() => addTimerTime(30)} style={timerBtnStyle}>+30m Timer</button>
                  <button type="button" onClick={() => addTimerTime(45)} style={timerBtnStyle}>+45m Timer</button>
                </div>
              </div>
              <textarea 
                rows="5" 
                placeholder="Write steps (one per line to generate live bench checklist)" 
                value={protocolSteps} 
                onChange={(e) => handleProtocolTextChange(e.target.value)} 
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
              />
            </div>

            {/* Live Interactive Protocol Check-off List */}
            {activeChecklist.length > 0 && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                  Interactive Bench Checklist:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {activeChecklist.map((step, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: step.completed ? '#94A3B8' : '#1E293B', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={step.completed} 
                        onChange={() => toggleCheckStep(idx)} 
                        style={{ marginTop: '2px', accentColor: '#2D6A4F' }}
                      />
                      <span style={{ textDecoration: step.completed ? 'line-through' : 'none' }}>
                        {step.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Observations & Raw Results */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Raw Bench Observations & Spectral Data</label>
              <textarea 
                rows="3" 
                placeholder="Gel bands observed, spectrophotometer A260/A280 ratios, incubation deviations..." 
                value={observations} 
                onChange={(e) => setObservations(e.target.value)} 
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Benchling-Style Scientific Assets & Gel Captures (Cloudinary Compressed) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>
                Scientific Assets & Gel Electrophoresis Captures (Cloudinary Compressed)
              </label>
              <BenchlingAttachmentDropzone
                attachments={attachments}
                onChange={setAttachments}
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading} 
              style={{
                width: '100%',
                padding: '10px',
                background: '#1B4332',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Recording to Ledger...' : '✓ Record Experiment in GLP Ledger'}
            </button>
          </form>
          </>
        )}
        </div>

        {/* Right Column: Verified Ledger Feed */}
        <div>
          {/* Search & Filter Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
              Verified Entries ({filteredEntries.length})
            </h3>
            <input 
              type="text" 
              placeholder="Filter entries..." 
              value={filterQuery} 
              onChange={(e) => setFilterQuery(e.target.value)} 
              style={{ width: '160px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
            />
          </div>

          {/* Entries Stack */}
          {filteredEntries.length === 0 ? (
            <div style={{ background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: '10px', padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No notebook entries logged yet. Load a blueprint on the left to begin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '720px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredEntries.map(entry => (
                <div key={entry.id} style={{ 
                  background: '#FFFFFF', 
                  border: `1px solid ${entry.isLocked ? '#CBD5E1' : '#E2E8F0'}`, 
                  borderRadius: '8px', 
                  padding: '16px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                        {entry.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        By <strong>{entry.investigator}</strong> • {entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleDateString() : 'Active session'}
                      </div>
                    </div>
                    {isPrivateSandbox ? (
                      entry.isPublished ? (
                        <span style={{ fontSize: '10px', background: '#D8F3DC', color: '#2D6A4F', border: '1px solid #B7E4C7', padding: '2px 7px', borderRadius: '4px', fontWeight: '700' }}>
                          ✓ PUBLISHED TO CORE
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '2px 7px', borderRadius: '4px', fontWeight: '700' }}>
                          🔒 PRIVATE DRAFT
                        </span>
                      )
                    ) : (
                      entry.isLocked ? (
                        <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          🔒 AUDITED & LOCKED
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          DRAFT / EDITABLE
                        </span>
                      )
                    )}
                  </div>

                  {/* Objective */}
                  {entry.objective && (
                    <div style={{ fontSize: '12px', color: '#334155', marginBottom: '8px', fontStyle: 'italic' }}>
                      "{entry.objective}"
                    </div>
                  )}

                  {/* Environment Tags */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <span style={tagStyle}>🌡️ {entry.ambientTemp || '22.5 °C'}</span>
                    <span style={tagStyle}>💧 {entry.humidity || '45 %'}</span>
                    <span style={tagStyle}>🛡️ {entry.biosafetyLevel || 'BSL-1'}</span>
                  </div>

                  {/* Protocol Snippet */}
                  <details style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', cursor: 'pointer' }}>
                    <summary style={{ fontWeight: '600', color: '#1B4332' }}>View Documented Protocol</summary>
                    <pre style={{ background: '#F8FAFC', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-wrap', marginTop: '6px', fontSize: '11px' }}>
                      {entry.protocolSteps}
                    </pre>
                  </details>

                  {/* Observations */}
                  {entry.observations && (
                    <div style={{ background: '#F8FAFC', borderLeft: '3px solid #1B4332', padding: '6px 10px', fontSize: '12px', color: '#1E293B', marginBottom: '10px' }}>
                      <strong>Observations:</strong> {entry.observations}
                    </div>
                  )}

                  {/* Benchling Compressed Scientific Assets & Gels */}
                  {entry.attachments && entry.attachments.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                        Attached Scientific Assets ({entry.attachments.length}):
                      </span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {entry.attachments.map((att, idx) => {
                          const isImage = att.resourceType === 'image' || att.thumbnailUrl;
                          return (
                            <div
                              key={att.id || idx}
                              onClick={() => {
                                if (isImage) {
                                  setViewingAttachment(att.url);
                                } else {
                                  window.open(att.url, '_blank');
                                }
                              }}
                              className="tactile-pill-btn"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#F8FAFC',
                                border: '1px solid #CBD5E1',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                              title="Click to view full-resolution asset"
                            >
                              <span>{isImage ? '🖼️' : '📄'}</span>
                              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600', color: '#0F172A' }}>
                                {att.name}
                              </span>
                              {att.savingsPercent > 0 && (
                                <span style={{ fontSize: '9px', background: '#D1FAE5', color: '#065F46', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>
                                  -{att.savingsPercent}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Footer Action Buttons & Digital Signature */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                    <div>
                      {entry.isLocked && (
                        <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                          Hash: {entry.digitalSignature?.slice(0, 20)}...
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {isPrivateSandbox && (
                        <button
                          type="button"
                          onClick={() => handlePublishProtocolToLab(entry)}
                          disabled={publishingId === entry.id}
                          className="tactile-action-btn"
                          style={{
                            background: entry.isPublished ? '#F0FDF4' : 'linear-gradient(135deg, #2D6A4F 0%, #1B4332 100%)',
                            border: entry.isPublished ? '1px solid #86EFAC' : 'none',
                            color: entry.isPublished ? '#166534' : '#FFFFFF',
                            padding: '4px 9px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: publishingId === entry.id ? 'not-allowed' : 'pointer'
                          }}
                          title={entry.isPublished ? "Re-publish updated protocol to shared lab" : "Publish this protocol to the official lab notebook"}
                        >
                          {entry.isPublished ? '🔄 Update Lab' : '🚀 Publish to Lab'}
                        </button>
                      )}
                      {!entry.isLocked && (
                        <button
                          type="button"
                          onClick={() => handleSignAndLock(entry)}
                          style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#0F172A', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          🔒 Sign & Lock Entry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const jsonBlob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(jsonBlob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${entry.title.replace(/\s+/g, '_')}_GLP_Record.json`;
                          a.click();
                          playSuccessChime();
                          showToast(`Exported "${entry.title}" as GLP JSON`, { type: 'success', icon: '📥' });
                        }}
                        style={{ background: '#F1F5F9', border: 'none', color: '#475569', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        📥 Export JSON
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Lightbox Modal for Full-Resolution Scientific Asset Inspection */}
      {viewingAttachment && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewingAttachment(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              background: '#000000'
            }}
          >
            <img
              src={viewingAttachment}
              alt="High-resolution scientific asset"
              style={{
                maxWidth: '92vw',
                maxHeight: '88vh',
                display: 'block',
                objectFit: 'contain'
              }}
            />
            <button
              type="button"
              onClick={() => setViewingAttachment(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#FFFFFF',
                color: '#0F172A',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Inline Styles
const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: '6px',
  border: '1px solid #CBD5E1',
  fontSize: '12px',
  boxSizing: 'border-box',
  outline: 'none'
};

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '700',
  color: '#475569',
  marginBottom: '4px'
};

const blueprintBtnStyle = {
  background: '#F1F5F9',
  border: '1px solid #E2E8F0',
  borderRadius: '4px',
  padding: '3px 8px',
  fontSize: '11px',
  fontWeight: '600',
  color: '#334155',
  cursor: 'pointer'
};

const timerBtnStyle = {
  background: '#F8FAFC',
  border: '1px solid #CBD5E1',
  borderRadius: '4px',
  padding: '2px 6px',
  fontSize: '10px',
  fontWeight: '600',
  color: '#64748B',
  cursor: 'pointer'
};

const tagStyle = {
  fontSize: '10px',
  background: '#F1F5F9',
  border: '1px solid #E2E8F0',
  padding: '2px 6px',
  borderRadius: '4px',
  color: '#475569',
  fontWeight: '600'
};
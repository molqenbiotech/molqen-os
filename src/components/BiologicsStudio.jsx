import React, { useState, useEffect, useMemo, useRef } from 'react';
import ScientificEntityInspector from './ScientificEntityInspector';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { playTactileClick } from '../utils/audioFeedback';
import { showToast } from '../utils/toast';

export default function BiologicsStudio({ currentOrg, currentLab, user, onAskAI }) {
  const activeLab = currentOrg || currentLab;
  
  // Workspace State
  const [activeTab, setActiveTab] = useState('sequence'); // 'sequence' | 'structure3d' | 'telemetry'
  const [activeDomain, setActiveDomain] = useState(null);
  const [hoveredResidue, setHoveredResidue] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showRuler, setShowRuler] = useState(true);

  // Firestore Saved Constructs State
  const [savedConstructs, setSavedConstructs] = useState([]);
  const [activeConstruct, setActiveConstruct] = useState(null);

  // Benchling-style Right Metadata Inspector State
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [inspectorSubtab, setInspectorSubtab] = useState('metadata');

  // Format active construct into structured scientific entity schema
  const entityInspectorData = useMemo(() => {
    if (!activeConstruct) return null;
    return {
      id: activeConstruct.id,
      name: activeConstruct.name || 'Construct',
      registryId: activeConstruct.registryId || 'ab275 Biologics GA',
      registryName: 'Biologics GA Registry',
      authors: activeConstruct.authors
        ? (Array.isArray(activeConstruct.authors) ? activeConstruct.authors : [activeConstruct.authors])
        : [user?.displayName || 'Brittney Robinett', 'Dr. Piyush Kumar'],
      projectFolder: 'HER2 Campaign Round 1',
      createdAt: '5/4/2026 04:32 PM',
      studiesNote: 'This custom entity has not been added to any studies.',
      aliases: [],
      schema: activeConstruct.type?.includes('DNA') ? 'Plasmid / DNA' : 'IgG',
      attributes: [
        { key: 'Format', value: activeConstruct.type?.includes('DNA') ? 'Double-Stranded Circular' : 'IgG', type: 'text' },
        { key: 'Heavy', value: 'aachain348', type: 'chip' },
        { key: 'Light', value: 'LC-HER2-kappa', type: 'chip' },
        { key: 'VH', value: 'aadomain338', type: 'chip' },
        { key: 'CH1(Heavy)', value: 'IgG1-CH1-R1', type: 'chip' },
        { key: 'H(Heavy)', value: 'IgG1-H-R1', type: 'chip' },
        { key: 'CH2(Heavy)', value: 'IgG1-CH2-R1', type: 'chip' }
      ]
    };
  }, [activeConstruct, user?.displayName]);

  // Builder Modal / Drawer State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFetchingModel, setIsFetchingModel] = useState(false);
  const [internetSearchQuery, setInternetSearchQuery] = useState('');

  // Builder Form State
  const [builderForm, setBuilderForm] = useState({
    id: null,
    name: '',
    registryId: '',
    type: 'Protein / Polypeptide', // 'Protein / Polypeptide' | 'DNA Sequence / Plasmid' | 'RNA / mRNA'
    organism: 'Homo sapiens',
    pdbId: '',
    sequence: '',
    description: '',
    domains: []
  });

  // Domain Entry State in Builder
  const [newDomain, setNewDomain] = useState({
    label: '',
    start: 1,
    end: 30,
    color: '#D1FAE5',
    category: 'Binding Domain'
  });

  const hasInitializedRef = useRef(false);

  // Sync Saved Constructs from Firestore
  useEffect(() => {
    if (!activeLab?.id) return;
    const q = query(collection(db, 'labs', activeLab.id, 'biological_entities'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSavedConstructs(list);
      // Auto-select first construct on initial load if none selected
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        if (list.length > 0) {
          setActiveConstruct(list[0]);
        }
      }
    }, (err) => {
      console.warn("Could not sync biological constructs from Firestore:", err);
    });
    return () => unsub();
  }, [activeLab?.id]);

  // Load Construct into Active Workspace
  const handleSelectConstruct = (construct) => {
    setActiveConstruct(construct);
    setActiveDomain(null);
    playTactileClick();
  };

  // Open Builder for New Custom Construct
  const handleOpenNewBuilder = () => {
    setBuilderForm({
      id: null,
      name: '',
      registryId: `MOL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      type: 'Protein / Polypeptide',
      organism: 'Homo sapiens',
      pdbId: '',
      sequence: '',
      description: '',
      domains: []
    });
    setIsBuilderOpen(true);
    playTactileClick();
  };

  // Open Builder to Edit Active Construct
  const handleEditActiveConstruct = () => {
    if (!activeConstruct) return;
    setBuilderForm({
      id: activeConstruct.id || null,
      name: activeConstruct.name || '',
      registryId: activeConstruct.registryId || '',
      type: activeConstruct.type || 'Protein / Polypeptide',
      organism: activeConstruct.organism || 'Homo sapiens',
      pdbId: activeConstruct.pdbId || '',
      sequence: activeConstruct.sequence || '',
      description: activeConstruct.description || '',
      domains: activeConstruct.domains || []
    });
    setIsBuilderOpen(true);
    playTactileClick();
  };

  // Add Domain in Builder
  const handleAddDomainToForm = () => {
    if (!newDomain.label.trim()) {
      showToast('Please provide a domain label (e.g. CDR-H1, Promoter, GFP Tag)', { type: 'error' });
      return;
    }
    const cleanStart = parseInt(newDomain.start, 10) || 1;
    const cleanEnd = parseInt(newDomain.end, 10) || cleanStart;
    if (cleanEnd < cleanStart) {
      showToast('Domain End coordinate must be ≥ Start coordinate', { type: 'error' });
      return;
    }

    const domainItem = {
      id: `dom-${Date.now()}`,
      label: newDomain.label.trim(),
      start: cleanStart,
      end: cleanEnd,
      color: newDomain.color,
      textColor: '#0F172A',
      category: newDomain.category
    };

    setBuilderForm(prev => ({
      ...prev,
      domains: [...prev.domains, domainItem]
    }));

    setNewDomain({
      label: '',
      start: cleanEnd + 1,
      end: cleanEnd + 30,
      color: '#DBEAFE',
      category: 'Binding Domain'
    });
    showToast(`Domain "${domainItem.label}" added to sequence feature track`, { type: 'info', icon: '🏷️' });
  };

  const handleRemoveDomainFromForm = (domainId) => {
    setBuilderForm(prev => ({
      ...prev,
      domains: prev.domains.filter(d => d.id !== domainId)
    }));
  };

  // Commit Custom Construct to Firestore
  const handleSaveConstruct = async (e) => {
    e.preventDefault();
    if (!builderForm.name.trim()) {
      showToast('Please enter a construct name', { type: 'error' });
      return;
    }
    const cleanSeq = (builderForm.sequence || '').replace(/[\s\r\n0-9]/g, '').toUpperCase();
    if (!cleanSeq) {
      showToast('Please provide a sequence for the construct', { type: 'error' });
      return;
    }

    const payload = {
      ...builderForm,
      sequence: cleanSeq,
      updatedAt: serverTimestamp(),
      updatedBy: user?.displayName || user?.email || 'Researcher'
    };

    try {
      if (builderForm.id && !builderForm.id.startsWith('temp_')) {
        await setDoc(doc(db, 'labs', activeLab.id, 'biological_entities', builderForm.id), payload, { merge: true });
        setActiveConstruct({ ...payload, id: builderForm.id });
        showToast(`Construct "${payload.name}" updated successfully!`, { type: 'success', icon: '💾' });
      } else {
        const docRef = await addDoc(collection(db, 'labs', activeLab.id, 'biological_entities'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.displayName || user?.email || 'Researcher',
          authorUid: user?.uid || null
        });
        const created = { ...payload, id: docRef.id };
        setActiveConstruct(created);
        showToast(`Construct "${payload.name}" saved to lab repository!`, { type: 'success', icon: '🧬' });
      }
      setIsBuilderOpen(false);
    } catch (err) {
      console.error('Error saving biological construct:', err);
      // If offline or permission fallback, allow local session usage
      const fallbackLocal = { ...payload, id: builderForm.id || `local_${Date.now()}` };
      setActiveConstruct(fallbackLocal);
      setIsBuilderOpen(false);
      showToast('Construct saved to local session.', { type: 'info', icon: '💾' });
    }
  };

  // Close Active Construct View (Unload from viewer without deleting)
  const handleCloseActiveConstruct = () => {
    setActiveConstruct(null);
    setActiveDomain(null);
    setHoveredResidue(null);
    playTactileClick();
    showToast('Construct view closed', { type: 'info', icon: '✕' });
  };

  // Delete Construct from Lab Registry & Session
  const handleDeleteConstruct = async (constructId, constructName) => {
    const targetId = constructId || activeConstruct?.id;
    const targetName = constructName || activeConstruct?.name || 'this construct';
    if (!targetId && !activeConstruct) return;

    if (!window.confirm(`Delete "${targetName}" from the laboratory registry? This action cannot be undone.`)) {
      return;
    }

    try {
      if (activeLab?.id && targetId && !targetId.toString().startsWith('temp_') && !targetId.toString().startsWith('local_')) {
        await deleteDoc(doc(db, 'labs', activeLab.id, 'biological_entities', targetId)).catch((e) => {
          console.warn('Firestore doc delete note:', e);
        });
      }

      setSavedConstructs(prev => {
        const remaining = prev.filter(c => c.id !== targetId);
        if (activeConstruct?.id === targetId || !targetId) {
          setActiveConstruct(remaining.length > 0 ? remaining[0] : null);
          setActiveDomain(null);
          setHoveredResidue(null);
        }
        return remaining;
      });

      showToast(`Deleted "${targetName}"`, { type: 'info', icon: '🗑️' });
      playTactileClick();
    } catch (err) {
      console.error('Delete error:', err);
      // Local fallback removal
      setSavedConstructs(prev => {
        const remaining = prev.filter(c => c.id !== targetId);
        if (activeConstruct?.id === targetId) {
          setActiveConstruct(remaining.length > 0 ? remaining[0] : null);
        }
        return remaining;
      });
      showToast('Removed from session', { type: 'info', icon: '🗑️' });
    }
  };

  // Batch Clear All Lab Constructs
  const handleClearAllConstructs = async () => {
    if (savedConstructs.length === 0) return;
    if (!window.confirm(`Delete all ${savedConstructs.length} biological constructs from this laboratory registry? This action cannot be undone.`)) {
      return;
    }

    try {
      if (activeLab?.id) {
        for (const c of savedConstructs) {
          if (c.id && !c.id.toString().startsWith('temp_') && !c.id.toString().startsWith('local_')) {
            await deleteDoc(doc(db, 'labs', activeLab.id, 'biological_entities', c.id)).catch(() => {});
          }
        }
      }
      setSavedConstructs([]);
      setActiveConstruct(null);
      setActiveDomain(null);
      setHoveredResidue(null);
      showToast('All biological constructs deleted', { type: 'info', icon: '🗑️' });
      playTactileClick();
    } catch (err) {
      console.error('Clear all error:', err);
      setSavedConstructs([]);
      setActiveConstruct(null);
      showToast('Cleared session constructs', { type: 'info', icon: '🗑️' });
    }
  };

  // =========================================================================
  // INTERNET BIOLOGICAL MODEL IMPORTER (RCSB PDB & UniProt Live REST API)
  // =========================================================================
  const handleFetchInternetModel = async (queryId) => {
    const cleanId = (queryId || internetSearchQuery).trim().toUpperCase();
    if (!cleanId) {
      showToast('Please enter a PDB ID (e.g., 1N8Z, 6VXX, 4ZS6) or UniProt ID', { type: 'error' });
      return;
    }
    setIsFetchingModel(true);

    try {
      // 1. If 4 characters, query RCSB Protein Data Bank
      if (cleanId.length === 4) {
        const [entryRes, polyRes] = await Promise.all([
          fetch(`https://data.rcsb.org/rest/v1/core/entry/${cleanId}`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity/${cleanId}/1`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        if (!entryRes && !polyRes) {
          throw new Error(`PDB entry "${cleanId}" was not found on RCSB Protein Data Bank.`);
        }

        const seq = polyRes?.entity_poly?.pdbx_seq_one_letter_code || '';
        const entityName = polyRes?.rcsb_polymer_entity?.rcsb_macromolecular_names_combined?.[0]?.name ||
                           entryRes?.struct?.title || `PDB Structure ${cleanId}`;
        const organism = polyRes?.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name ||
                         (entryRes?.rcsb_entry_info?.polymer_entity_count_protein ? 'Recombinant Expression' : 'Synthetic Construct');
        const authors = entryRes?.audit_author?.map(a => a.name).slice(0, 3).join(', ') || 'RCSB PDB Depositors';

        const importedConstruct = {
          id: `temp_${Date.now()}`,
          name: entityName.length > 55 ? entityName.slice(0, 55) + '...' : entityName,
          registryId: `PDB-${cleanId}`,
          type: polyRes?.entity_poly?.type === 'polypeptide(L)' ? 'Protein / Polypeptide' : 'DNA / Nucleic Acid',
          organism,
          pdbId: cleanId,
          sequence: seq.replace(/[\s\r\n0-9]/g, '').toUpperCase(),
          description: entryRes?.struct?.title || `Live imported 3D structure model from RCSB PDB (${cleanId}).`,
          authors,
          domains: [
            { id: 'DOM-CORE', label: 'Crystallized Domain', start: 1, end: Math.min(seq.length, 120), color: '#D1FAE5', textColor: '#065F46', category: 'Crystallographic Domain' }
          ],
          source: 'RCSB Protein Data Bank (Live API)'
        };

        setActiveConstruct(importedConstruct);
        setBuilderForm({ ...importedConstruct });
        setIsImportModalOpen(false);
        setIsBuilderOpen(true);
        showToast(`Successfully imported ${cleanId} from RCSB PDB!`, { type: 'success', icon: '🌐' });
      } else {
        // 2. Query UniProtKB API
        const uniRes = await fetch(`https://rest.uniprot.org/uniprotkb/${cleanId}.json`).then(r => r.ok ? r.json() : null);
        if (!uniRes || !uniRes.sequence?.value) {
          throw new Error(`UniProt accession "${cleanId}" was not found.`);
        }

        const seq = uniRes.sequence.value;
        const name = uniRes.proteinDescription?.recommendedName?.fullName?.value ||
                     uniRes.genes?.[0]?.geneName?.value || `UniProt ${cleanId}`;
        const organism = uniRes.organism?.scientificName || 'Homo sapiens';
        const features = (uniRes.features || []).filter(f => f.location?.start?.value && f.location?.end?.value).slice(0, 6);
        const parsedDomains = features.map((f, idx) => ({
          id: `dom-${idx + 1}`,
          label: f.description || f.type || `Domain ${idx + 1}`,
          start: f.location.start.value,
          end: f.location.end.value,
          color: idx % 2 === 0 ? '#FEF3C7' : '#DBEAFE',
          textColor: idx % 2 === 0 ? '#92400E' : '#1E40AF',
          category: f.type || 'UniProt Feature'
        }));

        const pdbRef = (uniRes.uniProtKBCrossReferences || []).find(r => r.database === 'PDB');
        const associatedPdb = pdbRef?.id || '';

        const importedConstruct = {
          id: `temp_${Date.now()}`,
          name,
          registryId: `UNIPROT-${cleanId}`,
          type: 'Protein / Polypeptide',
          organism,
          pdbId: associatedPdb,
          sequence: seq.replace(/[\s\r\n0-9]/g, '').toUpperCase(),
          description: `Imported curated sequence and domain annotations from UniProtKB (${cleanId}).`,
          authors: `${organism} Proteome Consortium`,
          domains: parsedDomains.length > 0 ? parsedDomains : [
            { id: 'dom-full', label: 'Mature Chain', start: 1, end: seq.length, color: '#EFF6FF', textColor: '#1D4ED8', category: 'Mature Chain' }
          ],
          source: 'UniProtKB (Live API)'
        };

        setActiveConstruct(importedConstruct);
        setBuilderForm({ ...importedConstruct });
        setIsImportModalOpen(false);
        setIsBuilderOpen(true);
        showToast(`Successfully imported ${cleanId} from UniProtKB!`, { type: 'success', icon: '🌐' });
      }
    } catch (err) {
      console.error('Import failed:', err);
      showToast(err.message, { type: 'error', icon: '⚠️' });
    } finally {
      setIsFetchingModel(false);
    }
  };

  // Color Coding for Amino Acids and Nucleotides
  const getResidueStyle = (char, isDna) => {
    if (isDna) {
      switch (char) {
        case 'A': return { bg: '#FEE2E2', text: '#991B1B', type: 'Adenine' };
        case 'T': return { bg: '#D1FAE5', text: '#065F46', type: 'Thymine' };
        case 'C': return { bg: '#DBEAFE', text: '#1E40AF', type: 'Cytosine' };
        case 'G': return { bg: '#FEF3C7', text: '#92400E', type: 'Guanine' };
        case 'U': return { bg: '#EDE9FE', text: '#6D28D9', type: 'Uracil' };
        default: return { bg: '#F1F5F9', text: '#334155', type: 'Nucleotide' };
      }
    }

    switch (char) {
      case 'A': case 'V': case 'L': case 'I': case 'M': case 'F': case 'W': case 'P':
        return { bg: '#D1FAE5', text: '#065F46', type: 'Hydrophobic' };
      case 'S': case 'T': case 'C': case 'N': case 'Q': case 'Y':
        return { bg: '#DBEAFE', text: '#1E40AF', type: 'Polar Uncharged' };
      case 'K': case 'R': case 'H':
        return { bg: '#EDE9FE', text: '#6D28D9', type: 'Basic (+)' };
      case 'D': case 'E':
        return { bg: '#FEE2E2', text: '#991B1B', type: 'Acidic (-)' };
      case 'G':
        return { bg: '#FEF3C7', text: '#92400E', type: 'Glycine' };
      default:
        return { bg: '#F1F5F9', text: '#334155', type: 'Residue' };
    }
  };

  // Sequence Telemetry Calculation
  const telemetry = useMemo(() => {
    if (!activeConstruct?.sequence) {
      return { length: 0, mwKDa: '0.0', pI: '7.0', gcPercent: '0.0' };
    }
    const seq = activeConstruct.sequence;
    const len = seq.length;
    const isDna = activeConstruct.type?.includes('DNA') || activeConstruct.type?.includes('RNA');

    if (isDna) {
      const gCount = (seq.match(/G/g) || []).length;
      const cCount = (seq.match(/C/g) || []).length;
      const gc = len > 0 ? ((gCount + cCount) / len * 100).toFixed(1) : '0.0';
      const mw = (len * 330 / 1000).toFixed(1);
      return { length: len, mwKDa: mw, pI: 'N/A', gcPercent: gc, isDna: true };
    }

    // Protein MW estimation (~110 Da per residue)
    const mw = (len * 110 / 1000).toFixed(1);
    const basic = (seq.match(/[KRH]/g) || []).length;
    const acidic = (seq.match(/[DE]/g) || []).length;
    const estPI = (7.0 + (basic - acidic) * 0.1).toFixed(2);

    return { length: len, mwKDa: mw, pI: estPI, gcPercent: 'N/A', isDna: false };
  }, [activeConstruct]);

  // Find Domain for Coordinate
  const getDomainForPos = (pos) => {
    return (activeConstruct?.domains || []).find(d => pos >= d.start && pos <= d.end);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FFFFFF', overflow: 'hidden' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP SUITE HEADER BAR                                                   */}
      {/* ========================================================================= */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '10px 20px', 
          borderBottom: '1px solid #E2E8F0',
          background: '#FFFFFF'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🧬
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                {activeConstruct ? activeConstruct.name : 'Biological Sequence & Construct Studio'}
              </h2>
              {activeConstruct && (
                <span className="benchling-badge benchling-badge-emerald">
                  {activeConstruct.type}
                </span>
              )}
              {activeConstruct && (
                <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
                  {telemetry.length} {telemetry.isDna ? 'BP' : 'AA'} • {telemetry.mwKDa} kDa
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              {activeConstruct ? `${activeConstruct.organism} • ID: ${activeConstruct.registryId || 'Custom'}` : 'Interactive custom construct builder & internet structural model import'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Mode Tabs */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '6px', padding: '3px', border: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => { setActiveTab('sequence'); playTactileClick(); }}
              style={{
                border: 'none',
                background: activeTab === 'sequence' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'sequence' ? '#0B4FD9' : '#64748B',
                fontWeight: activeTab === 'sequence' ? '700' : '500',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeTab === 'sequence' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Sequence Map
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('structure3d'); playTactileClick(); }}
              style={{
                border: 'none',
                background: activeTab === 'structure3d' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'structure3d' ? '#0B4FD9' : '#64748B',
                fontWeight: activeTab === 'structure3d' ? '700' : '500',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeTab === 'structure3d' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              3D Structure (Mol*)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('telemetry'); playTactileClick(); }}
              style={{
                border: 'none',
                background: activeTab === 'telemetry' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'telemetry' ? '#0B4FD9' : '#64748B',
                fontWeight: activeTab === 'telemetry' ? '700' : '500',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: activeTab === 'telemetry' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Telemetry & QC
            </button>
          </div>

          {/* Builder Triggers */}
          <button
            type="button"
            onClick={handleOpenNewBuilder}
            className="tactile-pill-btn"
            style={{
              background: '#0B4FD9',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>+ Build Construct</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="tactile-pill-btn"
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#1E293B',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🌐 Import Model</span>
          </button>

          {activeConstruct && (
            <>
              <button
                type="button"
                onClick={handleEditActiveConstruct}
                className="tactile-pill-btn"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#334155',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                title="Edit Sequence or Annotations"
              >
                ✏️ Edit
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConstruct(activeConstruct.id, activeConstruct.name)}
                className="tactile-pill-btn"
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Delete this construct from lab registry"
              >
                <span>🗑️ Delete</span>
              </button>
              <button
                type="button"
                onClick={handleCloseActiveConstruct}
                className="tactile-pill-btn"
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                title="Close active construct viewer"
              >
                ✕ Close
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              const aiPrompt = activeConstruct?.sequence
                ? `Analyze the biological construct "${activeConstruct.name}" (Type: ${activeConstruct.type}, Host: ${activeConstruct.organism}, Length: ${telemetry.length} ${telemetry.isDna ? 'bp' : 'residues'}, Sequence: ${activeConstruct.sequence.slice(0, 120)}...). What are the recommended expression conditions, restriction cloning strategies, and potential biochemical liabilities?`
                : 'Help me design and optimize a recombinant biological construct for experimental expression in the lab.';

              if (onAskAI) {
                onAskAI(aiPrompt);
              } else {
                window.dispatchEvent(new CustomEvent('open_molqen_ai', {
                  detail: { prompt: aiPrompt, autoSubmit: true }
                }));
              }
              playTactileClick();
            }}
            className="tactile-pill-btn"
            style={{
              background: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>⚡ Ask AI</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE SPLIT (Construct List on Left + Active Studio on Right) */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Sidebar: Lab Registry & Custom Constructs */}
        <div style={{ width: '260px', borderRight: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Lab Constructs ({savedConstructs.length})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {savedConstructs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllConstructs}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
                  title="Delete all constructs from registry"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenNewBuilder}
                style={{ background: 'none', border: 'none', color: '#0B4FD9', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', lineHeight: 1 }}
                title="Add New Construct"
              >
                +
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {savedConstructs.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧪</div>
                <div style={{ fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  No Constructs Saved Yet
                </div>
                <p style={{ margin: '0 0 12px 0', lineHeight: '1.4' }}>
                  Build custom constructs from scratch or import real biological models from the internet.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleOpenNewBuilder}
                    className="tactile-pill-btn"
                    style={{ background: '#0B4FD9', color: '#FFFFFF', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    + Build Custom Construct
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="tactile-pill-btn"
                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    🌐 Import from Internet
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {savedConstructs.map(c => {
                  const isSelected = activeConstruct?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectConstruct(c)}
                      style={{
                        padding: '10px 12px',
                        background: isSelected ? '#FFFFFF' : 'transparent',
                        border: `1px solid ${isSelected ? '#0B4FD9' : '#E2E8F0'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 1px 3px rgba(11, 79, 217, 0.12)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? '#0B4FD9' : '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {c.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConstruct(c.id, c.name);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            fontSize: '12px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#DC2626';
                            e.currentTarget.style.background = '#FEE2E2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#94A3B8';
                            e.currentTarget.style.background = 'transparent';
                          }}
                          title={`Delete "${c.name}"`}
                          aria-label={`Delete construct ${c.name}`}
                        >
                          🗑️
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="benchling-badge benchling-badge-slate" style={{ fontSize: '9px' }}>
                          {c.type?.includes('DNA') ? 'DNA' : 'PROTEIN'}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
                          {c.sequence?.length || 0} {c.type?.includes('DNA') ? 'bp' : 'aa'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Main Viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Active Construct Banner / Empty State */}
          {!activeConstruct ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#F8FAFC' }}>
              <div style={{ maxWidth: '440px', textAlign: 'center', background: '#FFFFFF', padding: '36px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
                <div style={{ fontSize: '42px', marginBottom: '12px' }}>🧬</div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px 0' }}>
                  No Construct Selected
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                  Students and teachers can build custom constructs from scratch, or import biological models directly from RCSB PDB and UniProt.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={handleOpenNewBuilder}
                    className="tactile-pill-btn"
                    style={{ background: '#0B4FD9', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    + Build Custom Construct
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="tactile-pill-btn"
                    style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#1E293B', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    🌐 Import from Internet
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
              {/* Left / Center Stage: Interactive Visual Canvas (65-70%) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>
              
              {/* Secondary Subtoolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '11px', color: '#64748B' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    FEATURE TOPOGRAPHY
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#0F172A' }}>
                    Length: <strong>{telemetry.length}</strong> {telemetry.isDna ? 'bp' : 'residues'}
                  </span>
                  <span>•</span>
                  <span>MW: <strong>{telemetry.mwKDa} kDa</strong></span>
                  {telemetry.isDna && (
                    <>
                      <span>•</span>
                      <span>GC: <strong>{telemetry.gcPercent}%</strong></span>
                    </>
                  )}
                  {!telemetry.isDna && (
                    <>
                      <span>•</span>
                      <span>pI: <strong>{telemetry.pI}</strong></span>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowRuler(prev => !prev)}
                    style={{ padding: '2px 8px', border: '1px solid #CBD5E1', background: showRuler ? '#EFF6FF' : '#FFFFFF', color: showRuler ? '#0B4FD9' : '#64748B', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                  >
                    📏 Ruler: {showRuler ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.max(0.8, prev - 0.1))}
                    style={{ padding: '2px 7px', border: '1px solid #CBD5E1', background: '#FFFFFF', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                  >
                    -
                  </button>
                  <span style={{ fontFamily: 'monospace' }}>{(zoomLevel * 100).toFixed(0)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                    style={{ padding: '2px 7px', border: '1px solid #CBD5E1', background: '#FFFFFF', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fasta = `>${activeConstruct.registryId || 'Construct'} | ${activeConstruct.name}\n${activeConstruct.sequence}`;
                      navigator.clipboard.writeText(fasta);
                      showToast('FASTA Copied to Clipboard', { type: 'success', icon: '📋' });
                    }}
                    className="tactile-pill-btn"
                    style={{ padding: '3px 10px', border: '1px solid #CBD5E1', background: '#FFFFFF', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Copy FASTA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteConstruct(activeConstruct.id, activeConstruct.name)}
                    className="tactile-pill-btn"
                    style={{
                      padding: '3px 10px',
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Delete construct from registry"
                  >
                    <span>🗑️ Delete</span>
                  </button>
                </div>
              </div>

              {/* Viewport Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#FFFFFF' }}>
                
                {/* 1. SEQUENCE & FEATURE MAP VIEW */}
                {activeTab === 'sequence' && (
                  <div>
                    {/* Domain Filter Buttons */}
                    {(activeConstruct.domains || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <button
                          type="button"
                          onClick={() => setActiveDomain(null)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            border: '1px solid #CBD5E1',
                            background: activeDomain === null ? '#0F172A' : '#FFFFFF',
                            color: activeDomain === null ? '#FFFFFF' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          All Features ({activeConstruct.domains.length})
                        </button>
                        {activeConstruct.domains.map(dom => (
                          <button
                            key={dom.id}
                            type="button"
                            onClick={() => {
                              setActiveDomain(activeDomain === dom.id ? null : dom.id);
                              playTactileClick();
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              border: `1px solid ${activeDomain === dom.id ? '#0B4FD9' : '#CBD5E1'}`,
                              background: activeDomain === dom.id ? '#EFF6FF' : dom.color || '#F1F5F9',
                              color: activeDomain === dom.id ? '#0B4FD9' : dom.textColor || '#1E293B',
                              cursor: 'pointer'
                            }}
                          >
                            {dom.label} ({dom.start}–{dom.end})
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Sequence Rendered in Chunks of 50 */}
                    <div 
                      style={{ 
                        transform: `scale(${zoomLevel})`, 
                        transformOrigin: 'top left',
                        background: '#F8FAFC',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0'
                      }}
                    >
                      {Array.from({ length: Math.ceil(activeConstruct.sequence.length / 50) }).map((_, chunkIdx) => {
                        const startRes = chunkIdx * 50;
                        const chunkSeq = activeConstruct.sequence.slice(startRes, startRes + 50);

                        return (
                          <div key={chunkIdx} style={{ marginBottom: '18px' }}>
                            {/* Ruler Numbers */}
                            {showRuler && (
                              <div style={{ display: 'flex', gap: '3px', marginBottom: '3px', paddingLeft: '45px' }}>
                                {chunkSeq.split('').map((_, i) => {
                                  const pos = startRes + i + 1;
                                  const isMajor = pos % 10 === 0;
                                  return (
                                    <div 
                                      key={i} 
                                      style={{ 
                                        width: '17px', 
                                        textAlign: 'center', 
                                        fontSize: '9px', 
                                        fontFamily: 'monospace',
                                        color: isMajor ? '#0F172A' : 'transparent',
                                        fontWeight: '700'
                                      }}
                                    >
                                      {isMajor ? pos : ''}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Sequence Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '38px', fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace', textAlign: 'right', fontWeight: '600' }}>
                                {startRes + 1}
                              </span>

                              <div style={{ display: 'flex', gap: '3px', flexWrap: 'nowrap' }}>
                                {chunkSeq.split('').map((char, charIdx) => {
                                  const residueIndex = startRes + charIdx + 1;
                                  const domain = getDomainForPos(residueIndex);
                                  const isDomainMatch = !activeDomain || domain?.id === activeDomain;
                                  const style = getResidueStyle(char, telemetry.isDna);

                                  return (
                                    <div
                                      key={charIdx}
                                      onMouseEnter={() => setHoveredResidue({ index: residueIndex, char, domain, ...style })}
                                      onMouseLeave={() => setHoveredResidue(null)}
                                      className="sequence-char-block"
                                      style={{
                                        background: isDomainMatch ? style.bg : '#F1F5F9',
                                        color: isDomainMatch ? style.text : '#CBD5E1',
                                        opacity: isDomainMatch ? 1 : 0.35,
                                        border: domain ? '1px solid #3B82F6' : '1px solid transparent'
                                      }}
                                      title={`Pos: ${residueIndex} | ${char} (${style.type})${domain ? ` | Feature: ${domain.label}` : ''}`}
                                    >
                                      {char}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Domain Feature Track Bar Underneath */}
                            <div style={{ display: 'flex', gap: '3px', marginTop: '4px', paddingLeft: '45px' }}>
                              {chunkSeq.split('').map((_, i) => {
                                const pos = startRes + i + 1;
                                const domain = getDomainForPos(pos);
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      width: '17px',
                                      height: '4px',
                                      background: domain ? '#3B82F6' : 'transparent',
                                      borderRadius: '1px'
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Residue Hover Telemetry Inspector */}
                    <div style={{ marginTop: '16px', padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px' }}>🔬</span>
                        {hoveredResidue ? (
                          <span style={{ fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>
                            {telemetry.isDna ? 'Base' : 'Residue'} <strong>{hoveredResidue.char}</strong> at Position <strong>#{hoveredResidue.index}</strong> • Type: <em>{hoveredResidue.type}</em>{hoveredResidue.domain && ` • Feature: [${hoveredResidue.domain.label}]`}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748B' }}>
                            Hover over any residue to inspect biochemical coordinates and assigned domains.
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                        Benchling-Grade Interactive Sequence Map
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. REAL 3D MOLECULAR STRUCTURE (Molstar / Mol* WebGL Viewer) */}
                {activeTab === 'structure3d' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '520px' }}>
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                          Mol* (Molstar) 3D Macromolecular Structure Viewer
                        </h3>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          Official crystallographic & Cryo-EM 3D WebGL renderer (used by RCSB PDB & AlphaFold)
                        </span>
                      </div>

                      {/* PDB Quick Selector / Input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>PDB ID:</span>
                        <input
                          type="text"
                          defaultValue={activeConstruct.pdbId || '1N8Z'}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setActiveConstruct(prev => ({ ...prev, pdbId: e.target.value.trim().toUpperCase() }));
                              showToast(`Switched 3D model to PDB ${e.target.value.trim().toUpperCase()}`, { type: 'info', icon: '🌐' });
                            }
                          }}
                          style={{ width: '80px', padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', textAlign: 'center', textTransform: 'uppercase' }}
                          title="Press Enter to load PDB ID"
                        />
                      </div>
                    </div>

                    {/* Official Mol* Interactive 3D Viewer Embed */}
                    <div 
                      style={{ 
                        flex: 1, 
                        minHeight: '480px', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        border: '1px solid #CBD5E1',
                        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
                        background: '#0F172A'
                      }}
                    >
                      <iframe
                        src={`https://molstar.org/viewer/?pdb=${activeConstruct.pdbId || '1N8Z'}&hide-controls=0`}
                        title={`3D Molecular Viewer - ${activeConstruct.pdbId || '1N8Z'}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '480px',
                          border: 'none',
                          display: 'block'
                        }}
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

                {/* 3. BIOCHEMICAL TELEMETRY & QC VIEW */}
                {activeTab === 'telemetry' && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 16px 0' }}>
                      Biochemical Parameters & Synthesis Feasibility
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
                      <div className="benchling-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                          Sequence Length
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>
                          {telemetry.length} <span style={{ fontSize: '12px', fontWeight: '500' }}>{telemetry.isDna ? 'bp' : 'aa'}</span>
                        </div>
                      </div>

                      <div className="benchling-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                          Molecular Mass
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#0B4FD9', marginTop: '4px' }}>
                          {telemetry.mwKDa} <span style={{ fontSize: '12px', fontWeight: '500' }}>kDa</span>
                        </div>
                      </div>

                      <div className="benchling-card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                          {telemetry.isDna ? 'GC Ratio' : 'Isoelectric Point (pI)'}
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                          {telemetry.isDna ? `${telemetry.gcPercent}%` : telemetry.pI}
                        </div>
                      </div>
                    </div>

                    <div className="benchling-card" style={{ padding: '20px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 12px 0' }}>
                        Assigned Sequence Feature Annotations ({activeConstruct.domains?.length || 0})
                      </h4>
                      {(!activeConstruct.domains || activeConstruct.domains.length === 0) ? (
                        <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                          No domain annotations assigned yet. Click &ldquo;Edit&rdquo; above to annotate promoters, CDRs, or affinity tags.
                        </p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                              <th style={{ padding: '8px 10px', color: '#64748B' }}>FEATURE NAME</th>
                              <th style={{ padding: '8px 10px', color: '#64748B' }}>CATEGORY</th>
                              <th style={{ padding: '8px 10px', color: '#64748B' }}>START</th>
                              <th style={{ padding: '8px 10px', color: '#64748B' }}>END</th>
                              <th style={{ padding: '8px 10px', color: '#64748B' }}>SPAN</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeConstruct.domains.map(d => (
                              <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: d.color, marginRight: '6px' }}></span>
                                  {d.label}
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748B' }}>{d.category}</td>
                                <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{d.start}</td>
                                <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{d.end}</td>
                                <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{d.end - d.start + 1} bp/aa</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right Inspector Panel: Benchling-style Entity Metadata Inspector (30-35%, collapsible) */}
            <div
              style={{
                width: isInspectorCollapsed ? '32px' : '340px',
                height: '100%',
                flexShrink: 0,
                transition: 'width 0.18s ease',
                overflow: 'hidden'
              }}
            >
              <ScientificEntityInspector
                entity={entityInspectorData}
                activeSubtab={inspectorSubtab}
                onSubtabChange={setInspectorSubtab}
                isCollapsed={isInspectorCollapsed}
                onToggleCollapse={() => setIsInspectorCollapsed(prev => !prev)}
              />
            </div>
          </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. BUILDER MODAL: STUDENT / TEACHER CUSTOM CONSTRUCT CREATOR              */}
      {/* ========================================================================= */}
      {isBuilderOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setIsBuilderOpen(false)}
        >
          <div 
            style={{
              width: '840px',
              maxWidth: '96vw',
              maxHeight: '88vh',
              background: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  {builderForm.id ? 'Edit Biological Construct' : 'Build Custom Biological Construct'}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Define custom sequence, expression host, and functional domain annotations.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBuilderOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94A3B8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveConstruct} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Construct Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pCas9-GFP-Reporter, Trastuzumab-scFv"
                    value={builderForm.name}
                    onChange={e => setBuilderForm({ ...builderForm, name: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Construct Type</label>
                  <select
                    value={builderForm.type}
                    onChange={e => setBuilderForm({ ...builderForm, type: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="Protein / Polypeptide">Protein / Polypeptide</option>
                    <option value="DNA Sequence / Plasmid">DNA Sequence / Plasmid</option>
                    <option value="RNA / mRNA">RNA / mRNA</option>
                    <option value="Oligo Primer">Oligo Primer</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Source / Expression Host</label>
                  <input
                    type="text"
                    placeholder="e.g. E. coli BL21, Homo sapiens, CHO Cells"
                    value={builderForm.organism}
                    onChange={e => setBuilderForm({ ...builderForm, organism: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Associated PDB ID (Optional for 3D Viewer)</label>
                  <input
                    type="text"
                    placeholder="e.g. 1N8Z, 6VXX, 4ZS6"
                    value={builderForm.pdbId}
                    onChange={e => setBuilderForm({ ...builderForm, pdbId: e.target.value.trim().toUpperCase() })}
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* Raw Sequence Input */}
              <div>
                <label style={labelStyle}>
                  Sequence (FASTA or Raw Letters) *
                </label>
                <textarea
                  rows="5"
                  required
                  placeholder="Paste amino acid letters (e.g. EVQLVESGG...) or DNA nucleotides (ATCG...)"
                  value={builderForm.sequence}
                  onChange={e => setBuilderForm({ ...builderForm, sequence: e.target.value })}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4' }}
                />
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                  Spaces, numbers, and carriage returns are automatically filtered upon saving.
                </span>
              </div>

              {/* Feature Domain Annotator */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>
                  + Add Functional Domain / Feature Annotation
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: '8px', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Domain Label</label>
                    <input
                      type="text"
                      placeholder="e.g. CDR-H1, Promoter, His6"
                      value={newDomain.label}
                      onChange={e => setNewDomain({ ...newDomain, label: e.target.value })}
                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Start</label>
                    <input
                      type="number"
                      min="1"
                      value={newDomain.start}
                      onChange={e => setNewDomain({ ...newDomain, start: e.target.value })}
                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>End</label>
                    <input
                      type="number"
                      min="1"
                      value={newDomain.end}
                      onChange={e => setNewDomain({ ...newDomain, end: e.target.value })}
                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Category</label>
                    <select
                      value={newDomain.category}
                      onChange={e => setNewDomain({ ...newDomain, category: e.target.value })}
                      style={{ ...inputStyle, padding: '5px 8px', fontSize: '11px' }}
                    >
                      <option value="Binding Domain">Binding Domain</option>
                      <option value="Promoter / Regulatory">Promoter / Regulatory</option>
                      <option value="Affinity Tag">Affinity Tag</option>
                      <option value="Cleavage Site">Cleavage Site</option>
                      <option value="Resistance Marker">Resistance Marker</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDomainToForm}
                    className="tactile-pill-btn"
                    style={{ background: '#0B4FD9', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Add
                  </button>
                </div>

                {/* List of currently added domains */}
                {builderForm.domains.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {builderForm.domains.map(d => (
                      <span
                        key={d.id}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <strong>{d.label}</strong> ({d.start}–{d.end})
                        <button
                          type="button"
                          onClick={() => handleRemoveDomainFromForm(d.id)}
                          style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '10px' }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                {builderForm.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsBuilderOpen(false);
                      handleDeleteConstruct(builderForm.id, builderForm.name);
                    }}
                    className="tactile-pill-btn"
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#DC2626',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Delete construct from registry"
                  >
                    <span>🗑️ Delete Construct</span>
                  </button>
                ) : (
                  <div />
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsBuilderOpen(false)}
                    style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="tactile-pill-btn"
                    style={{ background: '#0B4FD9', color: '#FFFFFF', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    💾 Save Construct to Lab Core
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. INTERNET BIOLOGICAL MODEL IMPORT MODAL (RCSB PDB & UniProt)            */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 10006,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setIsImportModalOpen(false)}
        >
          <div 
            style={{
              width: '620px',
              maxWidth: '96vw',
              background: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>
                  🌐 Import Biological Model from the Internet
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                  Fetch live 3D structures and sequences from RCSB Protein Data Bank or UniProtKB.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94A3B8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div>
              <label style={labelStyle}>Enter PDB ID or UniProt Accession</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. 1N8Z, 6VXX, 4ZS6, P04626"
                  value={internetSearchQuery}
                  onChange={e => setInternetSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleFetchInternetModel(); }}
                  style={{ ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  onClick={() => handleFetchInternetModel()}
                  disabled={isFetchingModel}
                  className="tactile-pill-btn"
                  style={{
                    background: '#0B4FD9',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isFetchingModel ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isFetchingModel ? '⏳ Fetching...' : 'Fetch & Load'}
                </button>
              </div>
            </div>

            {/* Suggested Real Scientific Models */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '8px', textTransform: 'uppercase' }}>
                Or Load a Real Structural Benchmark:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleFetchInternetModel('1N8Z')}
                  style={suggestedBtnStyle}
                >
                  <strong>1N8Z</strong> • Herceptin / HER2 Fab Complex
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchInternetModel('6VXX')}
                  style={suggestedBtnStyle}
                >
                  <strong>6VXX</strong> • SARS-CoV-2 Spike Glycoprotein
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchInternetModel('4ZS6')}
                  style={suggestedBtnStyle}
                >
                  <strong>4ZS6</strong> • CRISPR-Cas9 Bound to sgRNA
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchInternetModel('1BNA')}
                  style={suggestedBtnStyle}
                >
                  <strong>1BNA</strong> • B-DNA Synthetic Dodecamer
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchInternetModel('P01308')}
                  style={suggestedBtnStyle}
                >
                  <strong>P01308</strong> • Human Insulin (UniProt)
                </button>
                <button
                  type="button"
                  onClick={() => handleFetchInternetModel('P04626')}
                  style={suggestedBtnStyle}
                >
                  <strong>P04626</strong> • Human Receptor ErbB-2 / HER2
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Reusable Styles
const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '700',
  color: '#475569',
  marginBottom: '4px'
};

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #CBD5E1',
  borderRadius: '6px',
  fontSize: '12px',
  color: '#0F172A',
  background: '#FFFFFF',
  boxSizing: 'border-box'
};

const suggestedBtnStyle = {
  padding: '8px 10px',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '6px',
  fontSize: '11px',
  color: '#334155',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'all 0.15s ease'
};

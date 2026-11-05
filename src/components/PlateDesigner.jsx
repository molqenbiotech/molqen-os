import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const WELL_TYPES = {
  empty: { label: 'Empty', color: '#ffffff', border: '#ced4da', text: '#adb5bd' },
  sample: { label: 'Sample', color: '#d8f3dc', border: '#52b788', text: '#1b4332' },
  standard: { label: 'Standard', color: '#e7f5ff', border: '#339af0', text: '#1864ab' },
  pos_ctrl: { label: '+ Control', color: '#fff3bf', border: '#fcc419', text: '#e67700' },
  neg_ctrl: { label: '- Control', color: '#ffe3e3', border: '#ff6b6b', text: '#c92a2a' },
  blank: { label: 'Blank', color: '#f1f3f5', border: '#adb5bd', text: '#495057' }
};

export default function PlateDesigner({ currentOrg }) {
  const [plateName, setPlateName] = useState('');
  const [assayType, setAssayType] = useState('ELISA (OD 450nm)');
  const [selectedBrush, setSelectedBrush] = useState('sample');
  const [sampleLabelInput, setSampleLabelInput] = useState('S1');
  const [viewMode, setViewMode] = useState('layout'); // 'layout' | 'heatmap'
  const [wells, setWells] = useState({});
  const [savedPlates, setSavedPlates] = useState([]);
  const [rawPasteText, setRawPasteText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);

  // Sync saved plates from Firestore
  useEffect(() => {
    if (!currentOrg?.id) return;
    const q = query(collection(db, 'plates'), where('labId', '==', currentOrg.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSavedPlates(list);
    });
    return () => unsubscribe();
  }, [currentOrg?.id]);

  // Click a well to paint role or input OD value
  const handleWellClick = (wellId) => {
    if (viewMode === 'heatmap') {
      const currentOd = wells[wellId]?.od ?? '';
      const val = window.prompt(`Enter Optical Density (OD) reading for well ${wellId}:`, currentOd);
      if (val !== null) {
        setWells(prev => ({
          ...prev,
          [wellId]: {
            ...(prev[wellId] || { type: 'sample', label: wellId }),
            od: val === '' ? null : parseFloat(val)
          }
        }));
      }
      return;
    }

    setWells(prev => ({
      ...prev,
      [wellId]: {
        type: selectedBrush,
        label: selectedBrush === 'empty' ? '' : sampleLabelInput,
        od: prev[wellId]?.od ?? null
      }
    }));
  };

  // Simulate realistic OD 450/600nm readings based on assigned well types
  const handleSimulateReadings = () => {
    const nextWells = { ...wells };
    ROWS.forEach((r, rIdx) => {
      COLS.forEach((c) => {
        const id = `${r}${c}`;
        const existing = nextWells[id] || { type: 'sample', label: id };
        let simulatedOd = 0.05;
        if (existing.type === 'blank') simulatedOd = +(0.042 + Math.random() * 0.015).toFixed(3);
        else if (existing.type === 'neg_ctrl') simulatedOd = +(0.08 + Math.random() * 0.03).toFixed(3);
        else if (existing.type === 'pos_ctrl') simulatedOd = +(1.85 + Math.random() * 0.35).toFixed(3);
        else if (existing.type === 'standard') simulatedOd = +(2.4 / Math.pow(1.6, rIdx) + Math.random() * 0.04).toFixed(3);
        else if (existing.type === 'sample') simulatedOd = +(0.25 + Math.random() * 1.65).toFixed(3);
        else simulatedOd = +(0.045 + Math.random() * 0.01).toFixed(3);

        nextWells[id] = { ...existing, od: simulatedOd };
      });
    });
    setWells(nextWells);
    setViewMode('heatmap');
  };

  // Parse 8x12 tab- or comma-separated matrix from Spectrophotometer / Excel
  const handleApplyPastedMatrix = () => {
    const lines = rawPasteText.trim().split(/\r?\n/);
    const nextWells = { ...wells };
    lines.slice(0, 8).forEach((line, rIdx) => {
      const values = line.split(/[\t,]+/);
      values.slice(0, 12).forEach((val, cIdx) => {
        const num = parseFloat(val.trim());
        if (!isNaN(num)) {
          const wellId = `${ROWS[rIdx]}${COLS[cIdx]}`;
          nextWells[wellId] = {
            ...(nextWells[wellId] || { type: 'sample', label: wellId }),
            od: num
          };
        }
      });
    });
    setWells(nextWells);
    setShowPasteModal(false);
    setRawPasteText('');
    setViewMode('heatmap');
  };

  // Export plate map & OD values to CSV for Graph Studio
  const handleExportCSV = () => {
    let csv = 'Well,Row,Column,Type,Label,OD_Reading\n';
    ROWS.forEach(r => {
      COLS.forEach(c => {
        const id = `${r}${c}`;
        const w = wells[id] || { type: 'empty', label: '', od: '' };
        csv += `${id},${r},${c},${w.type},${w.label || ''},${w.od ?? ''}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(plateName || '96_Well_Assay').replace(/\s+/g, '_')}.csv`;
    a.click();
  };

  // Save Plate to Cloud
  const handleSavePlate = async () => {
    if (!plateName.trim() || !currentOrg?.id) {
      alert('Please enter a plate name before saving.');
      return;
    }
    try {
      await addDoc(collection(db, 'plates'), {
        name: plateName.trim(),
        assayType,
        wells,
        labId: currentOrg.id,
        createdAt: serverTimestamp()
      });
      setPlateName('');
    } catch (err) {
      console.error('Error saving plate:', err);
    }
  };

  // Calculate Heatmap Color based on OD (0.0 to 2.5 range)
  const getHeatmapColor = (od) => {
    if (od === null || od === undefined || isNaN(od)) return '#ffffff';
    const clamped = Math.min(2.5, Math.max(0, od));
    const intensity = clamped / 2.5;
    // Interpolate from light mint (#f0fdf4) to deep bio-forest (#1b4332)
    const r = Math.round(240 - intensity * 213);
    const g = Math.round(253 - intensity * 186);
    const b = Math.round(244 - intensity * 194);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Blank average & summary metrics
  const allOds = Object.values(wells).map(w => w.od).filter(v => typeof v === 'number');
  const blankOds = Object.values(wells).filter(w => w.type === 'blank' && typeof w.od === 'number').map(w => w.od);
  const meanBlank = blankOds.length > 0 ? (blankOds.reduce((a, b) => a + b, 0) / blankOds.length).toFixed(3) : '0.000';
  const maxOd = allOds.length > 0 ? Math.max(...allOds).toFixed(3) : '—';

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
            96-Well Microplate Designer & OD Heatmap
          </h2>
          <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
            Map ELISA, qPCR, and Bradford assays or overlay spectrophotometer absorbance matrices
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', background: '#e9ecef', borderRadius: '8px', padding: '3px' }}>
            <button
              type="button"
              onClick={() => setViewMode('layout')}
              style={{
                background: viewMode === 'layout' ? '#ffffff' : 'transparent',
                color: viewMode === 'layout' ? '#1b4332' : '#495057',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🧫 Well Layout Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('heatmap')}
              style={{
                background: viewMode === 'heatmap' ? '#ffffff' : 'transparent',
                color: viewMode === 'heatmap' ? '#1b4332' : '#495057',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🔥 OD Heatmap Overlay
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            style={secondaryBtnStyle}
          >
            📋 Paste Reader Matrix
          </button>
          <button
            type="button"
            onClick={handleSimulateReadings}
            style={secondaryBtnStyle}
          >
            ⚡ Simulate OD Run
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            style={{ ...secondaryBtnStyle, background: '#2d6a4f', color: '#ffffff', border: 'none' }}
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      {/* Control Bar: Brushes & Assay Metadata */}
      <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Well Type Brushes */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#495057', textTransform: 'uppercase' }}>
            Well Brush:
          </span>
          {Object.entries(WELL_TYPES).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelectedBrush(key);
                setViewMode('layout');
              }}
              style={{
                background: cfg.color,
                border: selectedBrush === key ? `2px solid #1b4332` : `1px solid ${cfg.border}`,
                color: cfg.text,
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {cfg.label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Tag (e.g. S1, Std1)"
            value={sampleLabelInput}
            onChange={(e) => setSampleLabelInput(e.target.value)}
            style={{ width: '95px', padding: '5px 8px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px' }}
          />
        </div>

        {/* Save Plate Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Plate Name (e.g. H. pylori IgG ELISA)"
            value={plateName}
            onChange={(e) => setPlateName(e.target.value)}
            style={{ width: '210px', padding: '6px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px' }}
          />
          <select
            value={assayType}
            onChange={(e) => setAssayType(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="ELISA (OD 450nm)">ELISA (OD 450nm)</option>
            <option value="Bacterial Growth (OD 600nm)">Growth (OD 600nm)</option>
            <option value="Bradford Protein (OD 595nm)">Bradford (OD 595nm)</option>
            <option value="MTT Viability (OD 570nm)">MTT Assay (OD 570nm)</option>
            <option value="qPCR Ct Map">qPCR Ct Map</option>
          </select>
          <button
            type="button"
            onClick={handleSavePlate}
            style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            💾 Save Plate
          </button>
          <button
            type="button"
            onClick={() => setWells({})}
            style={{ background: '#fff5f5', color: '#e03131', border: '1px solid #ffc9c9', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main Grid & Saved Plates Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        
        {/* 8x12 Microplate Matrix */}
        <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '14px', padding: '20px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1b4332' }}>
              {viewMode === 'heatmap' ? '🔥 Spectrophotometer Absorbance Heatmap (Click any well to edit OD)' : '🧫 96-Well Layout Canvas (Click any well to assign role)'}
            </span>
            <div style={{ fontSize: '11px', color: '#6c757d', display: 'flex', gap: '14px' }}>
              <span>Mean Blank OD: <strong>{meanBlank}</strong></span>
              <span>Peak OD: <strong>{maxOd}</strong></span>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
            <thead>
              <tr>
                <th style={{ width: '28px' }}></th>
                {COLS.map(c => (
                  <th key={c} style={{ textAlign: 'center', fontSize: '11px', color: '#6c757d', fontWeight: '700', paddingBottom: '4px' }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r}>
                  <td style={{ fontSize: '12px', fontWeight: '800', color: '#495057', textAlign: 'center' }}>
                    {r}
                  </td>
                  {COLS.map(c => {
                    const wellId = `${r}${c}`;
                    const data = wells[wellId] || { type: 'empty', label: '', od: null };
                    const cfg = WELL_TYPES[data.type] || WELL_TYPES.empty;
                    const isDarkHeat = viewMode === 'heatmap' && data.od >= 1.25;

                    return (
                      <td
                        key={wellId}
                        onClick={() => handleWellClick(wellId)}
                        title={`Well ${wellId} | Type: ${cfg.label} | OD: ${data.od ?? 'N/A'}`}
                        style={{
                          height: '44px',
                          minWidth: '48px',
                          borderRadius: '8px',
                          background: viewMode === 'heatmap' ? getHeatmapColor(data.od) : cfg.color,
                          border: `1.5px solid ${viewMode === 'heatmap' ? '#ced4da' : cfg.border}`,
                          cursor: 'pointer',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          padding: '2px',
                          transition: 'transform 0.1s'
                        }}
                      >
                        <div style={{ fontSize: '9px', fontWeight: '700', color: isDarkHeat ? '#ffffff' : cfg.text }}>
                          {data.label || wellId}
                        </div>
                        {data.od !== null && data.od !== undefined && (
                          <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '800', color: isDarkHeat ? '#d8f3dc' : '#212529' }}>
                            {Number(data.od).toFixed(2)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Saved Plate Library */}
        <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '14px', padding: '18px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#1b4332' }}>
            Saved Assay Plates ({savedPlates.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {savedPlates.length === 0 ? (
              <div style={{ fontSize: '11px', color: '#adb5bd', textAlign: 'center', padding: '24px 0' }}>
                No saved plates yet. Map your 96-well layout and click Save Plate.
              </div>
            ) : (
              savedPlates.map(p => (
                <div key={p.id} style={{ background: '#f8faf9', border: '1px solid #e9ecef', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div
                    onClick={() => {
                      setPlateName(p.name);
                      setAssayType(p.assayType || 'ELISA (OD 450nm)');
                      setWells(p.wells || {});
                    }}
                    style={{ cursor: 'pointer', flex: 1 }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1b4332' }}>{p.name}</div>
                    <span style={{ fontSize: '10px', color: '#6c757d' }}>{p.assayType}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteDoc(doc(db, 'plates', p.id))}
                    style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modal for Pasting 8x12 Raw Plate Reader Matrix */}
      {showPasteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(33,37,41,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', maxWidth: '500px', width: '100%' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#1b4332' }}>Paste 8×12 Spectrophotometer Matrix</h3>
            <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 12px 0' }}>
              Copy an 8-row by 12-column block of OD readings directly from Excel or your microplate reader software and paste below:
            </p>
            <textarea
              rows={8}
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder="0.045	0.120	0.340	...&#10;0.048	0.115	0.355	..."
              style={{ width: '100%', padding: '10px', fontFamily: 'monospace', fontSize: '11px', border: '1px solid #ced4da', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleApplyPastedMatrix}
                style={{ flex: 1, background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '9px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                Apply Matrix & Generate Heatmap
              </button>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                style={{ flex: 1, background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '6px', padding: '9px', fontSize: '12px', color: '#495057', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const secondaryBtnStyle = {
  background: '#ffffff',
  border: '1px solid #ced4da',
  borderRadius: '8px',
  padding: '7px 12px',
  fontSize: '12px',
  fontWeight: '600',
  color: '#343a40',
  cursor: 'pointer'
};
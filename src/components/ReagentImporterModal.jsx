import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { playSuccessChime, playTactileClick } from '../utils/audioFeedback';
import { showToast } from '../utils/toast';

export default function ReagentImporterModal({ isOpen, onClose, currentOrg }) {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Wet-lab column auto-mapper
  const normalizeAndMapRow = (rawRow) => {
    const row = {};
    const keys = Object.keys(rawRow);

    const findVal = (regex) => {
      const matchKey = keys.find((k) => regex.test(k.trim()));
      return matchKey !== undefined ? String(rawRow[matchKey] || '').trim() : '';
    };

    row.name = findVal(/^(reagent\s*name|chemical\s*name|chemical|reagent|item\s*name|item|compound|product)$/i) ||
               findVal(/reagent|chemical|compound/i) ||
               findVal(/^name$/i);

    row.cas = findVal(/cas\s*(no|number|#)?|cas_number/i);
    row.catalogNumber = findVal(/catalog\s*(no|number|#)?|cat\s*(no|number|#)?|sku|product\s*code/i);
    row.lotNumber = findVal(/lot\s*(no|number|#)?|batch\s*(no|number|#)?|lot|batch/i);

    const qtyStr = findVal(/quantity|qty|stock|amount|count|volume/i);
    const parsedQty = parseFloat(qtyStr);
    row.quantity = isNaN(parsedQty) ? '' : parsedQty;

    row.unit = findVal(/unit|units|uom|measure/i) || 'mL';
    row.storageTemp = findVal(/storage\s*(temp|temperature)?|temp|location|freezer|condition/i) || '4°C';
    row.expiryDate = findVal(/expir(y|ation)\s*(date)?|exp\s*date|valid\s*till/i);
    row.hazard = findVal(/hazard\s*(class)?|safety|toxicity|ghs/i) || 'Safe / Non-toxic';

    const threshStr = findVal(/threshold|alert\s*below|min\s*stock|reorder/i);
    row.minThreshold = isNaN(parseFloat(threshStr)) ? 5 : parseFloat(threshStr);

    // Validation status
    row.isValid = Boolean(row.name && row.quantity !== '');
    if (!row.name) {
      row.validationError = 'Missing Chemical/Reagent Name';
    } else if (row.quantity === '') {
      row.validationError = 'Missing Quantity';
    } else {
      row.validationError = null;
    }

    return row;
  };

  const processDataRows = (rawRows, fileName) => {
    if (!rawRows || rawRows.length === 0) {
      setErrorMsg(`No data rows detected in ${fileName}. Please check header names.`);
      setParsedRows([]);
      return;
    }

    const mapped = rawRows
      .map(normalizeAndMapRow)
      .filter((r) => r.name || r.quantity !== ''); // Skip empty rows

    if (mapped.length === 0) {
      setErrorMsg('Could not find recognizable reagent columns. Please ensure a "Chemical Name" or "Quantity" column exists.');
      setParsedRows([]);
    } else {
      setParsedRows(mapped);
      setErrorMsg('');
      playTactileClick();
    }
  };

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsProcessing(true);
    setErrorMsg('');

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processDataRows(results.data, selectedFile.name);
          setIsProcessing(false);
        },
        error: (err) => {
          setErrorMsg(`CSV parsing error: ${err.message}`);
          setIsProcessing(false);
        }
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          processDataRows(json, selectedFile.name);
        } catch (readErr) {
          setErrorMsg(`Excel reading error: ${readErr.message}`);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setErrorMsg('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
      setIsProcessing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileUpload({ target: { files: [droppedFile] } });
    }
  };

  const downloadSampleTemplate = () => {
    playTactileClick();
    const sampleHeaders = [
      'Chemical Name',
      'CAS Number',
      'Catalog No',
      'Lot Number',
      'Storage Temp',
      'Quantity',
      'Unit',
      'Alert Below',
      'Expiry Date',
      'Hazard Class'
    ];

    const sampleData = [
      [
        'Tris-HCl 1.0 M pH 8.0',
        '1185-53-1',
        'T1503',
        'LOT-44102',
        '4°C (Cold Room)',
        '500',
        'mL',
        '50',
        '2027-06-30',
        'Safe / Non-toxic'
      ],
      [
        'Taq DNA Polymerase (5 U/µL)',
        '9012-90-2',
        'M0273S',
        'LOT-87123',
        '-20°C (Enzyme Freezer)',
        '250',
        'units',
        '25',
        '2026-12-31',
        'Safe / Non-toxic'
      ],
      [
        'Sodium Dodecyl Sulfate (SDS)',
        '151-21-3',
        'L3771',
        'LOT-91044',
        'Room Temperature',
        '1000',
        'g',
        '100',
        '2028-10-15',
        'Flammable'
      ],
      [
        'Phenol:Chloroform:Isoamyl Alcohol',
        '136112-00-0',
        'P3803',
        'LOT-12349',
        '4°C (Cold Room)',
        '100',
        'mL',
        '20',
        '2026-08-15',
        'Toxic'
      ]
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [sampleHeaders.join(','), ...sampleData.map((e) => e.map(val => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'MOLQEN_Reagents_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded sample reagents template', { type: 'success', icon: '📥' });
  };

  const handleBatchImport = async () => {
    if (!currentOrg?.id) {
      alert('Please select an active laboratory core before importing reagents.');
      return;
    }

    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('No valid reagent rows to import. Ensure at least one row has a name and quantity.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      let completed = 0;
      for (const row of validRows) {
        await addDoc(collection(db, 'reagents'), {
          name: row.name,
          cas: row.cas || '',
          catalogNumber: row.catalogNumber || '',
          lotNumber: row.lotNumber || '',
          storageTemp: row.storageTemp || '4°C',
          quantity: parseFloat(row.quantity) || 0,
          unit: row.unit || 'mL',
          minThreshold: parseFloat(row.minThreshold) || 5,
          expiryDate: row.expiryDate || '',
          hazard: row.hazard || 'Safe / Non-toxic',
          labId: currentOrg.id,
          importedVia: 'bulk_spreadsheet',
          createdAt: serverTimestamp()
        });
        completed++;
        setImportProgress(Math.round((completed / validRows.length) * 100));
      }

      playSuccessChime();
      showToast(`Successfully imported ${validRows.length} reagents into ${currentOrg.name || 'Lab Core'}`, {
        type: 'success',
        icon: '🧪'
      });
      onClose();
    } catch (err) {
      console.error('Batch import failed:', err);
      setErrorMsg(`Firestore write error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          maxWidth: '920px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              📊
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Bulk Reagent & Cold-Chain Inventory Importer
              </h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Import spreadsheet manifests (.csv, .xlsx, .xls) directly into {currentOrg?.name || 'Active Lab'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: '#64748b',
              fontWeight: '700'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Dropzone & Sample Template Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', marginBottom: '20px' }}>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>📄</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                {file ? file.name : 'Click to select or drag & drop spreadsheet'}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Accepts Excel (.xlsx, .xls) or Comma-Separated Values (.csv)
              </span>
            </div>

            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '8px',
                maxWidth: '260px'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af' }}>
                Need a formatted wet-lab template?
              </div>
              <span style={{ fontSize: '11px', color: '#3b82f6', lineHeight: '1.4' }}>
                Download our GLP-ready template with auto-mapped CAS, Lot, and Temperature columns.
              </span>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'center'
                }}
              >
                <span>📥 Download Sample CSV</span>
              </button>
            </div>
          </div>

          {/* Error Callout */}
          {errorMsg && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                marginBottom: '16px'
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Live Preview Section */}
          {parsedRows.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Preview Parsed Reagents ({parsedRows.length} rows)</span>
                  <span
                    style={{
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      padding: '1px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}
                  >
                    ✓ {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span
                      style={{
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        padding: '1px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: '700'
                      }}
                    >
                      ⚠ {invalidCount} Needs Attention
                    </span>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '8px 10px' }}>#</th>
                      <th style={{ padding: '8px 10px' }}>Chemical Name</th>
                      <th style={{ padding: '8px 10px' }}>CAS #</th>
                      <th style={{ padding: '8px 10px' }}>Catalog #</th>
                      <th style={{ padding: '8px 10px' }}>Stock Qty</th>
                      <th style={{ padding: '8px 10px' }}>Storage</th>
                      <th style={{ padding: '8px 10px' }}>Expiry</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: r.isValid ? '#ffffff' : '#fff1f2'
                        }}
                      >
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{i + 1}</td>
                        <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0f172a' }}>
                          {r.name || <span style={{ color: '#dc2626', fontStyle: 'italic' }}>Missing</span>}
                        </td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{r.cas || '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{r.catalogNumber || '—'}</td>
                        <td style={{ padding: '7px 10px', fontWeight: '600' }}>
                          {r.quantity !== '' ? `${r.quantity} ${r.unit}` : <span style={{ color: '#dc2626' }}>Missing</span>}
                        </td>
                        <td style={{ padding: '7px 10px' }}>{r.storageTemp}</td>
                        <td style={{ padding: '7px 10px' }}>{r.expiryDate || '—'}</td>
                        <td style={{ padding: '7px 10px' }}>
                          {r.isValid ? (
                            <span style={{ color: '#059669', fontWeight: '700' }}>✓ Ready</span>
                          ) : (
                            <span style={{ color: '#dc2626', fontWeight: '700' }}>⚠ {r.validationError}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Bar during Firestore write */}
          {isImporting && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: '#059669' }}>
                <span>Writing reagents to Firestore...</span>
                <span>{importProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${importProgress}%`,
                    height: '100%',
                    background: '#059669',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {validCount > 0 ? `Ready to import ${validCount} valid chemicals to "${currentOrg?.name || 'Lab Core'}"` : 'Upload a spreadsheet to preview'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                color: '#475569'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBatchImport}
              disabled={validCount === 0 || isImporting || isProcessing}
              style={{
                background: validCount > 0 && !isImporting ? '#059669' : '#cbd5e1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: validCount > 0 && !isImporting ? 'pointer' : 'not-allowed',
                boxShadow: validCount > 0 ? '0 2px 6px rgba(5, 150, 105, 0.3)' : 'none'
              }}
            >
              {isImporting ? `Importing (${importProgress}%)...` : `Import ${validCount} Reagents →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

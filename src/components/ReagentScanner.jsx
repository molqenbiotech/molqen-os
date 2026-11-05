import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function ReagentScanner({ currentOrg, user, onClose }) {
  const [scanResult, setScanResult] = useState(null);
  const [scannedReagent, setScannedReagent] = useState(null);
  const [loadingReagent, setLoadingReagent] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('1');
  const [statusMsg, setStatusMsg] = useState('');
  const scannerRef = useRef(null);

  const fetchScannedReagent = async (reagentId) => {
    setLoadingReagent(true);
    setStatusMsg('');
    try {
      const snap = await getDoc(doc(db, 'reagents', reagentId));
      if (snap.exists()) {
        setScannedReagent({ id: snap.id, ...snap.data() });
      } else {
        setStatusMsg('⚠️ No chemical found matching this QR code.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setStatusMsg('Error fetching reagent: ' + err.message);
    } finally {
      setLoadingReagent(false);
    }
  };

  useEffect(() => {
    // Initialize html5-qrcode scanner
    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 220, height: 220 } },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        setScanResult(decodedText);
        scanner.clear();
        await fetchScannedReagent(decodedText);
      },
      () => {
        // Continuous scan error callback (silenced for clean UI)
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  const handleStockUpdate = async (isDeduct) => {
    if (!scannedReagent) return;
    const delta = parseFloat(adjustAmount) || 0;
    const currentQty = scannedReagent.quantity || 0;
    const nextQty = isDeduct ? Math.max(0, currentQty - delta) : currentQty + delta;

    try {
      // 1. Update reagent quantity
      await updateDoc(doc(db, 'reagents', scannedReagent.id), {
        quantity: nextQty
      });

      // 2. Log to audit trail
      await addDoc(collection(db, 'audit_trail'), {
        action: isDeduct ? 'STOCK_DEDUCT' : 'STOCK_ADD',
        reagentName: scannedReagent.name,
        delta: isDeduct ? -delta : delta,
        unit: scannedReagent.unit || 'units',
        remaining: nextQty,
        user: user?.displayName || user?.email || 'Researcher',
        labId: currentOrg?.id || 'General',
        timestamp: serverTimestamp()
      });

      setScannedReagent(prev => ({ ...prev, quantity: nextQty }));
      setStatusMsg(`✓ Stock updated to ${nextQty} ${scannedReagent.unit || 'units'}. Logged to audit trail.`);
    } catch (err) {
      console.error('Stock adjustment error:', err);
      setStatusMsg('Failed to update stock: ' + err.message);
    }
  };

  const restartScanner = () => {
    setScanResult(null);
    setScannedReagent(null);
    setStatusMsg('');
    if (scannerRef.current) {
      scannerRef.current.render(
        async (decodedText) => {
          setScanResult(decodedText);
          scannerRef.current.clear();
          await fetchScannedReagent(decodedText);
        },
        () => {}
      );
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '480px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              📷 Reagent Barcode & QR Scanner
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Align the reagent bottle QR label within the frame</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {/* Camera Scanner Viewport */}
        {!scanResult && (
          <div style={{ overflow: 'hidden', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#000000' }}>
            <div id="reader" style={{ width: '100%' }}></div>
          </div>
        )}

        {/* Loading Indicator */}
        {loadingReagent && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#059669', fontSize: '13px', fontWeight: '600' }}>
            Fetching chemical record from cloud...
          </div>
        )}

        {/* Reagent Found / Action Card */}
        {scannedReagent && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  {scannedReagent.name}
                </h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  CAS: {scannedReagent.cas || 'N/A'} • Storage: {scannedReagent.storageTemp}
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '4px',
                background: scannedReagent.quantity <= scannedReagent.minThreshold ? '#fee2e2' : '#dcfce7',
                color: scannedReagent.quantity <= scannedReagent.minThreshold ? '#dc2626' : '#15803d'
              }}>
                Current: {scannedReagent.quantity} {scannedReagent.unit || 'mL'}
              </span>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min="0.1"
                step="any"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                style={{ width: '90px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', textAlign: 'center' }}
              />
              <button
                onClick={() => handleStockUpdate(true)}
                style={{ flex: 1, background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '9px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                - Deduct Stock
              </button>
              <button
                onClick={() => handleStockUpdate(false)}
                style={{ flex: 1, background: '#059669', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '9px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                + Restock
              </button>
            </div>

            {statusMsg && (
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#059669', fontWeight: '600', textAlign: 'center' }}>
                {statusMsg}
              </div>
            )}

            <button
              onClick={restartScanner}
              style={{ width: '100%', marginTop: '12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}
            >
              🔄 Scan Another Bottle
            </button>
          </div>
        )}

        {statusMsg && !scannedReagent && (
          <div style={{ marginTop: '14px', padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '12px', textAlign: 'center' }}>
            {statusMsg}
            <button onClick={restartScanner} style={{ display: 'block', margin: '8px auto 0 auto', background: 'transparent', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px' }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
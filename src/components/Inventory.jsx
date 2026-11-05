import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import ReagentScanner from './ReagentScanner';
import { playTactileClick, playSuccessChime } from '../utils/audioFeedback';
import { showToast } from '../utils/toast';

export default function Inventory({ currentOrg, user }) {
  const [reagents, setReagents] = useState([]);
  const [filter, setFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    cas: '',
    storageTemp: '4°C',
    quantity: '',
    unit: 'mL',
    minThreshold: '5',
    expiryDate: '',
    hazard: 'None'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedQRReagent, setSelectedQRReagent] = useState(null);

  useEffect(() => {
    if (!currentOrg?.id) return;
    const q = query(collection(db, 'reagents'), where('labId', '==', currentOrg.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setReagents(items);
    });
    return () => unsubscribe();
  }, [currentOrg?.id]);

  // Safety rule: Warn if storing Oxidizers and Flammables together
  const checkSafetySegregation = (newHazard) => {
    if (newHazard === 'Flammable') {
      const hasOxidizers = reagents.some(r => r.hazard === 'Oxidizer');
      if (hasOxidizers) {
        alert("⚠️ GLP Safety Segregation Warning: Your inventory already contains Oxidizers. Flammable solvents must be stored in dedicated yellow safety flammables cabinets, isolated from oxidizers.");
      }
    } else if (newHazard === 'Oxidizer') {
      const hasFlammables = reagents.some(r => r.hazard === 'Flammable');
      if (hasFlammables) {
        alert("⚠️ GLP Safety Segregation Warning: Your inventory contains Flammable reagents. Oxidizers must be isolated to prevent runaway exothermic reactions.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.quantity) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'reagents'), {
        ...formData,
        quantity: parseFloat(formData.quantity) || 0,
        minThreshold: parseFloat(formData.minThreshold) || 0,
        labId: currentOrg.id,
        createdAt: serverTimestamp()
      });
      playSuccessChime();
      showToast(`Registered "${formData.name}" in chemical inventory`, { type: 'success', icon: '🧪' });
      setFormData({
        name: '',
        cas: '',
        storageTemp: '4°C',
        quantity: '',
        unit: 'mL',
        minThreshold: '5',
        expiryDate: '',
        hazard: 'None'
      });
    } catch (err) {
      console.error("Failed to add reagent:", err);
      showToast('Failed to register chemical', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustQuantity = async (id, delta, currentVal, itemName, unit) => {
    const newVal = Math.max(0, (currentVal || 0) + delta);
    playTactileClick();
    try {
      await updateDoc(doc(db, 'reagents', id), { quantity: newVal });
      showToast(`Adjusted ${itemName || 'reagent'}: ${newVal} ${unit || ''}`, { type: 'info', icon: '⚖️' });
    } catch (err) {
      console.error("Quantity adjust error:", err);
    }
  };

  const handleDelete = async (id, itemName) => {
    if (window.confirm(`Remove "${itemName || 'this chemical'}" from the inventory?`)) {
      playTactileClick();
      try {
        await deleteDoc(doc(db, 'reagents', id));
        showToast(`Removed "${itemName || 'chemical'}" from registry`, { type: 'info', icon: '🗑️' });
      } catch (err) {
        console.error("Delete reagent error:", err);
      }
    }
  };

  const filteredReagents = reagents.filter(r => 
    r.name?.toLowerCase().includes(filter.toLowerCase()) || 
    r.cas?.toLowerCase().includes(filter.toLowerCase())
  );

  const [now] = useState(() => Date.now());
  const thirtyDaysAhead = now + 30 * 24 * 60 * 60 * 1000;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      {/* Header bar with Search and Optical Barcode/QR Scanner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
            Chemical & Reagent Management
          </h2>
          <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
            Active Core: <strong style={{ color: '#2d6a4f' }}>{currentOrg?.name || 'General Core'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search chemical or CAS #..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              border: '1px solid #ced4da',
              borderRadius: '8px',
              fontSize: '13px',
              width: '240px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            style={{
              background: '#2d6a4f',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(45, 106, 79, 0.2)'
            }}
          >
            📷 Scan Bottle
          </button>
        </div>
      </div>

      {/* Add Reagent Form */}
      <form onSubmit={handleSubmit} style={{
        background: '#ffffff',
        border: '1px solid #ced4da',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '26px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
        alignItems: 'end'
      }}>
        <div>
          <label style={labelStyle}>Chemical Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Sodium Hydroxide"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>CAS Number</label>
          <input
            type="text"
            placeholder="e.g. 1310-73-2"
            value={formData.cas}
            onChange={(e) => setFormData({ ...formData, cas: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Storage Temp</label>
          <select
            value={formData.storageTemp}
            onChange={(e) => setFormData({ ...formData, storageTemp: e.target.value })}
            style={inputStyle}
          >
            <option value="Room Temp (20-25°C)">RT (20-25°C)</option>
            <option value="4°C">4°C (Cold Room)</option>
            <option value="-20°C">-20°C (Freezer)</option>
            <option value="-80°C">-80°C (Ultra-Low)</option>
            <option value="Liquid N2">Liquid N2</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Qty & Unit *</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="number"
              step="any"
              required
              placeholder="500"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              style={{ ...inputStyle, width: '65%' }}
            />
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              style={{ ...inputStyle, width: '35%', padding: '7px 4px' }}
            >
              <option value="mL">mL</option>
              <option value="L">L</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="vials">vials</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Alert Below</label>
          <input
            type="number"
            placeholder="Min qty"
            value={formData.minThreshold}
            onChange={(e) => setFormData({ ...formData, minThreshold: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Expiry Date</label>
          <input
            type="date"
            value={formData.expiryDate}
            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Hazard Class</label>
          <select
            value={formData.hazard}
            onChange={(e) => {
              setFormData({ ...formData, hazard: e.target.value });
              checkSafetySegregation(e.target.value);
            }}
            style={inputStyle}
          >
            <option value="None">Safe / Non-toxic</option>
            <option value="Flammable">Flammable 🔥</option>
            <option value="Oxidizer">Oxidizer ⚡</option>
            <option value="Corrosive">Corrosive ⚠️</option>
            <option value="Biohazard">Biohazard ☣️</option>
            <option value="Toxic">Toxic ☠️</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            background: '#2d6a4f',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '9px 14px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            height: '36px'
          }}
        >
          {isSubmitting ? 'Adding...' : '+ Add Reagent'}
        </button>
      </form>

      {/* Reagents Table */}
      <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e9ecef', color: '#6c757d' }}>
              <th style={thStyle}>Chemical & SDS</th>
              <th style={thStyle}>CAS Number</th>
              <th style={thStyle}>Storage</th>
              <th style={thStyle}>Stock Level</th>
              <th style={thStyle}>Safety Badge</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Adjust Stock</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredReagents.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: '#adb5bd' }}>
                  No reagents recorded. Add standard laboratory chemicals above!
                </td>
              </tr>
            ) : (
              filteredReagents.map((item) => {
                const isLow = item.quantity <= item.minThreshold;
                const isExpiringSoon = item.expiryDate && new Date(item.expiryDate).getTime() <= thirtyDaysAhead;

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <strong style={{ color: '#1b4332' }}>{item.name}</strong>
                        <a
                          href={`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(item.cas || item.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: '10px',
                            color: '#1d3557',
                            background: '#e7f5ff',
                            border: '1px solid #d0ebff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            marginLeft: '8px',
                            fontWeight: '600'
                          }}
                          title="Open official PubChem Safety Data Sheet (SDS)"
                        >
                          📄 SDS
                        </a>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: '#6c757d', fontFamily: 'monospace' }}>
                      {item.cas || '—'}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          background:
                            item.storageTemp?.includes('-80')
                              ? '#F3E8FF'
                              : item.storageTemp?.includes('-20')
                              ? '#ECFEFF'
                              : item.storageTemp?.includes('4')
                              ? '#ECFDF5'
                              : '#F1F5F9',
                          color:
                            item.storageTemp?.includes('-80')
                              ? '#6B21A8'
                              : item.storageTemp?.includes('-20')
                              ? '#0E7490'
                              : item.storageTemp?.includes('4')
                              ? '#047857'
                              : '#475569',
                          border: `1px solid ${
                            item.storageTemp?.includes('-80')
                              ? '#E9D5FF'
                              : item.storageTemp?.includes('-20')
                              ? '#CFFAFE'
                              : item.storageTemp?.includes('4')
                              ? '#A7F3D0'
                              : '#E2E8F0'
                          }`,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background:
                              item.storageTemp?.includes('-80')
                                ? '#9333EA'
                                : item.storageTemp?.includes('-20')
                                ? '#06B6D4'
                                : item.storageTemp?.includes('4')
                                ? '#10B981'
                                : '#64748B'
                          }}
                        />
                        {item.storageTemp}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <strong style={{ color: isLow ? '#e03131' : '#212529' }}>
                        {item.quantity} {item.unit}
                      </strong>
                    </td>
                    <td style={tdStyle}>
                      {item.hazard !== 'None' ? (
                        <span style={{
                          background: item.hazard === 'Flammable' ? '#fff5f5' : item.hazard === 'Oxidizer' ? '#fff9db' : '#f8f9fa',
                          color: item.hazard === 'Flammable' ? '#e03131' : item.hazard === 'Oxidizer' ? '#d9480f' : '#334155',
                          border: `1px solid ${item.hazard === 'Flammable' ? '#ffc9c9' : item.hazard === 'Oxidizer' ? '#ffe066' : '#ced4da'}`,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {item.hazard}
                        </span>
                      ) : (
                        <span style={{ color: '#adb5bd', fontSize: '12px' }}>General</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {isLow ? (
                        <span style={{ color: '#e03131', fontWeight: '700', fontSize: '11px' }}>⚠️ Restock Needed</span>
                      ) : isExpiringSoon ? (
                        <span style={{ color: '#e67700', fontWeight: '700', fontSize: '11px' }}>⏳ Expiry Near</span>
                      ) : (
                        <span style={{ color: '#2d6a4f', fontSize: '11px', fontWeight: '700' }}>✓ In Stock</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleAdjustQuantity(item.id, -1, item.quantity, item.name, item.unit)}
                        style={adjustBtnStyle}
                        title="Use 1 unit"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustQuantity(item.id, 1, item.quantity, item.name, item.unit)}
                        style={adjustBtnStyle}
                        title="Add 1 unit"
                      >
                        +1
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQRReagent(item);
                          playTactileClick();
                        }}
                        style={{ ...adjustBtnStyle, color: '#2d6a4f', borderColor: '#b2f2bb' }}
                        title="Generate Printable Bottle QR Sticker"
                      >
                        🏷️ QR
                      </button>

                      {/* Permission Guard: Only allow the teacher/lab creator to delete chemicals */}
                      {user?.email === currentOrg?.createdBy && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.name)}
                          style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '14px', marginLeft: '6px' }}
                          title="Delete reagent"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Camera Barcode/QR Scanner Modal */}
      {showScanner && (
        <ReagentScanner
          currentOrg={currentOrg}
          user={user}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Printable QR Bottle Label Modal */}
      {selectedQRReagent && (
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
          zIndex: 10000,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: '0 20px 30px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1b4332' }}>{selectedQRReagent.name}</h3>
            <span style={{ fontSize: '11px', color: '#6c757d' }}>CAS: {selectedQRReagent.cas || 'N/A'} • {selectedQRReagent.storageTemp}</span>

            <div style={{ margin: '20px auto', padding: '16px', background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '10px', display: 'inline-block' }}>
              <QRCodeSVG value={selectedQRReagent.id} size={160} level="H" includeMargin={true} />
              <div style={{ fontSize: '10px', color: '#adb5bd', fontFamily: 'monospace', marginTop: '6px' }}>
                ID: {selectedQRReagent.id}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  const printWin = window.open('', '_blank');
                  printWin.document.write(`
                    <html>
                      <head><title>Bottle Label - ${selectedQRReagent.name}</title></head>
                      <body style="font-family: sans-serif; text-align: center; padding: 20px;">
                        <h2 style="margin: 0; font-size: 14px;">${selectedQRReagent.name}</h2>
                        <div style="font-size: 10px; color: #555;">CAS: ${selectedQRReagent.cas || 'N/A'} | ${selectedQRReagent.storageTemp}</div>
                        <div style="margin-top: 10px;">${document.querySelector('svg')?.outerHTML || ''}</div>
                        <script>window.print();</script>
                      </body>
                    </html>
                  `);
                  printWin.document.close();
                }}
                style={{ flex: 1, background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                🖨️ Print Label Sticker
              </button>
              <button
                type="button"
                onClick={() => setSelectedQRReagent(null)}
                style={{ flex: 1, background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '6px', padding: '8px', fontSize: '12px', color: '#495057', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none', background: '#ffffff', boxSizing: 'border-box' };
const thStyle = { padding: '12px 16px', fontWeight: '600', fontSize: '12px' };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };
const adjustBtnStyle = { background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '4px', padding: '3px 8px', margin: '0 3px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' };
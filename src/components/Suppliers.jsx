import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

export default function Suppliers({ currentOrg }) {
  const [vendors, setVendors] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [selectedReagentForPO, setSelectedReagentForPO] = useState('');
  const [orderQty, setOrderQty] = useState('2 Packs');

  const [form, setForm] = useState({
    company: '',
    category: 'Fine Chemicals & Media',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: ''
  });

  useEffect(() => {
    if (!currentOrg?.id) return;

    // 1. Fetch Vendors
    const qVendors = query(collection(db, 'suppliers'), where('labId', '==', currentOrg.id));
    const unsubVendors = onSnapshot(qVendors, (snap) => {
      setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Fetch Low-Stock Reagents for Quick Reordering
    const qReagents = query(collection(db, 'reagents'), where('labId', '==', currentOrg.id));
    const unsubReagents = onSnapshot(qReagents, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const low = all.filter(r => (r.quantity || 0) <= (r.minThreshold || 5));
      setLowStockItems(low.length > 0 ? low : all);
      if (low.length > 0) {
        setSelectedReagentForPO(prev => prev || `${low[0].name} (CAS: ${low[0].cas || 'N/A'})`);
      }
    });

    return () => {
      unsubVendors();
      unsubReagents();
    };
  }, [currentOrg?.id]);

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!form.company.trim()) return;
    try {
      await addDoc(collection(db, 'suppliers'), {
        ...form,
        labId: currentOrg.id,
        createdAt: serverTimestamp()
      });
      setForm({ company: '', category: 'Fine Chemicals & Media', contactPerson: '', phone: '', email: '', gstin: '' });
    } catch (err) {
      console.error('Add vendor error:', err);
    }
  };

  // Generate 1-Click WhatsApp Quotation Request
  const sendWhatsAppPO = (vendor) => {
    const cleanPhone = (vendor.phone || '').replace(/[^0-9]/g, '');
    const itemText = selectedReagentForPO || 'Laboratory Reagents';
    const msg = `Hello ${vendor.contactPerson || vendor.company},\n\nWe would like to request an official quotation / purchase order for *${currentOrg?.name || 'our research laboratory'}*:\n\n• *Item:* ${itemText}\n• *Required Quantity:* ${orderQty}\n• *Delivery:* Priority Cold-Chain / Standard Lab Dispatch\n\nPlease share proforma invoice and lead time.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Generate 1-Click Email Quotation Request
  const sendEmailPO = (vendor) => {
    const itemText = selectedReagentForPO || 'Laboratory Reagents';
    const subject = `Quotation Request [${currentOrg?.name || 'Research Lab'}]: ${itemText}`;
    const body = `Dear ${vendor.contactPerson || vendor.company},\n\nPlease provide your best institutional quotation and availability for:\n\nItem: ${itemText}\nQuantity: ${orderQty}\nLab Workspace: ${currentOrg?.name || 'Academic Lab'}\n\nThank you.`;
    window.location.href = `mailto:${vendor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
          Vendor CRM & Automated Low-Stock Reordering
        </h2>
        <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
          Manage approved chemical distributors, GSTIN compliance, and 1-click WhatsApp / Email purchase orders
        </p>
      </div>

      {/* Quick Reorder Item Selector Bar */}
      <div style={{ background: '#e8f5e9', border: '1px solid #b2f2bb', borderRadius: '12px', padding: '14px 18px', marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📦</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1b4332' }}>
              Active Purchase Order Builder
            </div>
            <span style={{ fontSize: '11px', color: '#2d6a4f' }}>
              Select a low-stock reagent below, then click "WhatsApp PO" or "Email Quote" on any vendor row
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={selectedReagentForPO}
            onChange={(e) => setSelectedReagentForPO(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #52b788', borderRadius: '6px', fontSize: '12px', background: '#ffffff', minWidth: '240px' }}
          >
            <option value="">-- Select Chemical to Reorder --</option>
            {lowStockItems.map(r => (
              <option key={r.id} value={`${r.name} (CAS: ${r.cas || 'N/A'})`}>
                {r.name} (Stock: {r.quantity} {r.unit})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Order Qty (e.g. 2 x 500mL)"
            value={orderQty}
            onChange={(e) => setOrderQty(e.target.value)}
            style={{ width: '140px', padding: '7px 10px', border: '1px solid #52b788', borderRadius: '6px', fontSize: '12px', background: '#ffffff' }}
          />
        </div>
      </div>

      {/* Add Vendor Form */}
      <form
        onSubmit={handleAddVendor}
        style={{
          background: '#ffffff',
          border: '1px solid #ced4da',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          alignItems: 'end'
        }}
      >
        <div>
          <label style={labelStyle}>Supplier / Distributor *</label>
          <input type="text" required placeholder="e.g. HiMedia / Sigma-Aldrich" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Supply Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            <option value="Fine Chemicals & Media">Chemicals & Media</option>
            <option value="Molecular Biology & Primers">Primers & Enzymes</option>
            <option value="Plasticware & Glassware">Plasticware & Tips</option>
            <option value="Analytical Instruments">Instruments & Service</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Sales Rep Name</label>
          <input type="text" placeholder="e.g. Rajesh Sharma" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>WhatsApp Phone (with country code)</label>
          <input type="text" placeholder="e.g. 919876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Rep Email</label>
          <input type="email" placeholder="quotes@supplier.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>GSTIN / Tax ID</label>
          <input type="text" placeholder="19AAACH7409R1ZR" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} style={inputStyle} />
        </div>
        <button
          type="submit"
          style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '9px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', height: '35px' }}
        >
          + Add Supplier
        </button>
      </form>

      {/* Vendors Table */}
      <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e9ecef', color: '#6c757d' }}>
              <th style={thStyle}>Distributor</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Representative</th>
              <th style={thStyle}>GSTIN</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>1-Click Reorder Dispatch</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#adb5bd' }}>
                  No suppliers added yet. Register your chemical & plasticware reps above.
                </td>
              </tr>
            ) : (
              vendors.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                  <td style={{ ...tdStyle, fontWeight: '700', color: '#1b4332' }}>{v.company}</td>
                  <td style={tdStyle}>
                    <span style={{ background: '#f8faf9', border: '1px solid #e9ecef', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>
                      {v.category}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div>{v.contactPerson || '—'}</div>
                    <span style={{ fontSize: '11px', color: '#6c757d' }}>{v.phone}</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px', color: '#495057' }}>
                    {v.gstin || '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => sendWhatsAppPO(v)}
                      style={{ background: '#d8f3dc', color: '#1b4332', border: '1px solid #b2f2bb', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', marginRight: '6px' }}
                    >
                      💬 WhatsApp PO
                    </button>
                    {v.email && (
                      <button
                        type="button"
                        onClick={() => sendEmailPO(v)}
                        style={{ background: '#e7f5ff', color: '#1864ab', border: '1px solid #d0ebff', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', marginRight: '6px' }}
                      >
                        ✉️ Email Quote
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteDoc(doc(db, 'suppliers', v.id))}
                      style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' };
const thStyle = { padding: '12px 16px', fontWeight: '600', fontSize: '12px' };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };
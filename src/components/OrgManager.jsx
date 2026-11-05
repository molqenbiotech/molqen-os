import * as React from 'react';
import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function OrgManager({ user, currentOrg, orgs, onSelectOrg, onOrgCreated }) {
  const [showModal, setShowModal] = useState(false);
  const [labName, setLabName] = useState('');
  const [institution, setInstitution] = useState('');

  // Generate a random 6-character lab access code
  const generateCode = () => {
    return 'LAB-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  };

  const handleCreateLab = async (e) => {
    e.preventDefault();
    if (!labName.trim()) return;

    const code = generateCode();
    const orgId = labName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4);

    const newOrgData = {
      id: orgId,
      name: labName.trim(),
      institution: institution.trim() || 'Independent Lab Core',
      inviteCode: code,
      createdBy: user.email,
      createdByName: user.displayName || 'Lab Founder',
      members: [user.email],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'organizations', orgId), newOrgData);
      onOrgCreated(newOrgData);
      onSelectOrg(newOrgData);
      setLabName('');
      setInstitution('');
      setShowModal(false);
    } catch (err) {
      console.error("Error creating organization:", err);
      alert("Failed to create lab group. Ensure Firestore rules are in test mode.");
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* Active Lab Selector */}
      <select
        value={currentOrg?.id || ''}
        onChange={(e) => {
          const selected = orgs.find(o => o.id === e.target.value);
          if (selected) onSelectOrg(selected);
        }}
        style={{
          background: '#1e293b',
          color: '#38bdf8',
          border: '1px solid #334155',
          padding: '6px 12px',
          borderRadius: '6px',
          fontWeight: '600',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            🏛️ {org.name} ({org.inviteCode})
          </option>
        ))}
      </select>

      {/* Button to Launch New Lab Modal */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          background: '#047857',
          color: '#ffffff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        + Create Lab
      </button>

      {/* Modal Popup */}
      {showModal && (
        <div style={modalBackdropStyle}>
          <div style={modalBoxStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>Establish New Laboratory Group</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
              Create a shared digital environment where colleagues in your department can collectively monitor stocks, instruments, and papers.
            </p>

            <form onSubmit={handleCreateLab} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>Lab / Research Group Name</label>
                <input
                  placeholder="e.g. Molecular Systems & Bioprocess Lab"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>University / Institute</label>
                <input
                  placeholder="e.g. Amity University / CSIR-IICB"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '8px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '8px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Confirm & Initialize Lab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  boxSizing: 'border-box',
  fontSize: '13px'
};

const modalBackdropStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(15, 23, 42, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalBoxStyle = {
  background: '#ffffff',
  padding: '24px',
  borderRadius: '8px',
  width: '420px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
};
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function TeamManager({ currentLab, user }) {
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);

  const isTeacher = currentLab?.createdBy === user?.email;

  useEffect(() => {
    if (!currentLab?.id) return;
    const q = query(collection(db, 'lab_members'), where('labId', '==', currentLab.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [currentLab?.id]);

  const handleApprove = async (memberId) => {
    await updateDoc(doc(db, 'lab_members', memberId), { status: 'active' });
  };

  const handleToggleRole = async (member) => {
    const nextRole = member.role === 'teacher' ? 'student' : 'teacher';
    await updateDoc(doc(db, 'lab_members', member.id), { role: nextRole });
  };

  const handleRemove = async (memberId) => {
    if (window.confirm('Remove this member from the laboratory workspace?')) {
      await deleteDoc(doc(db, 'lab_members', memberId));
    }
  };

  const joinCode = currentLab?.joinCode || 'LAB-' + (currentLab?.id?.slice(0, 3).toUpperCase() || '101');

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
            Lab Personnel & Roster Administration
          </h2>
          <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
            Authority, join codes, and role permissions for <strong style={{ color: '#2d6a4f' }}>{currentLab?.name || 'Academic Lab'}</strong>
          </p>
        </div>

        <span style={{
          background: isTeacher ? '#d8f3dc' : '#e7f5ff',
          color: isTeacher ? '#1b4332' : '#1864ab',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '700'
        }}>
          {isTeacher ? '🎓 Role: Faculty / Principal Investigator' : '🔬 Role: Student Researcher'}
        </span>
      </div>

      {/* Shareable Student Join Code Banner */}
      <div style={{ background: '#ffffff', border: '1px solid #b2f2bb', borderRadius: '12px', padding: '16px 20px', marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1b4332' }}>
            🔑 Student & Intern 6-Character Lab Join Code
          </div>
          <span style={{ fontSize: '11px', color: '#6c757d' }}>
            Share this code with students so they can request admission via "+ Switch / Add Lab"
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: '800', background: '#e8f5e9', color: '#1b4332', padding: '6px 14px', borderRadius: '8px', border: '1px solid #52b788', letterSpacing: '1px' }}>
            {joinCode}
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(joinCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            {copied ? '✓ Copied!' : '📋 Copy Code'}
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e9ecef', fontWeight: '700', fontSize: '13px', color: '#1b4332' }}>
          Enrolled Laboratory Members ({members.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e9ecef', color: '#6c757d' }}>
              <th style={thStyle}>Member Name</th>
              <th style={thStyle}>Institutional Email</th>
              <th style={thStyle}>Designated Role</th>
              <th style={thStyle}>Admission Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Faculty Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#adb5bd' }}>
                  No additional members enrolled yet. Share your Join Code above to invite interns and students.
                </td>
              </tr>
            ) : (
              members.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                  <td style={{ ...tdStyle, fontWeight: '700', color: '#212529' }}>{m.displayName}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px', color: '#495057' }}>{m.email}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: m.role === 'teacher' ? '#d8f3dc' : '#f1f3f5',
                      color: m.role === 'teacher' ? '#1b4332' : '#495057',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {m.role === 'teacher' ? '🎓 Faculty / PI' : '🔬 Student Intern'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: m.status === 'pending' ? '#fff9db' : '#ebfbee',
                      color: m.status === 'pending' ? '#e67700' : '#2b8a3e',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {m.status === 'pending' ? '⏳ Pending Approval' : '● Active'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {isTeacher && m.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(m.id)}
                        style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', marginRight: '6px' }}
                      >
                        ✓ Approve
                      </button>
                    )}
                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => handleToggleRole(m)}
                        style={{ background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', marginRight: '6px' }}
                      >
                        Switch Role
                      </button>
                    )}
                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => handleRemove(m.id)}
                        style={{ background: 'transparent', border: 'none', color: '#e03131', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ✕
                      </button>
                    )}
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

const thStyle = { padding: '12px 16px', fontWeight: '600', fontSize: '12px' };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };
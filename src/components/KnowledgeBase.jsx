import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export default function KnowledgeBase({ currentOrg, user, isPrivateSandbox }) {
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('SOP / Protocol');
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState({});
  const [publishSuccessMsg, setPublishSuccessMsg] = useState('');

  // 1. Live Sync: Private Sandbox (users/{uid}/sandbox_sops) vs Official Core (knowledge_base)
  useEffect(() => {
    let unsubscribe = () => {};

    if (isPrivateSandbox) {
      if (!user?.uid) return;
      // Private Sandbox Collection for this authenticated student
      const userSandboxRef = collection(db, 'users', user.uid, 'sandbox_sops');
      unsubscribe = onSnapshot(userSandboxRef, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setArticles(docs);
      }, (err) => {
        console.error("Private SOPs sync error:", err);
      });
    } else {
      if (!currentOrg?.id) return;
      // Official Shared Lab Repository
      const q = query(collection(db, 'knowledge_base'), where('labId', '==', currentOrg.id));
      unsubscribe = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setArticles(docs);
      }, (err) => {
        console.error("Shared SOPs sync error:", err);
      });
    }

    return () => unsubscribe();
  }, [isPrivateSandbox, user?.uid, currentOrg?.id]);

  // 2. Save SOP (Private Sandbox vs Shared Lab Core)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      if (isPrivateSandbox) {
        // Save to private user sandbox
        await addDoc(collection(db, 'users', user.uid, 'sandbox_sops'), {
          title: title.trim(),
          category,
          content: content.trim(),
          author: user.displayName || user.email.split('@')[0],
          authorUid: user.uid,
          isPublished: false,
          publishedAt: null,
          createdAt: serverTimestamp()
        });
      } else {
        // Save to official shared lab knowledge base
        await addDoc(collection(db, 'knowledge_base'), {
          labId: currentOrg.id,
          title: title.trim(),
          category,
          content: content.trim(),
          author: user.displayName || user.email.split('@')[0],
          authorUid: user.uid,
          isPublished: true,
          publishedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }

      setTitle('');
      setContent('');
    } catch (err) {
      console.error("Error saving SOP:", err);
      alert("Failed to save SOP: " + err.message);
    }
  };

  // 3. Controlled Publishing Workflow: "🚀 Publish to Lab Core"
  const handlePublishToLab = async (item) => {
    if (!currentOrg?.id) {
      alert("Please select an active Lab Core to publish this SOP.");
      return;
    }

    const confirmPublish = window.confirm(
      `Publish "${item.title}" to "${currentOrg.name}" official knowledge base?\n\nThis will make your SOP visible to all lab members while keeping your editable sandbox draft intact.`
    );
    if (!confirmPublish) return;

    setIsPublishing(prev => ({ ...prev, [item.id]: true }));
    try {
      // Step A: Publish a verified copy to official lab repository
      await addDoc(collection(db, 'knowledge_base'), {
        labId: currentOrg.id,
        title: item.title,
        category: item.category,
        content: item.content,
        author: user.displayName || user.email.split('@')[0],
        authorUid: user.uid,
        isPublished: true,
        sourceDraftId: item.id,
        publishedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Step B: Mark private sandbox draft as published
      const privateDocRef = doc(db, 'users', user.uid, 'sandbox_sops', item.id);
      await updateDoc(privateDocRef, {
        isPublished: true,
        publishedAt: serverTimestamp(),
        publishedLabId: currentOrg.id,
        publishedLabName: currentOrg.name
      });

      setPublishSuccessMsg(`✓ Successfully published "${item.title}" to ${currentOrg.name}!`);
      setTimeout(() => setPublishSuccessMsg(''), 4500);
    } catch (err) {
      console.error("Publishing error:", err);
      alert("Publish failed: " + err.message);
    } finally {
      setIsPublishing(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // 4. Delete Record
  const handleDelete = async (itemId) => {
    if (isPrivateSandbox) {
      if (window.confirm("Remove this private SOP draft?")) {
        await deleteDoc(doc(db, 'users', user.uid, 'sandbox_sops', itemId));
      }
    } else {
      if (window.confirm("Remove this SOP from the shared lab vault?")) {
        await deleteDoc(doc(db, 'knowledge_base', itemId));
      }
    }
  };

  const filtered = articles.filter(a =>
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.content?.toLowerCase().includes(search.toLowerCase()) ||
    a.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      {/* Calm Status & Mode Banner */}
      <div style={{
        background: isPrivateSandbox 
          ? 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)' 
          : 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 60%, #40916c 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        color: '#ffffff',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 10px 25px -5px rgba(6, 78, 59, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: '700'
            }}>
              {isPrivateSandbox ? '🔒 PRIVATE SANDBOX' : '🏛️ OFFICIAL LAB REPOSITORY'}
            </span>
            <span style={{ fontSize: '11px', opacity: 0.85 }}>
              {isPrivateSandbox 
                ? 'Unshared Personal Bench • Completely isolated from peers' 
                : `Verified Core SOPs • ${currentOrg?.name || 'Active Lab'}`}
            </span>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
            {isPrivateSandbox ? 'Personal SOPs & Protocol Sandbox' : 'Standard Operating Procedures & Lab Vault'}
          </h1>
          <p style={{ fontSize: '13px', margin: 0, opacity: 0.9, maxWidth: '650px', lineHeight: '1.5' }}>
            {isPrivateSandbox 
              ? 'Draft personal formulations, private buffer recipes, and notes without uninvited eyes. When ready, publish single items directly to your PI.' 
              : 'Institutional laboratory standards, collective troubleshooting memory, and authorized departmental procedures.'}
          </p>
        </div>

        {/* Ambient Calming Element */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '12px',
          padding: '12px 18px',
          textAlign: 'center',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '20px', marginBottom: '2px' }}>
            {isPrivateSandbox ? '🌱' : '🌿'}
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px' }}>
            {isPrivateSandbox ? 'Private Bench' : 'Team Vault'}
          </div>
          <span style={{ fontSize: '9px', opacity: 0.8 }}>
            {articles.length} Record{articles.length !== 1 ? 's' : ''} Active
          </span>
        </div>
      </div>

      {/* Success Notification Strip */}
      {publishSuccessMsg && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '10px',
          padding: '12px 18px',
          color: '#065f46',
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <span>🚀</span>
          <span>{publishSuccessMsg}</span>
        </div>
      )}

      {/* Header Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '13px', color: '#6c757d' }}>
          {isPrivateSandbox ? (
            <span>Showing your private unshared SOP drafts</span>
          ) : (
            <span>Showing verified knowledge base documents for <strong>{currentOrg?.name}</strong></span>
          )}
        </div>

        <input
          type="text"
          placeholder="Filter by protocol, buffer, or keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '280px', padding: '8px 14px', border: '1px solid #ced4da', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        
        {/* Form Card */}
        <form onSubmit={handleSave} style={{
          background: '#ffffff',
          border: '1px solid #e9ecef',
          borderRadius: '14px',
          padding: '22px',
          alignSelf: 'start',
          boxShadow: '0 4px 15px -3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '16px' }}>{isPrivateSandbox ? '📝' : '📋'}</span>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1b4332' }}>
              {isPrivateSandbox ? '+ Draft Personal SOP' : '+ Add Official Lab SOP'}
            </h3>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>SOP / Protocol Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Optimized Gibson Assembly for 4-Fragment Insertion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="SOP / Protocol">SOP / Standard Protocol</option>
              <option value="Buffer / Media Recipe">Buffer & Media Recipe</option>
              <option value="Reaction Formulation">Reaction Formulation</option>
              <option value="Troubleshooting Tip">Wet-Lab Troubleshooting</option>
              <option value="Biosafety / GLP">Biosafety & Disposal</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Protocol Instructions & Formulations *</label>
            <textarea
              rows={7}
              required
              placeholder="Enter exact reaction volumes (µL), incubation times, step sequences, and safety notes..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
            />
          </div>

          <button
            type="submit"
            className="tactile-action-btn"
            style={{
              width: '100%',
              background: isPrivateSandbox ? '#059669' : '#2d6a4f',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {isPrivateSandbox ? 'Save to Personal Sandbox' : 'Publish to Collective Vault'}
          </button>
        </form>

        {/* SOP Cards Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.length === 0 ? (
            <div style={{
              background: '#ffffff',
              border: '1px dashed #ced4da',
              borderRadius: '14px',
              padding: '48px 24px',
              textAlign: 'center',
              color: '#adb5bd',
              fontSize: '13px'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>
                {isPrivateSandbox ? '🔒' : '🗄️'}
              </div>
              <div style={{ fontWeight: '600', color: '#6c757d', marginBottom: '4px' }}>
                {isPrivateSandbox ? 'Your Personal Sandbox is Empty' : 'No Official Lab SOPs Found'}
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#adb5bd' }}>
                {isPrivateSandbox 
                  ? 'Draft your personal SOP on the left to keep your own private formulations.' 
                  : 'SOPs approved by researchers will appear here for the entire core.'}
              </p>
            </div>
          ) : (
            filtered.map(item => (
              <div
                key={item.id}
                className="interactive-stat-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e9ecef',
                  borderRadius: '14px',
                  padding: '18px 22px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{
                        background: '#e8f5e9',
                        color: '#1b4332',
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '4px'
                      }}>
                        {item.category}
                      </span>

                      {/* Publishing Status Indicators */}
                      {isPrivateSandbox && (
                        item.isPublished ? (
                          <span style={{
                            background: '#d8f3dc',
                            color: '#2d6a4f',
                            border: '1px solid #b7e4c7',
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            ✓ Published to Lab Core
                          </span>
                        ) : (
                          <span style={{
                            background: '#f8faf9',
                            color: '#6c757d',
                            border: '1px solid #e9ecef',
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '2px 7px',
                            borderRadius: '4px'
                          }}>
                            🔒 Private Draft
                          </span>
                        )
                      )}

                      {!isPrivateSandbox && item.author && (
                        <span style={{ fontSize: '11px', color: '#6c757d' }}>
                          ✍️ <strong>{item.author}</strong>
                        </span>
                      )}
                    </div>

                    <strong style={{ fontSize: '15px', color: '#1b4332', display: 'block', marginTop: '4px' }}>
                      {item.title}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Controlled Publishing Action */}
                    {isPrivateSandbox && (
                      <button
                        type="button"
                        onClick={() => handlePublishToLab(item)}
                        disabled={isPublishing[item.id]}
                        className="tactile-action-btn"
                        style={{
                          background: item.isPublished ? '#f8faf9' : 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)',
                          color: item.isPublished ? '#2d6a4f' : '#ffffff',
                          border: item.isPublished ? '1px solid #52b788' : 'none',
                          borderRadius: '6px',
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: isPublishing[item.id] ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title={item.isPublished ? "Re-publish updated draft to Lab Core" : "Publish to official shared knowledge base"}
                      >
                        <span>{item.isPublished ? '🔄 Update Core' : '🚀 Publish to Lab'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="tactile-close-btn"
                      title="Delete SOP"
                      style={{ width: '24px', height: '24px', fontSize: '11px' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <pre style={{
                  margin: 0,
                  fontSize: '12.5px',
                  color: '#343a40',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: '1.6',
                  background: '#f8faf9',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #f1f3f5'
                }}>
                  {item.content}
                </pre>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' };

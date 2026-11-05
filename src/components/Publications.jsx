import { useState, useEffect, useRef } from 'react';
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
import mammoth from 'mammoth';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export default function Publications({ currentOrg, user }) {
  const [papers, setPapers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeWorkspacePaper, setActiveWorkspacePaper] = useState(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [now] = useState(() => Date.now());

  // Editor mode: 'builtin' (in-browser Word suite) vs 'cloud' (embedded Docs / Office link)
  const [editorMode, setEditorMode] = useState('builtin');

  // Manuscript Creation Form State
  const [newPaper, setNewPaper] = useState({
    title: '',
    targetJournal: '',
    leadAuthor: user?.displayName || user?.email?.split('@')[0] || '',
    coAuthors: '',
    status: 'In Drafting',
    deadline: '',
    documentUrl: '',
    taskNote: ''
  });

  // Active Draft Workspace State
  const [workspaceDraft, setWorkspaceDraft] = useState({
    content: '',
    feedback: '',
    tasks: [],
    citations: []
  });

  // Citation Form State
  const [doiInput, setDoiInput] = useState('');
  const [isFetchingDoi, setIsFetchingDoi] = useState(false);
  const [citationFormat, setCitationFormat] = useState('APA');

  // Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const editorRef = useRef(null);

  // Real-time Papers Listener
  useEffect(() => {
    if (!currentOrg?.id) return;
    const q = query(collection(db, 'publications'), where('labId', '==', currentOrg.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPapers(docs);
      
      const currentId = activeWorkspacePaper?.id;
      if (currentId) {
        const match = docs.find(p => p.id === currentId);
        if (match) setActiveWorkspacePaper(match);
      }
    });
    return () => unsubscribe();
  }, [currentOrg?.id, activeWorkspacePaper?.id]);

  // Open Workspace
  const openWorkspace = (paper) => {
    setActiveWorkspacePaper(paper);
    setEditorMode(paper.documentUrl ? 'cloud' : 'builtin');
    setWorkspaceDraft({
      content: paper.contentDraft || '',
      feedback: paper.teacherFeedback || '',
      tasks: paper.tasks || [],
      citations: paper.citations || []
    });
  };

  // Upload local .docx file (mammoth parser)
  const handleDocxUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setWorkspaceDraft(prev => ({
          ...prev,
          content: result.value
        }));
        if (editorRef.current) {
          editorRef.current.innerHTML = result.value;
        }
      } catch (err) {
        console.error('Failed to parse .docx file:', err);
        alert('Could not convert .docx file. Please check file format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Export current HTML content back to a genuine .docx file
  const handleExportDocx = async () => {
    const textContent = editorRef.current ? editorRef.current.innerText : workspaceDraft.content;
    const paragraphs = textContent.split('\n\n').map(pText => (
      new Paragraph({
        children: [new TextRun({ text: pText, font: 'Calibri', size: 24 })],
        spacing: { after: 200, line: 360 }
      })
    ));

    const docxFile = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: activeWorkspacePaper?.title || 'Manuscript Draft',
            heading: HeadingLevel.TITLE,
            spacing: { after: 300 }
          }),
          new Paragraph({
            text: `Authors: ${activeWorkspacePaper?.leadAuthor || ''} ${activeWorkspacePaper?.coAuthors ? ', ' + activeWorkspacePaper.coAuthors : ''}`,
            spacing: { after: 300 }
          }),
          ...paragraphs
        ]
      }]
    });

    const blob = await Packer.toBlob(docxFile);
    saveAs(blob, `${(activeWorkspacePaper?.title || 'manuscript').replace(/\s+/g, '_')}.docx`);
  };

  // Automated DOI Citation Fetcher (CrossRef API)
  const handleFetchCitation = async (e) => {
    e.preventDefault();
    const cleanDoi = doiInput.replace(/https?:\/\/(dx\.)?doi\.org\//, '').trim();
    if (!cleanDoi) return;

    setIsFetchingDoi(true);
    try {
      const res = await fetch(`https://api.crossref.org/works/${cleanDoi}`);
      if (!res.ok) throw new Error('DOI not found');
      const data = await res.json();
      const item = data.message;

      const authorNames = (item.author || []).map(a => `${a.family}, ${a.given?.[0] || ''}.`).join(', ');
      const year = item.created?.['date-parts']?.[0]?.[0] || 'n.d.';
      const articleTitle = item.title?.[0] || 'Untitled';
      const journalTitle = item['container-title']?.[0] || '';
      const volume = item.volume ? ` ${item.volume}` : '';
      const issue = item.issue ? `(${item.issue})` : '';
      const pages = item.page ? `: ${item.page}` : '';

      let formatted = '';
      if (citationFormat === 'APA') {
        formatted = `${authorNames} (${year}). ${articleTitle}. ${journalTitle},${volume}${issue}${pages}. https://doi.org/${cleanDoi}`;
      } else if (citationFormat === 'IEEE') {
        formatted = `${authorNames}, "${articleTitle}," ${journalTitle}, vol.${volume}, no.${issue}, pp.${pages}, ${year}.`;
      } else {
        formatted = `${authorNames} ${year}, '${articleTitle}', ${journalTitle}, vol.${volume}, ${pages}.`;
      }

      const updatedCitations = [...workspaceDraft.citations, { id: Date.now().toString(), text: formatted, doi: cleanDoi }];
      setWorkspaceDraft(prev => ({ ...prev, citations: updatedCitations }));
      
      if (activeWorkspacePaper?.id) {
        await updateDoc(doc(db, 'publications', activeWorkspacePaper.id), {
          citations: updatedCitations
        });
      }
      setDoiInput('');
    } catch {
      alert('Could not retrieve DOI metadata. Please verify the DOI code.');
    } finally {
      setIsFetchingDoi(false);
    }
  };

  // Save changes to Firestore
  const handleSaveWorkspace = async () => {
    if (!activeWorkspacePaper?.id) return;
    setIsSavingDraft(true);
    const htmlContent = editorRef.current ? editorRef.current.innerHTML : workspaceDraft.content;

    try {
      await updateDoc(doc(db, 'publications', activeWorkspacePaper.id), {
        contentDraft: htmlContent,
        teacherFeedback: workspaceDraft.feedback,
        documentUrl: activeWorkspacePaper.documentUrl || '',
        lastEditedBy: user?.displayName || user?.email,
        lastEditedAt: serverTimestamp()
      });
      setIsSavingDraft(false);
    } catch (err) {
      console.error('Save workspace error:', err);
      setIsSavingDraft(false);
    }
  };

  // Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeWorkspacePaper?.id) return;

    const updatedTasks = [
      ...(activeWorkspacePaper.tasks || []),
      {
        id: Date.now().toString(),
        task: newTaskTitle.trim(),
        assignedTo: newTaskAssignee.trim() || user?.displayName || 'Intern',
        dueDate: newTaskDueDate,
        completed: false
      }
    ];

    try {
      await updateDoc(doc(db, 'publications', activeWorkspacePaper.id), {
        tasks: updatedTasks
      });
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setNewTaskDueDate('');
    } catch (err) {
      console.error('Task error:', err);
    }
  };

  const handleToggleTask = async (taskId) => {
    const updatedTasks = (activeWorkspacePaper.tasks || []).map(t => {
      if (t.id === taskId) return { ...t, completed: !t.completed };
      return t;
    });

    try {
      await updateDoc(doc(db, 'publications', activeWorkspacePaper.id), {
        tasks: updatedTasks
      });
    } catch (err) {
      console.error('Toggle task error:', err);
    }
  };

  const handleCreatePaper = async (e) => {
    e.preventDefault();
    if (!newPaper.title.trim()) return;

    try {
      await addDoc(collection(db, 'publications'), {
        ...newPaper,
        labId: currentOrg.id,
        createdBy: user?.email,
        createdAt: serverTimestamp(),
        contentDraft: '',
        teacherFeedback: '',
        tasks: newPaper.taskNote ? [{
          id: Date.now().toString(),
          task: newPaper.taskNote,
          dueDate: newPaper.deadline,
          assignedTo: newPaper.leadAuthor,
          completed: false
        }] : [],
        citations: []
      });

      setNewPaper({
        title: '',
        targetJournal: '',
        leadAuthor: user?.displayName || '',
        coAuthors: '',
        status: 'In Drafting',
        deadline: '',
        documentUrl: '',
        taskNote: ''
      });
      setShowAddModal(false);
    } catch (err) {
      console.error('Create paper error:', err);
    }
  };

  const handleDeletePaper = async (id) => {
    if (window.confirm("Remove this manuscript record?")) {
      await deleteDoc(doc(db, 'publications', id));
      if (activeWorkspacePaper?.id === id) setActiveWorkspacePaper(null);
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
            Manuscript Studio & Collaborative Workspace
          </h2>
          <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
            Word suite drafting, automated citation engine, and task deadlines for <strong style={{ color: '#2d6a4f' }}>{currentOrg?.name || 'Academic Lab'}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            background: '#2d6a4f',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 16px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(45, 106, 79, 0.2)'
          }}
        >
          + New Manuscript Draft
        </button>
      </div>

      {/* Manuscripts Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '12px', overflow: 'hidden', marginBottom: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e9ecef', color: '#6c757d' }}>
              <th style={thStyle}>Manuscript Title</th>
              <th style={thStyle}>Target Journal</th>
              <th style={thStyle}>Authors (Interns & Faculty)</th>
              <th style={thStyle}>Next Deadline</th>
              <th style={thStyle}>Format Type</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {papers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#adb5bd' }}>
                  No manuscript drafts recorded. Click "+ New Manuscript Draft" to begin drafting with your team.
                </td>
              </tr>
            ) : (
              papers.map((p) => {
                const isOverdue = p.deadline && new Date(p.deadline).getTime() < now;
                const isSelected = activeWorkspacePaper?.id === p.id;

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f3f5', background: isSelected ? '#f0fdf4' : 'transparent' }}>
                    <td style={{ ...tdStyle, fontWeight: '700', color: '#212529', maxWidth: '280px' }}>
                      {p.title}
                    </td>
                    <td style={{ ...tdStyle, color: '#495057' }}>
                      <span style={{ background: '#e9ecef', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        {p.targetJournal || 'Undecided'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#495057', fontSize: '12px' }}>
                      <strong>{p.leadAuthor}</strong>{p.coAuthors ? `, ${p.coAuthors}` : ''}
                    </td>
                    <td style={tdStyle}>
                      {p.deadline ? (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: isOverdue ? '#e03131' : '#2b8a3e',
                          background: isOverdue ? '#fff5f5' : '#ebfbee',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          border: `1px solid ${isOverdue ? '#ffc9c9' : '#b2f2bb'}`
                        }}>
                          📅 {new Date(p.deadline).toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ color: '#adb5bd', fontSize: '11px' }}>None set</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '11px', color: p.documentUrl ? '#1971c2' : '#2d6a4f', fontWeight: '600' }}>
                        {p.documentUrl ? '🌐 Cloud Word/Docs' : '📄 Built-in .DOCX'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: p.status === 'Accepted' ? '#d8f3dc' : '#fff9db',
                        color: p.status === 'Accepted' ? '#2d6a4f' : '#e67700'
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => openWorkspace(p)}
                        style={{
                          background: isSelected ? '#2d6a4f' : '#e8f5e9',
                          color: isSelected ? '#ffffff' : '#2d6a4f',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginRight: '6px'
                        }}
                      >
                        ✍️ {isSelected ? 'Active Studio' : 'Open Studio'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePaper(p.id)}
                        style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '14px' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 2. COLLABORATIVE EDITING & CITATION WORKSPACE */}
      {activeWorkspacePaper && (
        <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.04)', marginBottom: '36px' }}>
          
          {/* Top Studio Control Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f3f5', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#2d6a4f', fontWeight: '800' }}>
                  MANUSCRIPT STUDIO • {activeWorkspacePaper.targetJournal || 'General Preparation'}
                </span>
                <span style={{ fontSize: '11px', background: '#e9ecef', color: '#495057', padding: '1px 6px', borderRadius: '4px' }}>
                  Auto-Sync Enabled
                </span>
              </div>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: '700', color: '#1b4332' }}>
                {activeWorkspacePaper.title}
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Switch Editor Modes */}
              <div style={{ display: 'flex', background: '#f1f3f5', borderRadius: '8px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setEditorMode('builtin')}
                  style={{
                    background: editorMode === 'builtin' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: editorMode === 'builtin' ? '#1b4332' : '#6c757d',
                    cursor: 'pointer'
                  }}
                >
                  📄 Built-in Word Editor
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('cloud')}
                  style={{
                    background: editorMode === 'cloud' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: editorMode === 'cloud' ? '#1b4332' : '#6c757d',
                    cursor: 'pointer'
                  }}
                >
                  🌐 Live Cloud Word / Docs
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveWorkspace}
                disabled={isSavingDraft}
                style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: isSavingDraft ? 'not-allowed' : 'pointer' }}
              >
                {isSavingDraft ? 'Syncing...' : '💾 Save Draft'}
              </button>

              <button
                type="button"
                onClick={() => setActiveWorkspacePaper(null)}
                style={{ background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '7px', padding: '8px 12px', fontSize: '12px', color: '#495057', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '24px' }}>
            
            {/* Left Column: Word Processing Engine */}
            <div>
              {editorMode === 'builtin' ? (
                <div>
                  {/* Word-like Formatting Toolbar */}
                  <div style={{ background: '#f8faf9', border: '1px solid #ced4da', borderBottom: 'none', borderRadius: '8px 8px 0 0', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button type="button" onClick={() => document.execCommand('bold')} style={formatBtnStyle} title="Bold"><strong>B</strong></button>
                      <button type="button" onClick={() => document.execCommand('italic')} style={formatBtnStyle} title="Italic"><em>I</em></button>
                      <button type="button" onClick={() => document.execCommand('underline')} style={formatBtnStyle} title="Underline"><u>U</u></button>
                      <button type="button" onClick={() => document.execCommand('formatBlock', false, '<h2>')} style={formatBtnStyle} title="Heading 2">H2</button>
                      <button type="button" onClick={() => document.execCommand('formatBlock', false, '<h3>')} style={formatBtnStyle} title="Heading 3">H3</button>
                      <button type="button" onClick={() => document.execCommand('insertUnorderedList')} style={formatBtnStyle} title="Bullet list">• List</button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Upload Local .docx */}
                      <label style={{ ...formatBtnStyle, background: '#ffffff', color: '#2d6a4f', border: '1px solid #ced4da', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📥 Open Local .docx
                        <input type="file" accept=".docx" onChange={handleDocxUpload} style={{ display: 'none' }} />
                      </label>
                      {/* Export genuine .docx */}
                      <button type="button" onClick={handleExportDocx} style={{ ...formatBtnStyle, background: '#2d6a4f', color: '#ffffff', border: 'none' }}>
                        📤 Export .docx
                      </button>
                    </div>
                  </div>

                  {/* Rich Editable Page Canvas */}
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: workspaceDraft.content || '<p>Type or paste your manuscript draft here, or click "Open Local .docx" to import an offline file...</p>' }}
                    style={{
                      minHeight: '440px',
                      maxHeight: '520px',
                      overflowY: 'auto',
                      padding: '24px',
                      border: '1px solid #ced4da',
                      borderRadius: '0 0 8px 8px',
                      background: '#ffffff',
                      fontFamily: '"Times New Roman", Times, serif',
                      fontSize: '14px',
                      lineHeight: '1.7',
                      color: '#1a1a1a',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
                      outline: 'none'
                    }}
                  />

                  {/* Teacher Feedback / Peer Review Section */}
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#e67700', marginBottom: '6px' }}>
                      🎓 FACULTY / PI REVISION GUIDANCE & EDITS:
                    </label>
                    <textarea
                      rows={3}
                      value={workspaceDraft.feedback}
                      onChange={(e) => setWorkspaceDraft({ ...workspaceDraft, feedback: e.target.value })}
                      placeholder="Supervisors and faculty can enter requested amendments, statistical concerns, or journal revision comments..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #ffe066',
                        background: '#fff9db',
                        fontSize: '12px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Cloud Mode (Word Online / Google Docs Shareable Iframe) */
                <div>
                  <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                    <input
                      type="url"
                      placeholder="Paste shareable OneDrive Word Online or Google Docs link..."
                      value={activeWorkspacePaper.documentUrl || ''}
                      onChange={(e) => setActiveWorkspacePaper({ ...activeWorkspacePaper, documentUrl: e.target.value })}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px' }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveWorkspace}
                      style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Embed Link
                    </button>
                  </div>

                  {activeWorkspacePaper.documentUrl ? (
                    <div style={{ height: '520px', border: '1px solid #ced4da', borderRadius: '8px', overflow: 'hidden' }}>
                      <iframe
                        src={activeWorkspacePaper.documentUrl}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        title="Cloud Word Suite"
                        allow="clipboard-read; clipboard-write"
                      />
                    </div>
                  ) : (
                    <div style={{ height: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8faf9', border: '1px dashed #ced4da', borderRadius: '8px', color: '#6c757d' }}>
                      <span style={{ fontSize: '32px', marginBottom: '8px' }}>🌐</span>
                      <strong style={{ fontSize: '13px' }}>No Cloud Document Linked</strong>
                      <p style={{ fontSize: '11px', maxWidth: '360px', textAlign: 'center', margin: '4px 0 0 0' }}>
                        Paste a public or institutional sharing link from Microsoft 365 Word Online or Google Docs to enable simultaneous real-time multi-user cursor editing.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Academic Citation Engine + Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 1. CrossRef Automated Citation Generator */}
              <div style={{ background: '#f8faf9', border: '1px solid #e9ecef', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#1b4332', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📚</span> Academic Citation Engine (DOI / PubMed)
                </h4>
                <p style={{ fontSize: '11px', color: '#6c757d', margin: '0 0 10px 0' }}>
                  Paste a DOI to automatically pull metadata and format references without requiring desktop Mendeley or EndNote plugins.
                </p>

                <form onSubmit={handleFetchCitation} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="e.g. 10.1016/j.biortech.2025.130000"
                      value={doiInput}
                      onChange={(e) => setDoiInput(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                    />
                    <select
                      value={citationFormat}
                      onChange={(e) => setCitationFormat(e.target.value)}
                      style={{ padding: '6px 8px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '11px' }}
                    >
                      <option value="APA">APA 7th</option>
                      <option value="IEEE">IEEE</option>
                      <option value="Harvard">Harvard</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isFetchingDoi}
                    style={{ background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '7px 0', fontSize: '11px', fontWeight: '700', cursor: isFetchingDoi ? 'not-allowed' : 'pointer' }}
                  >
                    {isFetchingDoi ? 'Querying CrossRef...' : '+ Generate Citation'}
                  </button>
                </form>

                {/* Formatted Citations List */}
                <div style={{ marginTop: '12px', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {workspaceDraft.citations?.map((c) => (
                    <div key={c.id} style={{ background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '6px', padding: '8px 10px', fontSize: '11px', lineHeight: '1.4' }}>
                      <div style={{ color: '#212529', fontStyle: 'italic', marginBottom: '4px' }}>{c.text}</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (editorRef.current) {
                            editorRef.current.innerHTML += `<p>${c.text}</p>`;
                          }
                          navigator.clipboard.writeText(c.text);
                          alert('Citation copied and appended to manuscript!');
                        }}
                        style={{ background: '#e8f5e9', border: 'none', color: '#2d6a4f', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Copy & Insert to Paper
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Task Deadlines & Reminders */}
              <div style={{ background: '#f8faf9', border: '1px solid #e9ecef', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', color: '#1b4332', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⏳</span> Action Items & Milestones ({activeWorkspacePaper.tasks?.length || 0})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', marginBottom: '12px' }}>
                  {(!activeWorkspacePaper.tasks || activeWorkspacePaper.tasks.length === 0) ? (
                    <div style={{ fontSize: '11px', color: '#adb5bd', textAlign: 'center', padding: '16px 0' }}>
                      No tasks logged yet. Add one below.
                    </div>
                  ) : (
                    activeWorkspacePaper.tasks.map((t) => (
                      <div key={t.id} style={{ background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '6px', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="checkbox" checked={t.completed} onChange={() => handleToggleTask(t.id)} />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '600', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.task}</div>
                            <span style={{ fontSize: '10px', color: '#6c757d' }}>Assigned: {t.assignedTo}</span>
                          </div>
                        </div>
                        {t.dueDate && (
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#e03131', background: '#fff5f5', padding: '2px 6px', borderRadius: '4px' }}>
                            {new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddTask} style={{ borderTop: '1px solid #e9ecef', paddingTop: '10px' }}>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Add Discussion paragraph on Fig 3"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', marginBottom: '6px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input
                      type="text"
                      placeholder="Assignee (Intern/Lead)"
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '11px' }}
                    />
                    <input
                      type="date"
                      required
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '11px' }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{ width: '100%', background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 0', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    + Assign Action Item
                  </button>
                </form>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* 3. NEW MANUSCRIPT MODAL */}
      {showAddModal && (
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
          padding: '20px'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 30px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1b4332' }}>
                Register New Manuscript Draft
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: '#f8faf9', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: '#868e96' }}>✕</button>
            </div>

            <form onSubmit={handleCreatePaper} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Working Paper Title *</label>
                <input type="text" required placeholder="e.g. Diatoms as Nutritional Food and Bio-remediators" value={newPaper.title} onChange={(e) => setNewPaper({ ...newPaper, title: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Target Journal</label>
                  <input type="text" placeholder="e.g. Bioresource Technology" value={newPaper.targetJournal} onChange={(e) => setNewPaper({ ...newPaper, targetJournal: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Status</label>
                  <select value={newPaper.status} onChange={(e) => setNewPaper({ ...newPaper, status: e.target.value })} style={inputStyle}>
                    <option value="In Drafting">In Drafting</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Revision Required">Revision Required</option>
                    <option value="Accepted">Accepted</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>First Author</label>
                  <input type="text" required value={newPaper.leadAuthor} onChange={(e) => setNewPaper({ ...newPaper, leadAuthor: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Co-Authors (Interns & Faculty)</label>
                  <input type="text" placeholder="e.g. M. Kumar, A. Das" value={newPaper.coAuthors} onChange={(e) => setNewPaper({ ...newPaper, coAuthors: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Live Word / Docs Sharing Link (Optional)</label>
                <input type="url" placeholder="https://onedrive.live.com/... or Google Docs shareable URL" value={newPaper.documentUrl} onChange={(e) => setNewPaper({ ...newPaper, documentUrl: e.target.value })} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Submission Deadline</label>
                  <input type="date" value={newPaper.deadline} onChange={(e) => setNewPaper({ ...newPaper, deadline: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Initial Action Item</label>
                  <input type="text" placeholder="e.g. Complete intro draft" value={newPaper.taskNote} onChange={(e) => setNewPaper({ ...newPaper, taskNote: e.target.value })} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, background: '#2d6a4f', color: '#ffffff', border: 'none', borderRadius: '7px', padding: '9px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Create Manuscript Record</button>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '7px', padding: '9px', fontSize: '12px', color: '#495057', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const thStyle = { padding: '12px 16px', fontWeight: '600', fontSize: '12px' };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' };
const formatBtnStyle = { background: '#ffffff', border: '1px solid #ced4da', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', color: '#334155' };
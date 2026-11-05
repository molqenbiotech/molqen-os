import { useState } from 'react';

const TABS = [
  { key: 'metadata', label: 'Metadata' },
  { key: 'entity_map', label: 'Entity Map' },
  { key: 'relevant_items', label: 'Relevant Items' },
  { key: 'description', label: 'Description' },
  { key: 'results', label: 'Results' },
];

const s = {
  container: {
    width: '100%',
    height: '100%',
    background: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  collapsed: {
    width: 32,
    height: '100%',
    background: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  collapseToggleTop: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '6px 8px 0 8px',
    flexShrink: 0,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '2px 4px',
    borderRadius: 4,
    fontSize: 16,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  subnav: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 16px',
    gap: 16,
    overflowX: 'auto',
    flexShrink: 0,
    height: 36,
    alignItems: 'flex-end',
    scrollbarWidth: 'none',
  },
  tab: (active) => ({
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: active ? '#2563eb' : '#64748b',
    padding: '0 2px',
    paddingBottom: 8,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }),
  header: {
    padding: '12px 16px 8px 16px',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  entityIcon: {
    fontSize: 18,
    flexShrink: 0,
    marginTop: 1,
  },
  entityNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  entityName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  registryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  registryName: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actionIcons: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
    marginLeft: 8,
  },
  scrollable: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  metaTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  metaLabelCell: {
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    width: 120,
    padding: '6px 8px 6px 16px',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  metaValueCell: {
    fontSize: 12,
    color: '#0f172a',
    padding: '6px 8px 6px 0',
    verticalAlign: 'top',
  },
  editPencil: (visible) => ({
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 4,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.15s',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    verticalAlign: 'middle',
  }),
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px 4px 16px',
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  addBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#2563eb',
    fontSize: 16,
    lineHeight: 1,
    padding: '0 4px',
  },
  aliasesArea: {
    padding: '4px 16px 10px 16px',
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  schemaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px 8px 16px',
  },
  schemaLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
  },
  schemaValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: 600,
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    padding: '1px 8px',
    cursor: 'default',
  },
  attrTable: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  attrHeaderRow: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#94a3b8',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    borderTop: '1px solid #e2e8f0',
  },
  attrHeaderCell: {
    padding: '4px 8px 4px 16px',
    fontWeight: 700,
  },
  attrHeaderCellRight: {
    padding: '4px 16px 4px 8px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94a3b8',
    fontSize: 13,
    gap: 8,
    padding: 24,
    textAlign: 'center',
  },
};

function MetaRow({ label, value, onEdit }) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? '#f8fafc' : 'transparent', height: 32 }}
    >
      <td style={s.metaLabelCell}>{label}</td>
      <td style={s.metaValueCell}>
        <span>{value}</span>
        {onEdit && (
          <button
            style={s.editPencil(hovered)}
            onClick={() => onEdit(label)}
            aria-label={`Edit ${label}`}
          >✏</button>
        )}
      </td>
    </tr>
  );
}

function AttrRow({ field, value, type, idx }) {
  const [hovered, setHovered] = useState(false);
  const bg = hovered ? '#e8f0fe' : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
  return (
    <tr
      style={{ height: 28, background: bg }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ ...s.attrHeaderCell, fontSize: 12, fontWeight: 400, color: '#475569', width: '45%' }}>
        {field}
      </td>
      <td style={{ padding: '4px 16px 4px 8px', fontSize: 12 }}>
        {type === 'chip' ? (
          <span className="benchling-entity-pill">{value}</span>
        ) : type === 'link' ? (
          <a href="#" style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 12 }} onClick={(e) => e.preventDefault()}>
            {value}
          </a>
        ) : (
          <span style={{ color: '#0f172a' }}>{value}</span>
        )}
      </td>
    </tr>
  );
}

function IconButton({ title, children, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      style={{ ...s.iconBtn, color: hovered ? '#475569' : '#94a3b8' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ScientificEntityInspector({
  entity,
  activeSubtab = 'metadata',
  onSubtabChange,
  onEdit,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const [tab, setTab] = useState(activeSubtab);

  const handleTabChange = (key) => {
    setTab(key);
    onSubtabChange?.(key);
  };

  if (isCollapsed) {
    return (
      <div
        style={s.collapsed}
        onClick={onToggleCollapse}
        title="Expand inspector"
        role="button"
        aria-label="Expand inspector"
      >
        <div style={{ padding: '8px 0', color: '#94a3b8', fontSize: 18 }}>›</div>
        {entity && (
          <div style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: 11,
            fontWeight: 600,
            color: '#64748b',
            marginTop: 8,
            overflow: 'hidden',
            maxHeight: 200,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entity.name}
          </div>
        )}
      </div>
    );
  }

  if (!entity) {
    return (
      <div style={s.container}>
        <div style={s.collapseToggleTop}>
          <IconButton title="Collapse" onClick={onToggleCollapse}>‹</IconButton>
        </div>
        <div style={s.emptyState}>
          <span style={{ fontSize: 32 }}>🧬</span>
          <span>Select an entity to inspect</span>
        </div>
      </div>
    );
  }

  const authors = Array.isArray(entity.authors) ? entity.authors.join(', ') : (entity.authors ?? '—');
  const aliases = entity.aliases ?? [];

  return (
    <div style={s.container}>
      {/* Top collapse toggle */}
      <div style={s.collapseToggleTop}>
        <IconButton title="Collapse panel" onClick={onToggleCollapse}>‹</IconButton>
      </div>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <span style={s.entityIcon}>🧬</span>
          <div style={s.entityNameBlock}>
            <div style={s.entityName}>{entity.name}</div>
            <div style={s.registryRow}>
              <span style={s.registryName} title={entity.registryName}>{entity.registryName}</span>
              <div style={s.actionIcons}>
                <IconButton title="Share">⤴</IconButton>
                <IconButton title="Grid view">⊞</IconButton>
                <IconButton title="List view">☰</IconButton>
                <IconButton title="More options">…</IconButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subnav */}
      <div style={s.subnav}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            style={s.tab(tab === key)}
            onClick={() => handleTabChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={s.scrollable}>
        {tab === 'metadata' && (
          <>
            {/* Core metadata table */}
            <table style={s.metaTable}>
              <tbody>
                <MetaRow label="Authors" value={authors} onEdit={onEdit} />
                <MetaRow label="Project Folder" value={entity.projectFolder ?? '—'} onEdit={onEdit} />
                <MetaRow label="Studies" value={entity.studiesNote ?? 'Not added to any studies'} onEdit={onEdit} />
                <MetaRow label="Created" value={formatDate(entity.createdAt)} />
                <MetaRow
                  label="Registry ID"
                  value={
                    <span style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 11 }}>
                      {entity.registryId ?? '—'}
                    </span>
                  }
                />
              </tbody>
            </table>

            {/* Aliases */}
            <div style={s.sectionHeader}>
              <span>Aliases</span>
              <button style={s.addBtn} aria-label="Add alias">+</button>
            </div>
            <div style={s.aliasesArea}>
              {aliases.length === 0 ? (
                <span>No aliases</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {aliases.map((a, i) => (
                    <span key={i} className="benchling-entity-pill">{a}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Schema */}
            {entity.schema && (
              <>
                <div style={s.schemaRow}>
                  <span style={s.schemaLabel}>Schema:</span>
                  <span style={s.schemaValue}>{entity.schema} ▾</span>
                  <button style={{ ...s.addBtn, fontSize: 11, marginLeft: 'auto' }}>Edit</button>
                </div>

                {entity.attributes && entity.attributes.length > 0 && (
                  <table style={s.attrTable}>
                    <thead>
                      <tr style={s.attrHeaderRow}>
                        <th style={s.attrHeaderCell}>Field</th>
                        <th style={s.attrHeaderCellRight}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entity.attributes.map((attr, i) => (
                        <AttrRow
                          key={i}
                          idx={i}
                          field={attr.key}
                          value={attr.value}
                          type={attr.type ?? 'text'}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </>
        )}

        {tab !== 'metadata' && (
          <div style={s.emptyState}>
            <span style={{ fontSize: 28, opacity: 0.4 }}>📄</span>
            <span style={{ color: '#cbd5e1', fontSize: 12 }}>
              {TABS.find((t) => t.key === tab)?.label} — coming soon
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import PropTypes from 'prop-types';

/**
 * CitationProofPill
 * Interactive inline pill marker: [1: Sarma et al., 2026 ✓ 94%]
 * Supports statuses: 'SUPPORTED', 'UNSUBSTANTIATED', 'CONTRADICTED'
 */
export default function CitationProofPill({
  citationNumber = 1,
  citationKey = 'Author et al., 2026',
  status = 'SUPPORTED',
  confidenceScore = 0.94,
  isLocked = false,
  onClick
}) {
  const normStatus = (status || 'SUPPORTED').toUpperCase();

  let bg = '#ecfdf5';
  let border = '#a7f3d0';
  let text = '#059669';
  let icon = '✓';

  if (normStatus === 'CONTRADICTED') {
    bg = '#fef2f2';
    border = '#fecaca';
    text = '#dc2626';
    icon = '✕';
  } else if (normStatus === 'UNSUBSTANTIATED' || normStatus === 'PARTIAL' || normStatus === 'NEUTRAL') {
    bg = '#fffbeb';
    border = '#fde68a';
    text = '#d97706';
    icon = '▲';
  }

  const percent = Math.round(confidenceScore * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: bg,
        border: `1px solid ${border}`,
        color: text,
        borderRadius: '999px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: '700',
        fontFamily: 'Inter, -apple-system, sans-serif',
        cursor: 'pointer',
        verticalAlign: 'baseline',
        margin: '0 2px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'transform 0.1s ease'
      }}
      title={`Citation ${citationNumber}: ${citationKey} (${normStatus} - ${percent}% confidence)`}
    >
      <span>[{citationNumber}: {citationKey}</span>
      <span>{icon}</span>
      <span>{percent}%]</span>
      {isLocked && <span style={{ fontSize: '10px' }}>🔒</span>}
    </button>
  );
}

CitationProofPill.propTypes = {
  citationNumber: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  citationKey: PropTypes.string,
  status: PropTypes.oneOf(['SUPPORTED', 'UNSUBSTANTIATED', 'CONTRADICTED', 'PARTIAL', 'NEUTRAL']),
  confidenceScore: PropTypes.number,
  isLocked: PropTypes.bool,
  onClick: PropTypes.func
};


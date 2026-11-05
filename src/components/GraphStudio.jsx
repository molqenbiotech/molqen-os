import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';

const PALETTE = [
  '#059669', '#2563eb', '#d97706', '#db2777', 
  '#7c3aed', '#0891b2', '#dc2626', '#0d9488', '#4f46e5'
];

const CHART_TYPES = [
  { id: 'line_curve', name: 'Continuous Line & Kinetics Plot' },
  { id: 'scatter_linear', name: 'Scatter Plot with Linear Regression (R²)' },
  { id: 'bar_error', name: 'Comparative Bar Chart with Error Bars (±SD)' },
  { id: 'spider_radar', name: 'Spider / Radar Multi-Metric Chart' },
  { id: 'area_plot', name: 'Area & Saturation Yield Plot' },
  { id: 'histogram', name: 'Histogram Distribution' }
];

export default function ScientificGraphStudio() {
  const [selectedChartType, setSelectedChartType] = useState('line_curve');
  
  // Starts completely empty for handover
  const [seriesList, setSeriesList] = useState([]);
  const [activeSeriesIndex, setActiveSeriesIndex] = useState(-1);

  // Editable metadata
  const [graphTitle, setGraphTitle] = useState('');
  const [xLabel, setXLabel] = useState('');
  const [yLabel, setYLabel] = useState('');
  const [showErrorBars, setShowErrorBars] = useState(true);
  const [showTrendline, setShowTrendline] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Manual entry fields
  const [newX, setNewX] = useState('');
  const [newY, setNewY] = useState('');
  const [newSD, setNewSD] = useState('');
  const [unknownY, setUnknownY] = useState('');

  const fileInputRef = useRef(null);

  // File Upload Parser: CSV & Excel (.xlsx, .xls)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        let rows = [];

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        } else {
          rows = data.split('\n').map(r => r.split(',').map(c => c.trim()));
        }

        if (rows.length < 2) {
          alert('Spreadsheet requires header rows and numeric coordinates.');
          return;
        }

        // Title detection
        const titleCandidate = rows[0] && rows[0][0] ? String(rows[0][0]).trim() : '';
        if (titleCandidate && !titleCandidate.toLowerCase().includes('t(d)') && !titleCandidate.toLowerCase().includes('time')) {
          setGraphTitle(`${titleCandidate} Analysis`);
        } else {
          setGraphTitle(file.name.replace(/\.[^/.]+$/, ''));
        }

        // Header detection
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          if (rows[i] && rows[i].some(cell => {
            const str = String(cell).toLowerCase();
            return str.includes('t(d)') || str.includes('time') || str.includes('day') || str.includes('x');
          })) {
            headerRowIdx = i;
            break;
          }
        }

        const headerRow = rows[headerRowIdx];
        const dataRows = rows.slice(headerRowIdx + 1).filter(r => r && r[0] !== undefined && !isNaN(parseFloat(r[0])));

        if (headerRow[0]) {
          setXLabel(String(headerRow[0]).trim());
        }
        setYLabel('Measured Value');

        const discoveredSeries = [];
        let colorCounter = 0;

        for (let col = 1; col < headerRow.length; col++) {
          const rawColName = String(headerRow[col] || '').trim();
          if (!rawColName || rawColName.toLowerCase() === 'sd') continue;

          const nextColName = String(headerRow[col + 1] || '').trim().toLowerCase();
          const hasSD = nextColName === 'sd' || nextColName.includes('sd');

          const seriesPoints = [];
          dataRows.forEach(row => {
            const xVal = parseFloat(row[0]);
            const yVal = parseFloat(row[col]);
            const sdVal = hasSD ? parseFloat(row[col + 1]) || 0 : 0;

            if (!isNaN(xVal) && !isNaN(yVal)) {
              seriesPoints.push({ x: xVal, y: yVal, sd: sdVal });
            }
          });

          if (seriesPoints.length > 0) {
            discoveredSeries.push({
              name: rawColName,
              color: PALETTE[colorCounter % PALETTE.length],
              points: seriesPoints
            });
            colorCounter++;
          }

          if (hasSD) col++;
        }

        if (discoveredSeries.length > 0) {
          setSeriesList(discoveredSeries);
          setActiveSeriesIndex(-1);
          setSelectedChartType('line_curve');
        } else {
          alert('Could not find numeric data columns in this spreadsheet.');
        }
      } catch (err) {
        console.error('File parsing error:', err);
        alert('Failed to parse file: ' + err.message);
      }
    };

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Determine active displayed series
  const renderedSeries = useMemo(() => {
    if (activeSeriesIndex === -1) return seriesList;
    return [seriesList[activeSeriesIndex]].filter(Boolean);
  }, [seriesList, activeSeriesIndex]);

  // Statistical Linear Regression (y = mx + c & R²)
  const regression = useMemo(() => {
    const targetPoints = activeSeriesIndex === -1 
      ? (seriesList[0]?.points || []) 
      : (seriesList[activeSeriesIndex]?.points || []);

    const n = targetPoints.length;
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    targetPoints.forEach(p => {
      const px = p.x ?? 0;
      const py = p.y ?? 0;
      sumX += px;
      sumY += py;
      sumXY += px * py;
      sumX2 += px * px;
      sumY2 += py * py;
    });

    const denM = n * sumX2 - sumX * sumX;
    if (denM === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denM;
    const intercept = (sumY - slope * sumX) / n;

    const denR = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const r = denR === 0 ? 0 : (n * sumXY - sumX * sumY) / denR;
    const r2 = Math.min(1, Math.max(0, r * r));

    return { slope, intercept, r2 };
  }, [seriesList, activeSeriesIndex]);

  // Unknown sample concentration calculation
  const calculatedUnknownX = useMemo(() => {
    if (!unknownY || !regression || regression.slope === 0) return null;
    const yVal = parseFloat(unknownY);
    if (isNaN(yVal)) return null;
    return ((yVal - regression.intercept) / regression.slope).toFixed(3);
  }, [unknownY, regression]);

  // Canvas bounds & scaling
  const width = 640;
  const height = 370;
  const padding = { top: 40, right: 35, bottom: 55, left: 65 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const { minX, maxX, minY, maxY } = useMemo(() => {
    const all = renderedSeries.flatMap(s => s.points);
    if (all.length === 0) return { minX: 0, maxX: 10, minY: 0, maxY: 1 };

    if (selectedChartType === 'bar_error' || selectedChartType === 'histogram') {
      const maxVal = Math.max(1, ...all.map(p => (p.y || 0) + (p.sd || 0))) * 1.2;
      return { minX: 0, maxX: all.length, minY: 0, maxY: maxVal };
    }

    const xVals = all.map(p => p.x ?? 0);
    const yVals = all.map(p => (p.y ?? 0) + (showErrorBars ? (p.sd ?? 0) : 0));

    return {
      minX: Math.min(0, ...xVals),
      maxX: Math.max(...xVals) * 1.05 || 1,
      minY: 0,
      maxY: Math.max(...yVals) * 1.15 || 1
    };
  }, [renderedSeries, selectedChartType, showErrorBars]);

  const scaleX = (x) => padding.left + ((x - minX) / (maxX - minX || 1)) * plotWidth;
  const scaleY = (y) => padding.top + plotHeight - ((y - minY) / (maxY - minY || 1)) * plotHeight;

  // Add Coordinate manually
  const handleAddPoint = () => {
    const y = parseFloat(newY);
    if (isNaN(y)) return;

    const x = parseFloat(newX);
    const sd = parseFloat(newSD) || 0;

    const updated = [...seriesList];

    // If no series exists yet, create Series 1
    if (updated.length === 0) {
      updated.push({
        name: 'Series 1',
        color: PALETTE[0],
        points: []
      });
      if (!graphTitle) setGraphTitle('Experimental Dataset');
      if (!xLabel) setXLabel('X Axis');
      if (!yLabel) setYLabel('Y Axis');
    }

    const targetIdx = activeSeriesIndex === -1 ? 0 : activeSeriesIndex;
    const currentPoints = updated[targetIdx].points;

    const newPoint = selectedChartType === 'bar_error' || selectedChartType === 'spider_radar'
      ? { label: newX || `Condition ${currentPoints.length + 1}`, y, sd }
      : { x: isNaN(x) ? currentPoints.length : x, y, sd };

    updated[targetIdx] = {
      ...updated[targetIdx],
      points: [...currentPoints, newPoint].sort((a, b) => (a.x ?? 0) - (b.x ?? 0))
    };

    setSeriesList(updated);
    setNewX('');
    setNewY('');
    setNewSD('');
  };

  const handleRemovePoint = (pIdx) => {
    const targetIdx = activeSeriesIndex === -1 ? 0 : activeSeriesIndex;
    if (!seriesList[targetIdx]) return;

    const updated = [...seriesList];
    updated[targetIdx] = {
      ...updated[targetIdx],
      points: updated[targetIdx].points.filter((_, i) => i !== pIdx)
    };
    setSeriesList(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all graph data and reset canvas?')) {
      setSeriesList([]);
      setGraphTitle('');
      setXLabel('');
      setYLabel('');
      setUnknownY('');
    }
  };

  const handleExportSVG = () => {
    const svgElem = document.getElementById('scientific-chart-svg');
    if (!svgElem) return;
    const svgData = new XMLSerializer().serializeToString(svgElem);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(graphTitle || 'research_plot').toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const hasData = seriesList.length > 0 && seriesList.some(s => s.points.length > 0);

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. Sleek Top Bar with Unified Controls */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Title & Dropdown Chart Type Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>Graph Studio</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Publication analytics & curve fitting</div>
          </div>

          <div style={{ height: '24px', width: '1px', backgroundColor: '#e5e7eb' }} />

          {/* Minimalist Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '500', color: '#4b5563' }}>Chart Architecture:</span>
            <select
              value={selectedChartType}
              onChange={(e) => setSelectedChartType(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                color: '#111827',
                backgroundColor: '#f9fafb',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {CHART_TYPES.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="clean-btn"
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📁</span> Import Excel / CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {hasData && (
            <>
              <button
                onClick={handleClearAll}
                className="clean-btn"
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  border: '1px solid #fee2e2',
                  backgroundColor: '#fff5f5',
                  color: '#dc2626'
                }}
              >
                Reset Canvas
              </button>

              <button
                onClick={handleExportSVG}
                className="clean-btn"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: '1px solid #059669',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>⬇</span> Export .SVG
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Condition Series Filter Bar (Only shown when multiple series exist) */}
      {seriesList.length > 1 && (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Treatments:</span>

            <button
              onClick={() => setActiveSeriesIndex(-1)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                border: activeSeriesIndex === -1 ? '1.5px solid #111827' : '1px solid #e5e7eb',
                backgroundColor: activeSeriesIndex === -1 ? '#111827' : '#ffffff',
                color: activeSeriesIndex === -1 ? '#ffffff' : '#4b5563'
              }}
            >
              All Overlay ({seriesList.length})
            </button>

            {seriesList.map((s, idx) => {
              const isSelected = activeSeriesIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveSeriesIndex(idx)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: isSelected ? `1.5px solid ${s.color}` : '1px solid #e5e7eb',
                    backgroundColor: isSelected ? `${s.color}15` : '#ffffff',
                    color: isSelected ? s.color : '#4b5563',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color }} />
                  {s.name}
                </button>
              );
            })}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showErrorBars}
              onChange={(e) => setShowErrorBars(e.target.checked)}
            />
            Show Error Bars (±SD)
          </label>
        </div>
      )}

      {/* 3. Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Left: SVG Canvas or Empty State */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px' }}>
          
          {hasData && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <input
                type="text"
                value={graphTitle}
                onChange={(e) => setGraphTitle(e.target.value)}
                placeholder="Figure Title"
                style={{ flex: 2, padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: '600' }}
              />
              <input
                type="text"
                value={xLabel}
                onChange={(e) => setXLabel(e.target.value)}
                placeholder="X-Axis Label"
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
              />
              <input
                type="text"
                value={yLabel}
                onChange={(e) => setYLabel(e.target.value)}
                placeholder="Y-Axis Label"
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
              />
            </div>
          )}

          {/* Canvas Viewport */}
          <div style={{
            border: '1px solid #f3f4f6',
            borderRadius: '10px',
            backgroundColor: '#fafbfc',
            minHeight: '380px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {!hasData ? (
              /* Clean Blank Slate State */
              <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '360px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  fontSize: '22px'
                }}>
                  📊
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                  No Data Loaded
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                  Upload an Excel or CSV file from your bench run, or enter experimental coordinates in the panel on the right.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#111827',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Choose Excel/CSV File
                </button>
              </div>
            ) : (
              /* Scientific SVG Renderer */
              <svg
                id="scientific-chart-svg"
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                {/* Subtle Grid */}
                {[0.2, 0.4, 0.6, 0.8, 1].map((p) => (
                  <line
                    key={p}
                    x1={padding.left}
                    y1={padding.top + plotHeight * p}
                    x2={width - padding.right}
                    y2={padding.top + plotHeight * p}
                    stroke="#f3f4f6"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                ))}

                {/* Radar / Spider Chart */}
                {selectedChartType === 'spider_radar' ? (
                  (() => {
                    const cX = width / 2;
                    const cY = height / 2 + 10;
                    const maxR = 115;
                    const targetPoints = seriesList[0]?.points || [];
                    const total = targetPoints.length || 6;
                    const angleSlice = (Math.PI * 2) / total;

                    return (
                      <g>
                        {[0.25, 0.5, 0.75, 1].map((r, i) => (
                          <circle key={i} cx={cX} cy={cY} r={maxR * r} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                        ))}
                        {targetPoints.map((p, idx) => {
                          const angle = angleSlice * idx - Math.PI / 2;
                          const lineX = cX + Math.cos(angle) * maxR;
                          const lineY = cY + Math.sin(angle) * maxR;
                          const labelX = cX + Math.cos(angle) * (maxR + 20);
                          const labelY = cY + Math.sin(angle) * (maxR + 20);

                          return (
                            <g key={idx}>
                              <line x1={cX} y1={cY} x2={lineX} y2={lineY} stroke="#e5e7eb" strokeWidth="1" />
                              <text x={labelX} y={labelY} fontSize="10" fontWeight="500" fill="#6b7280" textAnchor="middle" dominantBaseline="middle">
                                {p.label || `Metric ${idx + 1}`}
                              </text>
                            </g>
                          );
                        })}
                        <polygon
                          points={targetPoints.map((p, idx) => {
                            const angle = angleSlice * idx - Math.PI / 2;
                            const r = ((p.y || 0) / 100) * maxR;
                            return `${cX + Math.cos(angle) * r},${cY + Math.sin(angle) * r}`;
                          }).join(' ')}
                          fill="rgba(16, 185, 129, 0.15)"
                          stroke="#10b981"
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })()
                ) : (
                  /* Standard Cartesian Plots */
                  <g>
                    {/* Axes */}
                    <line x1={padding.left} y1={padding.top + plotHeight} x2={width - padding.right} y2={padding.top + plotHeight} stroke="#6b7280" strokeWidth="1.5" />
                    <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke="#6b7280" strokeWidth="1.5" />

                    {/* Labels */}
                    <text x={padding.left + plotWidth / 2} y={height - 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="#4b5563">
                      {xLabel}
                    </text>
                    <text x={-(padding.top + plotHeight / 2)} y={20} transform="rotate(-90)" textAnchor="middle" fontSize="11" fontWeight="600" fill="#4b5563">
                      {yLabel}
                    </text>

                    {/* Area Shading */}
                    {selectedChartType === 'area_plot' && renderedSeries.map((series, sIdx) => (
                      series.points.length > 1 && (
                        <polygon
                          key={sIdx}
                          points={`
                            ${scaleX(series.points[0].x)},${padding.top + plotHeight}
                            ${series.points.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')}
                            ${scaleX(series.points[series.points.length - 1].x)},${padding.top + plotHeight}
                          `}
                          fill={`${series.color}15`}
                        />
                      )
                    ))}

                    {/* Bar Chart / Histogram */}
                    {(selectedChartType === 'bar_error' || selectedChartType === 'histogram') && (
                      renderedSeries.flatMap(s => s.points).map((p, idx, arr) => {
                        const barW = (plotWidth / arr.length) * 0.55;
                        const barX = padding.left + (idx + 0.5) * (plotWidth / arr.length) - barW / 2;
                        const barY = scaleY(p.y);
                        const barH = (padding.top + plotHeight) - barY;
                        const cX = barX + barW / 2;
                        const sdTop = scaleY(p.y + (p.sd || 0));
                        const sdBottom = scaleY(Math.max(0, p.y - (p.sd || 0)));

                        return (
                          <g key={idx}>
                            <rect x={barX} y={barY} width={barW} height={barH} fill="#059669" rx="3" opacity="0.85" />
                            {showErrorBars && p.sd > 0 && (
                              <g stroke="#374151" strokeWidth="1.2">
                                <line x1={cX} y1={sdBottom} x2={cX} y2={sdTop} />
                                <line x1={cX - 4} y1={sdTop} x2={cX + 4} y2={sdTop} />
                                <line x1={cX - 4} y1={sdBottom} x2={cX + 4} y2={sdBottom} />
                              </g>
                            )}
                            <text x={cX} y={padding.top + plotHeight + 14} fontSize="9" fontWeight="500" fill="#6b7280" textAnchor="middle">
                              {p.label || p.x}
                            </text>
                          </g>
                        );
                      })
                    )}

                    {/* Curves & Scatter Points */}
                    {selectedChartType !== 'bar_error' && selectedChartType !== 'histogram' && renderedSeries.map((series, sIdx) => {
                      const pathStr = series.points.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${scaleX(curr.x)} ${scaleY(curr.y)}`, '');

                      return (
                        <g key={sIdx}>
                          {(selectedChartType === 'line_curve' || selectedChartType === 'area_plot') && (
                            <path d={pathStr} fill="none" stroke={series.color} strokeWidth="2" strokeLinecap="round" />
                          )}

                          {series.points.map((p, pIdx) => {
                            const cx = scaleX(p.x);
                            const cy = scaleY(p.y);
                            const topSD = scaleY(p.y + (p.sd || 0));
                            const btmSD = scaleY(Math.max(0, p.y - (p.sd || 0)));

                            return (
                              <g key={pIdx}>
                                {showErrorBars && p.sd > 0 && (
                                  <g stroke={series.color} strokeWidth="1.2">
                                    <line x1={cx} y1={btmSD} x2={cx} y2={topSD} />
                                    <line x1={cx - 3.5} y1={topSD} x2={cx + 3.5} y2={topSD} />
                                    <line x1={cx - 3.5} y1={btmSD} x2={cx + 3.5} y2={btmSD} />
                                  </g>
                                )}

                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={hoveredPoint === `${sIdx}-${pIdx}` ? 5 : 3.5}
                                  fill="#ffffff"
                                  stroke={series.color}
                                  strokeWidth="2"
                                  style={{ cursor: 'pointer', transition: 'r 0.1s ease' }}
                                  onMouseEnter={() => setHoveredPoint(`${sIdx}-${pIdx}`)}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* Regression Trendline */}
                    {selectedChartType === 'scatter_linear' && showTrendline && regression && (
                      <line
                        x1={scaleX(minX)}
                        y1={scaleY(regression.slope * minX + regression.intercept)}
                        x2={scaleX(maxX)}
                        y2={scaleY(regression.slope * maxX + regression.intercept)}
                        stroke="#dc2626"
                        strokeWidth="2"
                        strokeDasharray="5 3"
                      />
                    )}
                  </g>
                )}
              </svg>
            )}
          </div>

          {/* Regression Formula Footer */}
          {hasData && selectedChartType === 'scatter_linear' && regression && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#4b5563' }}>
              <div>
                Fit: <strong>y = {regression.slope.toFixed(4)}x {regression.intercept >= 0 ? '+' : '-'} {Math.abs(regression.intercept).toFixed(4)}</strong>
                <span style={{ marginLeft: '12px', color: regression.r2 > 0.98 ? '#059669' : '#d97706' }}>
                  R² = {regression.r2.toFixed(4)}
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showTrendline}
                  onChange={(e) => setShowTrendline(e.target.checked)}
                />
                Show Trendline
              </label>
            </div>
          )}

          {/* Subdued Legend */}
          {hasData && (
            <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center' }}>
              {seriesList.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#4b5563' }}>
                  <span style={{ width: '8px', height: '3px', backgroundColor: s.color, borderRadius: '1px' }} />
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Manual Coordinate Input & Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Interpolation Solver (only when regression is active) */}
          {hasData && selectedChartType === 'scatter_linear' && regression && (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                Sample Concentration Solver
              </div>
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 10px 0' }}>
                Enter measured absorbance (Y) to solve for sample concentration (X):
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="any"
                  value={unknownY}
                  onChange={(e) => setUnknownY(e.target.value)}
                  placeholder="Enter Y (e.g. 0.45)"
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none' }}
                />
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#166534',
                  minWidth: '70px',
                  textAlign: 'center'
                }}>
                  {calculatedUnknownX !== null ? calculatedUnknownX : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Coordinates Table & Entry Form */}
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                Manual Coordinate Entry
              </div>
              {hasData && (
                <span style={{ fontSize: '11px', color: '#6b7280' }}>
                  {activeSeriesIndex === -1 ? seriesList[0]?.name : seriesList[activeSeriesIndex]?.name}
                </span>
              )}
            </div>

            {/* Input Row */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <input
                type={selectedChartType === 'bar_error' || selectedChartType === 'spider_radar' ? 'text' : 'number'}
                step="any"
                value={newX}
                onChange={(e) => setNewX(e.target.value)}
                placeholder="X / Day"
                style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
              />
              <input
                type="number"
                step="any"
                value={newY}
                onChange={(e) => setNewY(e.target.value)}
                placeholder="Y Value"
                style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
              />
              <input
                type="number"
                step="any"
                value={newSD}
                onChange={(e) => setNewSD(e.target.value)}
                placeholder="±SD"
                style={{ width: '50px', padding: '6px 6px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '12px' }}
              />
              <button
                onClick={handleAddPoint}
                style={{
                  backgroundColor: '#111827',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                + Add
              </button>
            </div>

            {/* Table */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', color: '#6b7280', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>X</th>
                    <th style={{ padding: '6px 8px' }}>Y</th>
                    <th style={{ padding: '6px 8px' }}>±SD</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasData ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>
                        No coordinates recorded yet
                      </td>
                    </tr>
                  ) : (
                    (activeSeriesIndex === -1 ? seriesList[0]?.points || [] : seriesList[activeSeriesIndex]?.points || []).map((p, pIdx) => (
                      <tr key={pIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '6px 8px', fontWeight: '600', color: '#111827' }}>{p.x !== undefined ? p.x : p.label}</td>
                        <td style={{ padding: '6px 8px', color: '#4b5563' }}>{Number(p.y).toFixed(3)}</td>
                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>±{Number(p.sd || 0).toFixed(3)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleRemovePoint(pIdx)}
                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
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

        </div>

      </div>

      <style>{`
        .clean-btn {
          user-select: none;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .clean-btn:hover {
          opacity: 0.92;
        }
        .clean-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
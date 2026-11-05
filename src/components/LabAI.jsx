import { useState } from 'react';

export default function LabAI() {
  // 1. C1V1 = C2V2 Dilution State
  const [c1, setC1] = useState('100');
  const [c2, setC2] = useState('10');
  const [v2, setV2] = useState('50');

  // 2. Molarity / Molecular Weight Solver State
  const [mw, setMw] = useState('58.44'); // NaCl default
  const [targetMolarity, setTargetMolarity] = useState('0.5'); // M
  const [targetVolLiters, setTargetVolLiters] = useState('0.5'); // L

  // 3. PCR MasterMix Scaler State
  const [rxnCount, setRxnCount] = useState('12');
  const [rxnVol, setRxnVol] = useState('25');

  // 4. Centrifuge RPM <-> RCF (g-force) State
  const [rpm, setRpm] = useState('12000');
  const [rotorRadiusCm, setRotorRadiusCm] = useState('8.5');

  // Calculations
  const v1Result = (parseFloat(c1) > 0) ? ((parseFloat(c2) * parseFloat(v2)) / parseFloat(c1)).toFixed(3) : 0;
  const diluentVol = Math.max(0, (parseFloat(v2) || 0) - parseFloat(v1Result)).toFixed(3);

  const requiredMassGrams = (
    (parseFloat(mw) || 0) *
    (parseFloat(targetMolarity) || 0) *
    (parseFloat(targetVolLiters) || 0)
  ).toFixed(4);

  const nWithOverage = ((parseFloat(rxnCount) || 1) * 1.1).toFixed(1); // 10% pipetting overage
  const singleRxnScale = (parseFloat(rxnVol) || 25) / 25;

  const rcfResult = Math.round(
    1.118 * Math.pow(10, -5) * (parseFloat(rotorRadiusCm) || 0) * Math.pow(parseFloat(rpm) || 0, 2)
  );

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      <div style={{ marginBottom: '22px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
          In-Silico Bench Calculators & Protocol Scaler
        </h2>
        <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
          Instant stock dilutions, molarity mass solvers, PCR MasterMix scaling with 10% overage, and rotor RCF conversions
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* 1. C1V1 = C2V2 Stock Dilution Calculator */}
        <div style={cardStyle}>
          <h3 style={titleStyle}>🧪 1. Stock Solution Dilution (C₁V₁ = C₂V₂)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Stock Conc (C₁)</label>
              <input type="number" step="any" value={c1} onChange={(e) => setC1(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Target Conc (C₂)</label>
              <input type="number" step="any" value={c2} onChange={(e) => setC2(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Final Volume (V₂ mL)</label>
              <input type="number" step="any" value={v2} onChange={(e) => setV2(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={resultBoxStyle}>
            <div>Pipette Stock (V₁): <strong style={{ color: '#1b4332', fontSize: '15px' }}>{v1Result} mL</strong></div>
            <div>Add Diluent / Buffer: <strong style={{ color: '#2d6a4f', fontSize: '15px' }}>{diluentVol} mL</strong></div>
          </div>
        </div>

        {/* 2. Molarity Mass Calculator */}
        <div style={cardStyle}>
          <h3 style={titleStyle}>⚖️ 2. Mass-to-Molarity Reagent Weigher</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Formula Weight (g/mol)</label>
              <input type="number" step="any" value={mw} onChange={(e) => setMw(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Desired Molarity (M)</label>
              <input type="number" step="any" value={targetMolarity} onChange={(e) => setTargetMolarity(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Final Volume (Liters)</label>
              <input type="number" step="any" value={targetVolLiters} onChange={(e) => setTargetVolLiters(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={resultBoxStyle}>
            <div>Weigh Dry Chemical on Balance:</div>
            <strong style={{ color: '#1b4332', fontSize: '16px' }}>{requiredMassGrams} g ({(requiredMassGrams * 1000).toFixed(1)} mg)</strong>
          </div>
        </div>

        {/* 3. PCR MasterMix Scaler */}
        <div style={cardStyle}>
          <h3 style={titleStyle}>🧬 3. PCR MasterMix Scaler (+10% Pipetting Margin)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Number of Samples / Tubes</label>
              <input type="number" min="1" value={rxnCount} onChange={(e) => setRxnCount(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Single Reaction Volume (µL)</label>
              <input type="number" step="any" value={rxnVol} onChange={(e) => setRxnVol(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e9ecef', color: '#6c757d' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Component</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>1× Rxn (µL)</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: '#1b4332' }}>MasterMix ({nWithOverage}×)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: '2× Taq / Q5 MasterMix', base: 12.5 },
                { name: 'Forward Primer (10 µM)', base: 1.25 },
                { name: 'Reverse Primer (10 µM)', base: 1.25 },
                { name: 'Template DNA', base: 2.0 },
                { name: 'Nuclease-Free H₂O', base: 8.0 }
              ].map((c, i) => {
                const perRxn = (c.base * singleRxnScale).toFixed(2);
                const total = (c.base * singleRxnScale * parseFloat(nWithOverage)).toFixed(1);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f3f5' }}>
                    <td style={{ padding: '6px 8px', fontWeight: '600' }}>{c.name}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{perRxn} µL</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#2d6a4f' }}>{total} µL</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 4. Centrifuge RPM to RCF (g-force) */}
        <div style={cardStyle}>
          <h3 style={titleStyle}>🌀 4. Centrifuge Rotor Converter (RPM ↔ ×g RCF)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>Rotor Speed (RPM)</label>
              <input type="number" step="100" value={rpm} onChange={(e) => setRpm(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Rotor Radius r_max (cm)</label>
              <input type="number" step="0.1" value={rotorRadiusCm} onChange={(e) => setRotorRadiusCm(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={resultBoxStyle}>
            <div>Relative Centrifugal Force (RCF):</div>
            <strong style={{ color: '#1b4332', fontSize: '18px', fontFamily: 'monospace' }}>{rcfResult.toLocaleString()} × g</strong>
          </div>
          <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '10px', marginBottom: 0 }}>
            Formula: RCF = 1.118 × 10⁻⁵ × r(cm) × RPM²
          </p>
        </div>

      </div>
    </div>
  );
}

const cardStyle = { background: '#ffffff', border: '1px solid #ced4da', borderRadius: '14px', padding: '20px' };
const titleStyle = { margin: '0 0 14px 0', fontSize: '14px', fontWeight: '700', color: '#1b4332' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', boxSizing: 'border-box' };
const resultBoxStyle = { background: '#e8f5e9', border: '1px solid #b2f2bb', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' };
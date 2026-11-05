import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export default function ExperimentDesigner({ currentOrg, user, onStockUpdated }) {
  const [reagents, setReagents] = useState([]);
  const [protocolName, setProtocolName] = useState('');
  const [targetBatchVolume, setTargetBatchVolume] = useState('1');
  const [selectedItems, setSelectedItems] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState('');

  // Pre-load available reagents from the active lab inventory
  useEffect(() => {
    if (!currentOrg?.id) return;
    const q = query(collection(db, 'reagents'), where('labId', '==', currentOrg.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setReagents(list);
    });
    return () => unsubscribe();
  }, [currentOrg?.id]);

  const addReagentToProtocol = (reagentId) => {
    const reagent = reagents.find(r => r.id === reagentId);
    if (!reagent || selectedItems.some(i => i.id === reagentId)) return;
    setSelectedItems(prev => [
      ...prev,
      {
        id: reagent.id,
        name: reagent.name,
        availableStock: reagent.quantity || 0,
        unit: reagent.unit || 'mL',
        amountPerReaction: ''
      }
    ]);
  };

  const removeReagentFromProtocol = (reagentId) => {
    setSelectedItems(prev => prev.filter(i => i.id !== reagentId));
  };

  const updateAmount = (reagentId, amount) => {
    setSelectedItems(prev => prev.map(i => (
      i.id === reagentId ? { ...i, amountPerReaction: amount } : i
    )));
  };

  // Automated Depletion Engine
  const handleExecuteProtocol = async (e) => {
    e.preventDefault();
    if (!protocolName.trim() || selectedItems.length === 0) return;
    setIsExecuting(true);
    setExecutionLog('');

    try {
      const batchMultiplier = parseFloat(targetBatchVolume) || 1;

      // 1. Pre-flight check: Ensure all items have sufficient balance
      for (const item of selectedItems) {
        const requiredTotal = (parseFloat(item.amountPerReaction) || 0) * batchMultiplier;
        if (requiredTotal > item.availableStock) {
          throw new Error(`Insufficient stock for "${item.name}". Required: ${requiredTotal} ${item.unit}, Available: ${item.availableStock} ${item.unit}`);
        }
      }

      // 2. Automated deductions & GLP Audit Log generation
      for (const item of selectedItems) {
        const deductAmount = (parseFloat(item.amountPerReaction) || 0) * batchMultiplier;
        const newBalance = Math.max(0, item.availableStock - deductAmount);

        // Deduct from Firestore Inventory
        await updateDoc(doc(db, 'reagents', item.id), {
          quantity: newBalance
        });

        // Push to GLP Audit Trail
        await addDoc(collection(db, 'audit_trail'), {
          labId: currentOrg.id,
          reagentName: item.name,
          delta: -deductAmount,
          remaining: newBalance,
          unit: item.unit,
          action: 'STOCK_DEDUCT',
          protocol: protocolName.trim(),
          user: user.displayName || user.email.split('@')[0],
          timestamp: serverTimestamp()
        });
      }

      // 3. Document in Lab Notebook ELN automatically
      await addDoc(collection(db, 'lab_notebook'), {
        labId: currentOrg.id,
        title: `Protocol Executed: ${protocolName.trim()}`,
        objective: `Automated assay formulation run by ${user.displayName || user.email}`,
        protocolSteps: selectedItems.map(i => 
          `- ${i.name}: ${(parseFloat(i.amountPerReaction) || 0) * batchMultiplier} ${i.unit}`
        ).join('\n'),
        observations: `Batch multiplier: ${batchMultiplier}x. Inventory successfully deducted.`,
        scientist: user.displayName || user.email,
        createdAt: serverTimestamp()
      });

      setExecutionLog(`✓ Run complete: ${protocolName} executed. Reagents automatically deducted.`);
      setSelectedItems([]);
      setProtocolName('');
      if (onStockUpdated) onStockUpdated();
    } catch (err) {
      setExecutionLog(`❌ Execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #f1f3f5', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1b4332' }}>
            🧪 Protocol & Assay Formulation Designer
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#6c757d' }}>
            Select reagents for your reaction mixture. Stock automatically decrements upon execution.
          </p>
        </div>
        <span style={{ fontSize: '11px', background: '#d8f3dc', color: '#2d6a4f', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
          Auto-Depletion Active
        </span>
      </div>

      <form onSubmit={handleExecuteProtocol}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Experiment / Assay Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. PCR MasterMix Preparation (10 Reactions)"
              value={protocolName}
              onChange={(e) => setProtocolName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Batch Scale (Multiplier)</label>
            <input
              type="number"
              step="any"
              min="1"
              value={targetBatchVolume}
              onChange={(e) => setTargetBatchVolume(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Add Reagent Dropdown */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Add Chemical / Reagent from Lab Inventory</label>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addReagentToProtocol(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
            style={inputStyle}
          >
            <option value="" disabled>-- Select chemical to include in recipe --</option>
            {reagents.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} (Stock: {r.quantity} {r.unit}) - {r.storageTemp}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Aliquots Table */}
        <div style={{ background: '#f8faf9', border: '1px solid #e9ecef', borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#e9ecef', color: '#495057' }}>
                <th style={{ padding: '8px 12px' }}>Reagent</th>
                <th style={{ padding: '8px 12px' }}>In Stock</th>
                <th style={{ padding: '8px 12px' }}>Usage Per Reaction</th>
                <th style={{ padding: '8px 12px' }}>Total Deducted</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#adb5bd' }}>
                    No reagents selected. Pick chemicals from the dropdown above to design your assay.
                  </td>
                </tr>
              ) : (
                selectedItems.map((item) => {
                  const multiplier = parseFloat(targetBatchVolume) || 1;
                  const total = (parseFloat(item.amountPerReaction) || 0) * multiplier;
                  const hasShortage = total > item.availableStock;

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e9ecef', background: hasShortage ? '#fff5f5' : 'transparent' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#212529' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#495057' }}>
                        {item.availableStock} {item.unit}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            step="any"
                            required
                            placeholder="0.0"
                            value={item.amountPerReaction}
                            onChange={(e) => updateAmount(item.id, e.target.value)}
                            style={{ width: '70px', padding: '4px 6px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '12px' }}
                          />
                          <span>{item.unit}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: '700', color: hasShortage ? '#e03131' : '#2d6a4f' }}>
                        {total} {item.unit} {hasShortage ? '(Shortage!)' : ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => removeReagentFromProtocol(item.id)}
                          style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '13px' }}
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

        {/* Execution Status Log */}
        {executionLog && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '14px',
            background: executionLog.startsWith('✓') ? '#d8f3dc' : '#ffe3e3',
            color: executionLog.startsWith('✓') ? '#1b4332' : '#c92a2a'
          }}>
            {executionLog}
          </div>
        )}

        <button
          type="submit"
          disabled={isExecuting || selectedItems.length === 0}
          style={{
            width: '100%',
            background: '#2d6a4f',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 0',
            fontSize: '13px',
            fontWeight: '700',
            cursor: (isExecuting || selectedItems.length === 0) ? 'not-allowed' : 'pointer'
          }}
        >
          {isExecuting ? 'Deducting Stock & Logging Experiment...' : '⚡ Run Protocol & Deduct Inventory'}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none', background: '#ffffff', boxSizing: 'border-box' };
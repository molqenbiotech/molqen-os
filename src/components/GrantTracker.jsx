import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export default function GrantTracker({ currentOrg, user }) {
  const [grants, setGrants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showAddGrantModal, setShowAddGrantModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Grant Form State
  const [grantForm, setGrantForm] = useState({
    name: '',
    grantCode: '',
    fundingAgency: '',
    totalAmount: '',
    currency: '₹',
    deadline: ''
  });

  // New Expense Deduction Form State
  const [expenseForm, setExpenseForm] = useState({
    grantId: '',
    item: '',
    cost: '',
    researcherName: user?.displayName || user?.email?.split('@')[0] || 'Investigator'
  });

  // PI Permission Guard: Only the lab creator, owner, or verified teacher can manage grants
  const isPI = Boolean(
    user && currentOrg && (
      user.email === currentOrg.createdBy ||
      user.uid === currentOrg.ownerUid ||
      currentOrg.role === 'teacher' ||
      currentOrg.role === 'PI'
    )
  );

  // 1. Real-time Synchronization of Grants & Expenses
  useEffect(() => {
    if (!currentOrg?.id) return;

    // Sync Grants
    const qGrants = query(
      collection(db, 'grants'), 
      where('labId', '==', currentOrg.id)
    );
    const unsubGrants = onSnapshot(qGrants, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGrants(docs);
      setLoading(false);
    }, (err) => {
      console.error("Grants sync error:", err);
      setLoading(false);
    });

    // Sync Expenses / Deductions
    const qExpenses = query(
      collection(db, 'grant_expenses'), 
      where('labId', '==', currentOrg.id)
    );
    const unsubExpenses = onSnapshot(qExpenses, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.date || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.date || 0).getTime();
        return timeB - timeA;
      });
      setExpenses(docs);
    }, (err) => {
      console.error("Expenses sync error:", err);
    });

    return () => {
      unsubGrants();
      unsubExpenses();
    };
  }, [currentOrg?.id]);

  // 2. Handle Add Grant (PI Only)
  const handleAddGrant = async (e) => {
    e.preventDefault();
    if (!isPI || !grantForm.name.trim() || !grantForm.totalAmount) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'grants'), {
        labId: currentOrg.id,
        name: grantForm.name.trim(),
        grantCode: grantForm.grantCode.trim().toUpperCase() || `GR-${Math.floor(1000 + Math.random() * 9000)}`,
        fundingAgency: grantForm.fundingAgency.trim() || 'Institutional Research Fund',
        totalAmount: parseFloat(grantForm.totalAmount) || 0,
        spentAmount: 0,
        currency: grantForm.currency || '₹',
        deadline: grantForm.deadline || '2027-12-31',
        createdBy: user?.email || 'admin',
        createdAt: serverTimestamp()
      });

      setGrantForm({
        name: '',
        grantCode: '',
        fundingAgency: '',
        totalAmount: '',
        currency: '₹',
        deadline: ''
      });
      setShowAddGrantModal(false);
    } catch (err) {
      console.error("Failed to add grant:", err);
      alert("Could not register grant. Please verify Firestore access permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Handle Add Expense Deduction (PI or Authorized Lab Member)
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.grantId || !expenseForm.item.trim() || !expenseForm.cost) return;

    const targetGrant = grants.find(g => g.id === expenseForm.grantId);
    if (!targetGrant) return;

    const deductionCost = parseFloat(expenseForm.cost) || 0;
    setIsSubmitting(true);

    try {
      // 1. Log deduction entry
      await addDoc(collection(db, 'grant_expenses'), {
        labId: currentOrg.id,
        grantId: targetGrant.id,
        grantName: targetGrant.name,
        currency: targetGrant.currency,
        item: expenseForm.item.trim(),
        cost: deductionCost,
        researcher: expenseForm.researcherName.trim() || user?.displayName || user?.email?.split('@')[0],
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });

      // 2. Update spent amount on the grant
      const updatedSpent = (targetGrant.spentAmount || 0) + deductionCost;
      await updateDoc(doc(db, 'grants', targetGrant.id), {
        spentAmount: updatedSpent
      });

      setExpenseForm({
        grantId: '',
        item: '',
        cost: '',
        researcherName: user?.displayName || user?.email?.split('@')[0] || 'Investigator'
      });
      setShowAddExpenseModal(false);
    } catch (err) {
      console.error("Deduction error:", err);
      alert("Failed to record deduction: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Handle Delete Grant (PI Only)
  const handleDeleteGrant = async (grantId, grantName) => {
    if (!isPI) return;
    const confirmed = window.confirm(
      `Permanently remove the grant "${grantName}" from this lab core?\n\nThis will remove the budget account from the runway tracker.`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'grants', grantId));
    } catch (err) {
      console.error("Error deleting grant:", err);
      alert("Failed to delete grant: " + err.message);
    }
  };

  const calculatePercentage = (spent, total) => {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.max(0, (spent / total) * 100)).toFixed(1);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Header bar with Role-Gated Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1b4332', margin: 0, letterSpacing: '-0.3px' }}>
              Grant Ledger & Consumables Burn-Rate
            </h2>
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 7px',
              borderRadius: '6px',
              background: '#e8f5e9',
              color: '#2d6a4f',
              border: '1px solid #d8f3dc'
            }}>
              {currentOrg?.name || 'Academic Core'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '13px' }}>
            Real-time consumable deduction tracking mapped directly to verified sponsor accounts.
          </p>
        </div>

        {/* PI GATED CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isPI ? (
            <>
              {grants.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(true)}
                  className="tactile-pill-btn"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #ced4da',
                    color: '#212529',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  💳 Log Deduction
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAddGrantModal(true)}
                className="tactile-action-btn"
                style={{
                  background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(45, 106, 79, 0.25)'
                }}
              >
                + Register New Grant
              </button>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8faf9',
              border: '1px solid #e9ecef',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#6c757d',
              fontWeight: '600'
            }}>
              <span>🔒</span>
              <span>Read-Only View (PI Access Required to Register Grants)</span>
            </div>
          )}
        </div>
      </div>

      {/* Grant Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#868e96', fontSize: '13px' }}>
          Synchronizing verified grant allocations...
        </div>
      ) : grants.length === 0 ? (
        <div style={{
          background: '#ffffff',
          border: '1px dashed #ced4da',
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center',
          marginBottom: '36px'
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: '#e8f5e9',
            color: '#2d6a4f',
            fontSize: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto'
          }}>
            💳
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1b4332', margin: '0 0 6px 0' }}>
            No Active Grants Enrolled
          </h3>
          <p style={{ fontSize: '13px', color: '#6c757d', margin: '0 auto 18px auto', maxWidth: '440px', lineHeight: '1.5' }}>
            {isPI 
              ? 'Register funding sources, seed grants, and sponsored agency allowances to monitor consumable deductions and burn rates.' 
              : 'Your Principal Investigator has not enrolled external grant ledgers for this laboratory core yet.'}
          </p>
          {isPI && (
            <button
              type="button"
              onClick={() => setShowAddGrantModal(true)}
              className="tactile-action-btn"
              style={{
                background: '#2d6a4f',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 18px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              + Register First Lab Grant
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '36px' }}>
          {grants.map((grant) => {
            const total = grant.totalAmount || 0;
            const spent = grant.spentAmount || 0;
            const remaining = Math.max(0, total - spent);
            const percentSpent = calculatePercentage(spent, total);
            const isCritical = percentSpent > 85;

            return (
              <div 
                key={grant.id} 
                className="interactive-stat-card"
                style={{
                  background: '#ffffff',
                  border: isCritical ? '1px solid #ffc9c9' : '1px solid #e9ecef',
                  borderRadius: '14px',
                  padding: '22px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6c757d', fontWeight: '700' }}>
                        {grant.fundingAgency || 'Sponsored Grant'}
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1b4332', lineHeight: '1.4' }}>
                      {grant.name}
                    </h3>
                    <span style={{
                      display: 'inline-block',
                      marginTop: '6px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      background: '#f8faf9',
                      border: '1px solid #e9ecef',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: '#495057'
                    }}>
                      {grant.grantCode}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: isCritical ? '#e03131' : '#2d6a4f', letterSpacing: '-0.3px' }}>
                      {grant.currency || '₹'}{remaining.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#868e96', fontWeight: '500' }}>Available Balance</div>
                    {isPI && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGrant(grant.id, grant.name);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#adb5bd',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginTop: '4px',
                          padding: '2px 4px'
                        }}
                        title="Delete grant account"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Burn-Rate Progress Bar */}
                <div style={{ width: '100%', background: '#e9ecef', height: '8px', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${percentSpent}%`, 
                    background: isCritical 
                      ? 'linear-gradient(90deg, #f03e3e, #e03131)' 
                      : 'linear-gradient(90deg, #40916c, #2d6a4f)',
                    borderRadius: '10px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#6c757d' }}>
                  <span style={{ fontWeight: '600', color: isCritical ? '#e03131' : '#495057' }}>
                    {percentSpent}% Burned ({grant.currency || '₹'}{spent.toLocaleString()})
                  </span>
                  <span>Expires: <strong>{grant.deadline || '2027-12-31'}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Automated Consumable Deductions Ledger */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
            Automated Reagent & Consumable Deductions
          </h3>
          <span style={{ fontSize: '11px', color: '#6c757d' }}>
            Verified GLP Dispatches: <strong>{expenses.length}</strong>
          </span>
        </div>
        
        <div style={{ background: '#ffffff', border: '1px solid #e9ecef', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e9ecef' }}>
                <th style={{ padding: '12px 18px', color: '#495057', fontWeight: '700', fontSize: '12px' }}>Timestamp</th>
                <th style={{ padding: '12px 18px', color: '#495057', fontWeight: '700', fontSize: '12px' }}>Item Logged / Depleted</th>
                <th style={{ padding: '12px 18px', color: '#495057', fontWeight: '700', fontSize: '12px' }}>Authorized Researcher</th>
                <th style={{ padding: '12px 18px', color: '#495057', fontWeight: '700', fontSize: '12px' }}>Grant Source</th>
                <th style={{ padding: '12px 18px', color: '#495057', fontWeight: '700', fontSize: '12px', textAlign: 'right' }}>Charged Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#adb5bd', fontSize: '13px' }}>
                    No deductions logged yet. As experiments and chemical inventory dispatches occur, funding deductions stream here automatically.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => {
                  return (
                    <tr key={expense.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                      <td style={{ padding: '12px 18px', color: '#868e96', fontSize: '12px' }}>
                        {expense.date || 'Recent'}
                      </td>
                      <td style={{ padding: '12px 18px', fontWeight: '600', color: '#212529' }}>
                        {expense.item}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{
                          background: '#e8f5e9',
                          color: '#2d6a4f',
                          border: '1px solid #d8f3dc',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          👤 {expense.researcher}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', color: '#495057', fontSize: '12px' }}>
                        {expense.grantName || 'Institutional Core'}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: '700', color: '#e03131' }}>
                        -{expense.currency || '₹'}{(expense.cost || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: REGISTER NEW GRANT (PI ONLY)                                   */}
      {/* ========================================================================= */}
      {showAddGrantModal && isPI && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30000,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>🏛️</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1b4332' }}>
                  Register Sponsor Grant
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddGrantModal(false)}
                className="tactile-close-btn"
                title="Close"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 16px 0', lineHeight: '1.5' }}>
              Enrolling external grants creates an isolated ledger account for monitoring bench consumables and automated depletion limits.
            </p>

            <form onSubmit={handleAddGrant} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  GRANT / PROJECT TITLE *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Translational Microbiology Core Grant"
                  value={grantForm.name}
                  onChange={(e) => setGrantForm({ ...grantForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    GRANT / SANCTION ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DBT-2026-084"
                    value={grantForm.grantCode}
                    onChange={(e) => setGrantForm({ ...grantForm, grantCode: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    FUNDING AGENCY
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DBT / ICMR / NIH"
                    value={grantForm.fundingAgency}
                    onChange={(e) => setGrantForm({ ...grantForm, fundingAgency: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    CURRENCY
                  </label>
                  <select
                    value={grantForm.currency}
                    onChange={(e) => setGrantForm({ ...grantForm, currency: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }}
                  >
                    <option value="₹">₹ (INR)</option>
                    <option value="$">$ (USD)</option>
                    <option value="€">€ (EUR)</option>
                    <option value="£">£ (GBP)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    TOTAL ALLOCATION AMOUNT *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 500000"
                    value={grantForm.totalAmount}
                    onChange={(e) => setGrantForm({ ...grantForm, totalAmount: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  UTILIZATION DEADLINE
                </label>
                <input
                  type="date"
                  value={grantForm.deadline}
                  onChange={(e) => setGrantForm({ ...grantForm, deadline: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddGrantModal(false)}
                  className="tactile-pill-btn"
                  style={{ background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="tactile-action-btn"
                  style={{
                    background: '#2d6a4f',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Registering...' : 'Enroll Grant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: LOG REAGENT/CONSUMABLE DEDUCTION (PI/TEAM)                      */}
      {/* ========================================================================= */}
      {showAddExpenseModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30000,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>💸</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1b4332' }}>
                  Log Consumable Deduction
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="tactile-close-btn"
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  TARGET GRANT ACCOUNT *
                </label>
                <select
                  value={expenseForm.grantId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, grantId: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="">Select funding source...</option>
                  {grants.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.currency}{Math.max(0, (g.totalAmount || 0) - (g.spentAmount || 0)).toLocaleString()} remaining)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  ITEM / REAGENT CHARGED *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Platinum Taq DNA Polymerase (500 rxns)"
                  value={expenseForm.item}
                  onChange={(e) => setExpenseForm({ ...expenseForm, item: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  COST AMOUNT *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 7500"
                  value={expenseForm.cost}
                  onChange={(e) => setExpenseForm({ ...expenseForm, cost: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  RESEARCHER NAME
                </label>
                <input
                  type="text"
                  value={expenseForm.researcherName}
                  onChange={(e) => setExpenseForm({ ...expenseForm, researcherName: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="tactile-pill-btn"
                  style={{ background: '#f8faf9', border: '1px solid #ced4da', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="tactile-action-btn"
                  style={{
                    background: '#2d6a4f',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Deducting...' : 'Deduct from Grant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

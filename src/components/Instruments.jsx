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

export default function Instruments({ currentOrg, user }) {
  const [instruments, setInstruments] = useState([]);
  const [bookings, setBookings] = useState([]);

  // New Instrument Registration State
  const [showAddInst, setShowAddInst] = useState(false);
  const [instName, setInstName] = useState('');
  const [instLocation, setInstLocation] = useState('');
  const [calibrationDue, setCalibrationDue] = useState('');
  const [isAddingInst, setIsAddingInst] = useState(false);

  // Booking Form State
  const [selectedInstrument, setSelectedInstrument] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('09:00 - 11:00');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync custom lab instruments & reservations from Firestore
  useEffect(() => {
    if (!currentOrg?.id) return;

    const qInst = query(collection(db, 'lab_instruments'), where('labId', '==', currentOrg.id));
    const unsubInst = onSnapshot(qInst, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setInstruments(list);
      if (list.length > 0) {
        setSelectedInstrument(prev => {
          const exists = list.some(i => i.name === prev);
          return exists ? prev : list[0].name;
        });
      } else {
        setSelectedInstrument('');
      }
    });

    const qBookings = query(collection(db, 'equipment_bookings'), where('labId', '==', currentOrg.id));
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubInst();
      unsubBookings();
    };
  }, [currentOrg?.id]);

  // Add a New Custom Instrument to Lab Inventory
  const handleAddInstrument = async (e) => {
    e.preventDefault();
    if (!instName.trim() || !currentOrg?.id) return;
    setIsAddingInst(true);

    try {
      await addDoc(collection(db, 'lab_instruments'), {
        labId: currentOrg.id,
        name: instName.trim(),
        location: instLocation.trim() || 'Main Bench',
        calibrationDue: calibrationDue || 'Not scheduled',
        status: 'Operational',
        addedBy: user?.displayName || user?.email?.split('@')[0] || 'Researcher',
        createdAt: serverTimestamp()
      });
      setInstName('');
      setInstLocation('');
      setCalibrationDue('');
      setShowAddInst(false);
    } catch (err) {
      console.error('Error adding instrument:', err);
    } finally {
      setIsAddingInst(false);
    }
  };

  // Toggle Operational vs Out of Service Flag
  const handleToggleMaintenance = async (inst) => {
    const nextStatus = inst.status === 'Out of Service' ? 'Operational' : 'Out of Service';
    try {
      await updateDoc(doc(db, 'lab_instruments', inst.id), {
        status: nextStatus,
        flaggedBy: user?.displayName || user?.email?.split('@')[0],
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Status toggle error:', err);
    }
  };

  // Delete an Instrument
  const handleDeleteInstrument = async (id, name) => {
    if (window.confirm(`Remove "${name}" from this lab's equipment registry?`)) {
      await deleteDoc(doc(db, 'lab_instruments', id));
    }
  };

  // Book an Instrument Time Slot
  const handleBook = async (e) => {
    e.preventDefault();
    if (!selectedInstrument || !date || !purpose.trim()) return;

    const targetInst = instruments.find(i => i.name === selectedInstrument);
    if (targetInst?.status === 'Out of Service') {
      alert(`⚠️ Cannot reserve "${selectedInstrument}". It is currently flagged Out of Service for calibration or maintenance.`);
      return;
    }

    const conflict = bookings.find(
      b => b.instrument === selectedInstrument && b.date === date && b.timeSlot === timeSlot
    );
    if (conflict) {
      alert(`⚠️ Slot Conflict: ${selectedInstrument} is already booked on ${date} (${timeSlot}) by ${conflict.researcher}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'equipment_bookings'), {
        instrument: selectedInstrument,
        date,
        timeSlot,
        purpose: purpose.trim(),
        researcher: user?.displayName || user?.email?.split('@')[0] || 'Researcher',
        labId: currentOrg.id,
        createdAt: serverTimestamp()
      });
      setPurpose('');
    } catch (err) {
      console.error('Booking error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px' }}>
      
      {/* Top Header & Add Instrument Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
            Equipment Scheduler & Calibration Registry
          </h2>
          <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
            Register your lab's instruments, flag maintenance lockouts, and reserve run slots for <strong style={{ color: '#2d6a4f' }}>{currentOrg?.name || 'Active Lab'}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddInst(!showAddInst)}
          style={{
            background: showAddInst ? '#f8faf9' : '#2d6a4f',
            color: showAddInst ? '#495057' : '#ffffff',
            border: showAddInst ? '1px solid #ced4da' : 'none',
            borderRadius: '8px',
            padding: '9px 16px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          {showAddInst ? '✕ Close Form' : '+ Add Lab Instrument'}
        </button>
      </div>

      {/* Collapsible Form for Teachers / Students to Register New Equipment */}
      {showAddInst && (
        <form
          onSubmit={handleAddInstrument}
          style={{
            background: '#f8faf9',
            border: '1px solid #b2f2bb',
            borderRadius: '12px',
            padding: '18px 20px',
            marginBottom: '22px',
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr 1fr auto',
            gap: '12px',
            alignItems: 'end'
          }}
        >
          <div>
            <label style={labelStyle}>Instrument Name & Model *</label>
            <input
              type="text"
              required
              placeholder="e.g. Bio-Rad T100 Thermal Cycler"
              value={instName}
              onChange={(e) => setInstName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Room / Bench Location</label>
            <input
              type="text"
              placeholder="e.g. Wet Lab Bay 2"
              value={instLocation}
              onChange={(e) => setInstLocation(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Next GLP Calibration Date</label>
            <input
              type="date"
              value={calibrationDue}
              onChange={(e) => setCalibrationDue(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={isAddingInst}
            style={{
              background: '#2d6a4f',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '9px 18px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              height: '35px'
            }}
          >
            {isAddingInst ? 'Saving...' : 'Save Instrument'}
          </button>
        </form>
      )}

      {/* 1. Custom Instrument Cards Grid */}
      {instruments.length === 0 ? (
        <div style={{
          background: '#ffffff',
          border: '1px dashed #ced4da',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '26px', marginBottom: '8px' }}>🔬</div>
          <strong style={{ fontSize: '14px', color: '#1b4332' }}>No Instruments Registered Yet</strong>
          <p style={{ fontSize: '12px', color: '#6c757d', margin: '4px 0 14px 0' }}>
            Click "+ Add Lab Instrument" above so teachers or students can register your lab's actual equipment and flag maintenance states.
          </p>
          <button
            type="button"
            onClick={() => setShowAddInst(true)}
            style={{
              background: '#e8f5e9',
              color: '#2d6a4f',
              border: '1px solid #b2f2bb',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            + Register First Instrument
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {instruments.map((inst) => {
            const isDown = inst.status === 'Out of Service';

            return (
              <div
                key={inst.id}
                style={{
                  background: '#ffffff',
                  border: `1px solid ${isDown ? '#ffc9c9' : '#e9ecef'}`,
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#212529', display: 'block' }}>{inst.name}</strong>
                      <span style={{ fontSize: '10px', color: '#6c757d' }}>📍 {inst.location || 'Main Lab'}</span>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      background: isDown ? '#fff5f5' : '#d8f3dc',
                      color: isDown ? '#e03131' : '#2d6a4f'
                    }}>
                      {isDown ? '🔧 Out of Service' : '● Operational'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#495057', marginTop: '8px' }}>
                    Next Calibration: <strong>{inst.calibrationDue || 'Not set'}</strong>
                  </div>
                  {inst.flaggedBy && (
                    <div style={{ fontSize: '10px', color: '#868e96', marginTop: '2px' }}>
                      Last updated by {inst.flaggedBy}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f3f5', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleMaintenance(inst)}
                    style={{
                      background: isDown ? '#e8f5e9' : '#f8faf9',
                      border: `1px solid ${isDown ? '#b2f2bb' : '#ced4da'}`,
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: isDown ? '#2d6a4f' : '#495057',
                      cursor: 'pointer'
                    }}
                  >
                    {isDown ? '✓ Flag Operational' : '🔧 Flag Out of Service'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteInstrument(inst.id, inst.name)}
                    title="Delete instrument"
                    style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Reservation Form */}
      <form
        onSubmit={handleBook}
        style={{
          background: '#ffffff',
          border: '1px solid #ced4da',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr auto',
          gap: '12px',
          alignItems: 'end'
        }}
      >
        <div>
          <label style={labelStyle}>Select Instrument *</label>
          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
            disabled={instruments.length === 0}
            style={inputStyle}
          >
            {instruments.length === 0 ? (
              <option value="">-- Add an instrument above first --</option>
            ) : (
              instruments.map(i => (
                <option key={i.id} value={i.name}>
                  {i.name} {i.status === 'Out of Service' ? '(OUT OF SERVICE)' : ''}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Run Date *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Time Window</label>
          <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} style={inputStyle}>
            <option value="09:00 - 11:00">09:00 - 11:00</option>
            <option value="11:00 - 13:00">11:00 - 13:00</option>
            <option value="14:00 - 16:00">14:00 - 16:00</option>
            <option value="16:00 - 18:00">16:00 - 18:00</option>
            <option value="Overnight Run">Overnight Run</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Assay / Protocol Purpose *</label>
          <input
            type="text"
            required
            placeholder="e.g. 16S PCR Amplification"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || instruments.length === 0}
          style={{
            background: instruments.length === 0 ? '#adb5bd' : '#2d6a4f',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '9px 16px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: instruments.length === 0 ? 'not-allowed' : 'pointer',
            height: '35px'
          }}
        >
          + Reserve Slot
        </button>
      </form>

      {/* 3. Bookings Ledger */}
      <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8faf9', borderBottom: '1px solid #e9ecef', color: '#6c757d' }}>
              <th style={thStyle}>Instrument</th>
              <th style={thStyle}>Date & Time Slot</th>
              <th style={thStyle}>Experiment Purpose</th>
              <th style={thStyle}>Booked By</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#adb5bd' }}>
                  No active equipment reservations scheduled.
                </td>
              </tr>
            ) : (
              bookings.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f1f3f5' }}>
                  <td style={{ ...tdStyle, fontWeight: '700', color: '#1b4332' }}>{b.instrument}</td>
                  <td style={tdStyle}>
                    <span style={{ background: '#e8f5e9', color: '#2d6a4f', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                      📅 {b.date} • {b.timeSlot}
                    </span>
                  </td>
                  <td style={tdStyle}>{b.purpose}</td>
                  <td style={tdStyle}><strong>{b.researcher}</strong></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => deleteDoc(doc(db, 'equipment_bookings', b.id))}
                      style={{ background: 'transparent', border: 'none', color: '#adb5bd', cursor: 'pointer', fontSize: '14px' }}
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
  );
}

const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#495057', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '12px', outline: 'none', background: '#ffffff', boxSizing: 'border-box' };
const thStyle = { padding: '12px 16px', fontWeight: '600', fontSize: '12px' };
const tdStyle = { padding: '12px 16px', verticalAlign: 'middle' };
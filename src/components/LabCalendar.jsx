import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

// Stream Category Visual Configuration
const STREAM_CONFIG = {
  Booking: {
    label: 'Instrument Booking',
    badge: 'Equipment',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: '⏱️',
    streamGroup: 'equipment'
  },
  Deadline: {
    label: 'Project & Grant Deadline',
    badge: 'Deadline',
    color: '#6d28d9',
    bg: '#faf5ff',
    border: '#ddd6fe',
    icon: '🎯',
    streamGroup: 'deadline'
  },
  Incubation: {
    label: 'Bench Protocol Reminder',
    badge: 'Incubation',
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    icon: '🧫',
    streamGroup: 'protocol'
  },
  Audit: {
    label: 'Safety & Compliance Alert',
    badge: 'Compliance',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: '⚠️',
    streamGroup: 'safety'
  },
  Expiry: {
    label: 'Reagent Expiration Alert',
    badge: 'Chemical Expiry',
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fecaca',
    icon: '🧪',
    streamGroup: 'safety'
  },
  General: {
    label: 'General Lab Schedule',
    badge: 'General',
    color: '#334155',
    bg: '#f8fafc',
    border: '#cbd5e1',
    icon: '📌',
    streamGroup: 'general'
  }
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function LabCalendar({ currentLab, user, role = 'student' }) {
  const isPI = role === 'faculty' || role === 'pi' || role === 'teacher';

  // Calendar Navigation State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [todayKey] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  const [activeView, setActiveView] = useState('month'); // 'month' | 'week' | 'agenda'
  const [activeStreamFilter, setActiveStreamFilter] = useState('ALL'); // 'ALL' | 'equipment' | 'deadline' | 'protocol' | 'safety'
  const [searchQuery, setSearchQuery] = useState('');

  // Selected date for day preview & quick scheduling
  const [selectedDayKey, setSelectedDayKey] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Modal State for New Event / Reminder
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalForm, setModalForm] = useState({
    title: '',
    category: 'Incubation',
    date: selectedDayKey,
    time: '09:00',
    isAllDay: false,
    linkedItem: '',
    priority: 'Medium',
    assignee: user?.displayName || user?.email?.split('@')[0] || 'Researcher',
    notes: ''
  });

  // Data streams state
  const [customEvents, setCustomEvents] = useState([]);
  const [equipmentBookings, setEquipmentBookings] = useState([]);
  const [reagentExpiries, setReagentExpiries] = useState([]);
  const [grantDeadlines, setGrantDeadlines] = useState([]);
  const [loading, setLoading] = useState(false);

  // Synchronize modal default date with selected day key
  const openAddModalWithDate = useCallback((dayKey) => {
    setModalForm((prev) => ({
      ...prev,
      date: dayKey || selectedDayKey,
      title: '',
      notes: '',
      linkedItem: ''
    }));
    setShowAddModal(true);
  }, [selectedDayKey]);

  // =========================================================================
  // REAL-TIME FIRESTORE MULTI-STREAM SYNCHRONIZATION
  // =========================================================================
  useEffect(() => {
    if (!currentLab?.id) return;

    // 1. Custom Calendar Events Stream (labs/{currentLab.id}/calendar_events)
    const eventsRef = collection(db, 'labs', currentLab.id, 'calendar_events');
    const unsubEvents = onSnapshot(eventsRef, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        isCustom: true,
        ...docSnap.data()
      }));
      setCustomEvents(items);
      setLoading(false);
    }, (err) => {
      console.warn('Custom calendar events sync notice:', err);
      setLoading(false);
    });

    // 2. Equipment Bookings Stream (equipment_bookings where labId == currentLab.id)
    const bookingsRef = collection(db, 'equipment_bookings');
    const qBookings = query(bookingsRef, where('labId', '==', currentLab.id));
    const unsubBookings = onSnapshot(qBookings, (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: `booking_${docSnap.id}`,
          title: `${d.instrument || 'Instrument Booking'}: ${d.purpose || 'Reserved'}`,
          category: 'Booking',
          date: d.date || '',
          time: d.timeSlot || '09:00 - 10:00',
          assignee: d.researcher || 'Bench Team',
          linkedItem: d.instrument || 'Apparatus',
          priority: 'High',
          notes: d.purpose || '',
          isSystemAggregated: true
        };
      });
      setEquipmentBookings(items);
    }, (err) => {
      console.warn('Equipment bookings calendar sync notice:', err);
    });

    // 3. Reagents Expiry Stream (reagents where labId == currentLab.id)
    const reagentsRef = collection(db, 'reagents');
    const qReagents = query(reagentsRef, where('labId', '==', currentLab.id));
    const unsubReagents = onSnapshot(qReagents, (snapshot) => {
      const items = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.expiryDate) {
          items.push({
            id: `expiry_${docSnap.id}`,
            title: `Expiry: ${d.name} (${d.quantity} ${d.unit || 'units'})`,
            category: 'Expiry',
            date: d.expiryDate,
            time: '08:00',
            isAllDay: true,
            assignee: 'Safety Officer',
            linkedItem: `${d.name} [Lot #${d.lotNumber || 'N/A'}]`,
            priority: 'High',
            notes: `Storage: ${d.storage || 'Room Temp'} | Hazard: ${d.hazard || 'None'}`,
            isSystemAggregated: true
          });
        }
      });
      setReagentExpiries(items);
    }, (err) => {
      console.warn('Reagent expiry calendar sync notice:', err);
    });

    // 4. Grants & Milestones Stream (grants where labId == currentLab.id)
    const grantsRef = collection(db, 'grants');
    const qGrants = query(grantsRef, where('labId', '==', currentLab.id));
    const unsubGrants = onSnapshot(qGrants, (snapshot) => {
      const items = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.period || d.deadline || d.renewalDate) {
          const targetDate = d.deadline || d.renewalDate || d.period;
          items.push({
            id: `grant_${docSnap.id}`,
            title: `Grant Milestone: ${d.title || 'Institutional Grant'}`,
            category: 'Deadline',
            date: targetDate,
            time: '17:00',
            isAllDay: true,
            assignee: d.pi || 'Principal Investigator',
            linkedItem: `${d.agency || 'Agency'} Funding ($${Number(d.fundingAmount || 0).toLocaleString()})`,
            priority: 'High',
            notes: `Audit period: ${d.period || 'Fiscal'} | Reference: ${d.grantNumber || d.id}`,
            isSystemAggregated: true
          });
        }
      });
      setGrantDeadlines(items);
    }, (err) => {
      console.warn('Grants calendar sync notice:', err);
    });

    return () => {
      unsubEvents();
      unsubBookings();
      unsubReagents();
      unsubGrants();
    };
  }, [currentLab?.id]);

  // =========================================================================
  // COMBINE & FILTER ALL STREAMS
  // =========================================================================
  const allEvents = useMemo(() => {
    return [
      ...customEvents,
      ...equipmentBookings,
      ...reagentExpiries,
      ...grantDeadlines
    ].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [customEvents, equipmentBookings, reagentExpiries, grantDeadlines]);

  // Filtered by Category Stream & Search Query
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      const config = STREAM_CONFIG[ev.category] || STREAM_CONFIG.General;
      if (activeStreamFilter !== 'ALL' && config.streamGroup !== activeStreamFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const titleMatch = ev.title?.toLowerCase().includes(queryLower);
        const itemMatch = ev.linkedItem?.toLowerCase().includes(queryLower);
        const assigneeMatch = ev.assignee?.toLowerCase().includes(queryLower);
        const notesMatch = ev.notes?.toLowerCase().includes(queryLower);
        return titleMatch || itemMatch || assigneeMatch || notesMatch;
      }
      return true;
    });
  }, [allEvents, activeStreamFilter, searchQuery]);

  // Group events by Date Key (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach((ev) => {
      if (!ev.date) return;
      if (!map.has(ev.date)) {
        map.set(ev.date, []);
      }
      map.get(ev.date).push(ev);
    });
    return map;
  }, [filteredEvents]);

  // =========================================================================
  // MONTH & WEEK DATE HELPERS
  // =========================================================================
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayJump = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayKey(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    );
  };

  // Generate Month Grid Days
  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
      const key = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
      days.push({
        date: prevDate,
        dateKey: key,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false
      });
    }

    // Days of current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const thisDate = new Date(year, month, i);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: thisDate,
        dateKey: key,
        dayNumber: i,
        isCurrentMonth: true
      });
    }

    // Trailing days from next month to fill grid
    const totalSlots = Math.ceil(days.length / 7) * 7;
    const trailingCount = totalSlots - days.length;
    for (let i = 1; i <= trailingCount; i++) {
      const nextDate = new Date(year, month + 1, i);
      const key = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: nextDate,
        dateKey: key,
        dayNumber: i,
        isCurrentMonth: false
      });
    }

    return days;
  }, [year, month]);

  // Current Week Days (for Week View)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day; // Sunday of this week

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(curr.setDate(diff + i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        dateKey: key,
        dayName: DAYS_OF_WEEK[i],
        dayNumber: d.getDate()
      });
    }
    return days;
  }, [currentDate]);

  // Events on selected day
  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(selectedDayKey) || [];
  }, [eventsByDate, selectedDayKey]);

  // =========================================================================
  // CREATE EVENT HANDLER
  // =========================================================================
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!modalForm.title.trim()) {
      alert('Please enter an event title.');
      return;
    }
    if (!currentLab?.id) {
      alert('Please select an active laboratory core.');
      return;
    }

    setIsSubmitting(true);
    try {
      const eventPayload = {
        title: modalForm.title.trim(),
        category: modalForm.category,
        date: modalForm.date,
        time: modalForm.time || '09:00',
        isAllDay: modalForm.isAllDay,
        linkedItem: modalForm.linkedItem.trim(),
        priority: modalForm.priority,
        assignee: modalForm.assignee.trim(),
        notes: modalForm.notes.trim(),
        labId: currentLab.id,
        author: user?.displayName || user?.email || 'Investigator',
        authorUid: user?.uid,
        createdAt: serverTimestamp()
      };

      // 1. Nested subcollection path
      await addDoc(collection(db, 'labs', currentLab.id, 'calendar_events'), eventPayload);

      // 2. Also persist to top-level collection for universal indexing
      try {
        await addDoc(collection(db, 'calendar_events'), eventPayload);
      } catch {
        // Fallback safely if top-level rule differs
      }

      setShowAddModal(false);
      setModalForm({
        title: '',
        category: 'Incubation',
        date: selectedDayKey,
        time: '09:00',
        isAllDay: false,
        linkedItem: '',
        priority: 'Medium',
        assignee: user?.displayName || user?.email?.split('@')[0] || 'Researcher',
        notes: ''
      });
    } catch (err) {
      console.error('Error saving calendar event:', err);
      alert('Failed to register calendar reminder: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomEvent = async (evId) => {
    if (!window.confirm('Remove this custom reminder from the laboratory master schedule?')) return;
    try {
      await deleteDoc(doc(db, 'labs', currentLab.id, 'calendar_events', evId));
    } catch (err) {
      console.error('Error deleting calendar event:', err);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 24px 48px' }}>
      
      {/* 1. SUITE HEADER & TELEMETRY STRIP */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '20px',
          marginBottom: '20px',
          borderBottom: '1px solid #E2E8F0'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>📅</span>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.3px', margin: 0 }}>
              Master Laboratory Calendar & Schedules
            </h1>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '12px',
                background: '#ecfdf5',
                color: '#065f46',
                fontWeight: '700',
                border: '1px solid #a7f3d0'
              }}
            >
              ● Synchronized Core: {currentLab?.name || 'Active Lab'} ({isPI ? 'Faculty Core' : 'Researcher View'})
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
            Real-time schedule aggregating equipment reservations, incubation checkpoints, chemical expiry, and grant deadlines.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => openAddModalWithDate(selectedDayKey)}
            className="tactile-action-btn"
            style={{
              background: '#2d6a4f',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>+</span>
            <span>New Reminder / Deadline</span>
          </button>
        </div>
      </div>

      {/* 2. MULTI-STREAM LEGEND & STREAM FILTER BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#FFFFFF',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {/* Stream Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginRight: '4px' }}>
            Filter Streams:
          </span>
          {[
            { id: 'ALL', label: 'All Streams', count: allEvents.length },
            { id: 'equipment', label: '⏱️ Equipment Bookings', count: equipmentBookings.length },
            { id: 'deadline', label: '🎯 Project Deadlines', count: grantDeadlines.length },
            { id: 'protocol', label: '🧫 Incubations & Runs', count: customEvents.filter(c => c.category === 'Incubation').length },
            { id: 'safety', label: '⚠️ Safety & Expiry', count: reagentExpiries.length + customEvents.filter(c => c.category === 'Audit').length }
          ].map((stream) => (
            <button
              key={stream.id}
              type="button"
              onClick={() => setActiveStreamFilter(stream.id)}
              style={{
                background: activeStreamFilter === stream.id ? '#0F172A' : '#F8FAFC',
                color: activeStreamFilter === stream.id ? '#FFFFFF' : '#475569',
                border: activeStreamFilter === stream.id ? '1px solid #0F172A' : '1px solid #E2E8F0',
                borderRadius: '20px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{stream.label}</span>
              <span
                style={{
                  background: activeStreamFilter === stream.id ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                  color: activeStreamFilter === stream.id ? '#FFFFFF' : '#64748B',
                  borderRadius: '10px',
                  padding: '1px 5px',
                  fontSize: '10px'
                }}
              >
                {stream.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search calendar events or items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              width: '240px',
              background: '#FFFFFF'
            }}
          />
        </div>
      </div>

      {/* 3. CALENDAR VIEW CONTROLS & DATE NAVIGATOR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{ background: 'transparent', border: 'none', padding: '7px 12px', cursor: 'pointer', fontSize: '13px' }}
              title="Previous Month"
            >
              ◀
            </button>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', minWidth: '150px', textAlign: 'center' }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{ background: 'transparent', border: 'none', padding: '7px 12px', cursor: 'pointer', fontSize: '13px' }}
              title="Next Month"
            >
              ▶
            </button>
          </div>

          <button
            type="button"
            onClick={handleTodayJump}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            Today
          </button>
        </div>

        {/* View Switcher: Month / Week / Agenda */}
        <div style={{ display: 'flex', background: '#E2E8F0', padding: '3px', borderRadius: '8px' }}>
          {[
            { id: 'month', label: 'Month View' },
            { id: 'week', label: 'Week View' },
            { id: 'agenda', label: 'Agenda & List' }
          ].map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              style={{
                background: activeView === view.id ? '#FFFFFF' : 'transparent',
                color: activeView === view.id ? '#0F172A' : '#64748B',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: activeView === view.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. MAIN CALENDAR VIEWPORT */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⌛</div>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>Synchronizing Laboratory Schedules...</div>
        </div>
      ) : activeView === 'month' ? (
        /* ======================== MONTH VIEW ======================== */
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}
        >
          {/* Day of Week Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Month Matrix Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {monthDays.map((cell, idx) => {
              const dayEvents = eventsByDate.get(cell.dateKey) || [];
              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDayKey;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayKey(cell.dateKey)}
                  style={{
                    minHeight: '115px',
                    padding: '8px',
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid #F1F5F9' : 'none',
                    borderBottom: '1px solid #F1F5F9',
                    background: isSelected ? '#F0FDF4' : cell.isCurrentMonth ? '#FFFFFF' : '#FAFBFC',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  {/* Date Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        fontSize: '12px',
                        fontWeight: isToday ? '800' : '600',
                        background: isToday ? '#10B981' : isSelected ? '#2D6A4F' : 'transparent',
                        color: isToday || isSelected ? '#FFFFFF' : cell.isCurrentMonth ? '#0F172A' : '#94A3B8'
                      }}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Quick Add icon on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddModalWithDate(cell.dateKey);
                      }}
                      title={`Add reminder for ${cell.dateKey}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '1px 4px'
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Event Chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '78px', overflowY: 'hidden' }}>
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cfg = STREAM_CONFIG[ev.category] || STREAM_CONFIG.General;
                      return (
                        <div
                          key={ev.id}
                          title={`${ev.title} (${ev.time || 'All Day'})`}
                          style={{
                            background: cfg.bg,
                            color: cfg.color,
                            border: `1px solid ${cfg.border}`,
                            borderRadius: '4px',
                            padding: '2px 5px',
                            fontSize: '10px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{cfg.icon}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', paddingLeft: '4px' }}>
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeView === 'week' ? (
        /* ======================== WEEK VIEW ======================== */
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            {weekDays.map((d) => {
              const isToday = d.dateKey === todayKey;
              return (
                <div key={d.dateKey} style={{ padding: '12px', textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                    {d.dayName}
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      width: '28px',
                      height: '28px',
                      lineHeight: '28px',
                      borderRadius: '50%',
                      fontSize: '14px',
                      fontWeight: '800',
                      marginTop: '4px',
                      background: isToday ? '#10B981' : 'transparent',
                      color: isToday ? '#FFFFFF' : '#0F172A'
                    }}
                  >
                    {d.dayNumber}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: '400px' }}>
            {weekDays.map((d) => {
              const dayEvents = eventsByDate.get(d.dateKey) || [];
              return (
                <div
                  key={d.dateKey}
                  style={{
                    padding: '10px 8px',
                    borderRight: '1px solid #F1F5F9',
                    background: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openAddModalWithDate(d.dateKey)}
                    style={{
                      background: '#F8FAFC',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '6px',
                      padding: '4px 0',
                      fontSize: '11px',
                      color: '#64748B',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Run
                  </button>

                  {dayEvents.map((ev) => {
                    const cfg = STREAM_CONFIG[ev.category] || STREAM_CONFIG.General;
                    return (
                      <div
                        key={ev.id}
                        style={{
                          background: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                          borderRadius: '6px',
                          padding: '8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '800', color: cfg.color }}>
                            {cfg.icon} {ev.time || 'All Day'}
                          </span>
                          <span style={{ fontSize: '9px', background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: '4px', fontWeight: '700' }}>
                            {ev.priority || 'Medium'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginTop: '4px' }}>
                          {ev.title}
                        </div>
                        {ev.linkedItem && (
                          <div style={{ fontSize: '10px', color: '#64748B', marginTop: '3px' }}>
                            🔗 {ev.linkedItem}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                          👤 {ev.assignee}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ======================== AGENDA / LIST VIEW ======================== */
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Chronological Bench Agenda ({filteredEvents.length} Scheduled Events)
            </h2>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                No scheduled laboratory runs or deadlines match your filter.
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const cfg = STREAM_CONFIG[ev.category] || STREAM_CONFIG.General;
                return (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 16px',
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: '8px',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
                      <span style={{ fontSize: '20px' }}>{cfg.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                            {ev.title}
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#FFFFFF',
                              color: cfg.color,
                              fontWeight: '700',
                              border: `1px solid ${cfg.border}`
                            }}
                          >
                            {cfg.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          📅 {ev.date} {ev.time ? `at ${ev.time}` : '(All Day)'} {ev.linkedItem ? `• 🔗 ${ev.linkedItem}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#334155' }}>
                          👤 {ev.assignee || 'Unassigned'}
                        </div>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: '700',
                            color: ev.priority === 'High' ? '#DC2626' : '#2563EB'
                          }}
                        >
                          ● {ev.priority || 'Medium'} Priority
                        </span>
                      </div>

                      {(ev.isCustom || isPI) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomEvent(ev.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '4px'
                          }}
                          title="Delete Reminder"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. SELECTED DAY EVENT PREVIEW DRAWER (When month view day clicked) */}
      {activeView === 'month' && selectedDayKey && (
        <div
          style={{
            marginTop: '20px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Schedules for {selectedDayKey} {selectedDayKey === todayKey ? '(Today)' : ''}
              </h3>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0' }}>
                {selectedDayEvents.length} items logged across bench streams
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAddModalWithDate(selectedDayKey)}
              className="tactile-pill-btn"
              style={{
                background: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              + Add Event on this Date
            </button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#94A3B8', padding: '12px 0' }}>
              No reservations, incubation checkpoints, or deadlines scheduled for this date.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {selectedDayEvents.map((ev) => {
                const cfg = STREAM_CONFIG[ev.category] || STREAM_CONFIG.General;
                return (
                  <div
                    key={ev.id}
                    style={{
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      borderRadius: '8px',
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: cfg.color }}>
                        {cfg.icon} {cfg.badge}
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '600' }}>
                        {ev.time || 'All Day'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginTop: '4px' }}>
                      {ev.title}
                    </div>
                    {ev.linkedItem && (
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        🔗 {ev.linkedItem}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                      👤 Assigned: {ev.assignee}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. MODAL: ADD REMINDER / DEADLINE */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              width: '500px',
              maxWidth: '92vw',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid #E2E8F0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📅</span>
                <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Add Schedule Reminder / Deadline
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="tactile-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  Event / Milestone Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 16h Over-night Bacterial Culture Readout"
                  value={modalForm.title}
                  onChange={(e) => setModalForm({ ...modalForm, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                />
              </div>

              {/* Stream Category & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Category Stream
                  </label>
                  <select
                    value={modalForm.category}
                    onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                  >
                    <option value="Incubation">🧫 Bench Protocol / Incubation</option>
                    <option value="Booking">⏱️ Equipment Booking</option>
                    <option value="Deadline">🎯 Project / Grant Deadline</option>
                    <option value="Audit">⚠️ Safety / Autoclave Compliance</option>
                    <option value="General">📌 General Lab Meeting / Schedule</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Priority Level
                  </label>
                  <select
                    value={modalForm.priority}
                    onChange={(e) => setModalForm({ ...modalForm, priority: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                  >
                    <option value="High">🔴 High Urgency</option>
                    <option value="Medium">🟡 Medium Priority</option>
                    <option value="Low">🟢 Low Priority</option>
                  </select>
                </div>
              </div>

              {/* Date & Time Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Target Date *
                  </label>
                  <input
                    type="date"
                    value={modalForm.date}
                    onChange={(e) => setModalForm({ ...modalForm, date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Time Slot
                  </label>
                  <input
                    type="time"
                    value={modalForm.time}
                    onChange={(e) => setModalForm({ ...modalForm, time: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* Linked Module/Item & Assignee */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Linked Item / Chemical / Apparatus
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Centrifuge 5424R or HeLa Stock"
                    value={modalForm.linkedItem}
                    onChange={(e) => setModalForm({ ...modalForm, linkedItem: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Assignee / Lead Researcher
                  </label>
                  <input
                    type="text"
                    value={modalForm.assignee}
                    onChange={(e) => setModalForm({ ...modalForm, assignee: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* Bench Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  Bench Notes / Special Precautions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Spin at 4°C, add ampicillin 100 µg/mL before inoculation."
                  value={modalForm.notes}
                  onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="tactile-action-btn"
                  style={{
                    background: '#2D6A4F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Register Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

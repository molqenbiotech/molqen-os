import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function WhatsAppBot({ currentOrg, _user }) {
  const [inventory, setInventory] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [phone, setPhone] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => [
    {
      sender: 'bot',
      text: '👋 Hi! I am the MOLQEN WhatsApp Bot. Ask me about live chemical stocks, low-stock alerts, or instrument bookings!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Sync live inventory and equipment bookings from Firestore
  useEffect(() => {
    if (!currentOrg?.id) return;

    const qInv = query(collection(db, 'inventory'), where('labId', '==', currentOrg.id));
    const unsubInv = onSnapshot(qInv, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qBook = query(collection(db, 'equipment_bookings'), where('labId', '==', currentOrg.id));
    const unsubBook = onSnapshot(qBook, (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubInv();
      unsubBook();
    };
  }, [currentOrg?.id]);

  // Natural Language Query Parser against Live Firestore Data
  const generateBotReply = (rawQuery) => {
    const q = rawQuery.toLowerCase();

    // 1. Low stock check
    if (q.includes('low') || q.includes('reorder') || q.includes('alert')) {
      const lowItems = inventory.filter(i => Number(i.quantity) <= Number(i.minThreshold || 2));
      if (lowItems.length === 0) {
        return `✅ All ${inventory.length} reagents in ${currentOrg?.name || 'the lab'} are currently above minimum threshold levels.`;
      }
      const list = lowItems.map(i => `• ${i.name}: ${i.quantity} ${i.unit || 'units'} left`).join('\n');
      return `⚠️ *LOW STOCK ALERT (${lowItems.length} items):*\n${list}`;
    }

    // 2. Equipment / Booking check
    if (q.includes('book') || q.includes('schedule') || q.includes('pcr') || q.includes('instrument')) {
      if (bookings.length === 0) {
        return `📅 There are currently no active instrument reservations scheduled for ${currentOrg?.name || 'this lab'}.`;
      }
      const list = bookings.slice(0, 5).map(b => `• *${b.instrument}*: ${b.date} (${b.timeSlot}) by ${b.researcher}`).join('\n');
      return `🔬 *Upcoming Equipment Runs:*\n${list}`;
    }

    // 3. Specific chemical stock lookup
    if (q.includes('stock') || q.includes('how much') || q.includes('check') || q.includes('have')) {
      const matched = inventory.filter(i => q.includes(i.name?.toLowerCase()));
      if (matched.length > 0) {
        return matched.map(i => `🧪 *${i.name}*: ${i.quantity} ${i.unit || 'units'} available (Location: ${i.location || 'Main Lab'})`).join('\n');
      }
      if (inventory.length === 0) {
        return `📦 Your lab inventory is currently empty. Add reagents in the Inventory tab first!`;
      }
      const summary = inventory.slice(0, 5).map(i => `• ${i.name}: ${i.quantity} ${i.unit || ''}`).join('\n');
      return `📦 *Current Lab Inventory Snapshot (${inventory.length} total):*\n${summary}`;
    }

    return `🤖 I searched *${currentOrg?.name || 'MOLQEN'}* (${inventory.length} reagents, ${bookings.length} bookings). Try asking:\n• "Any low stock alerts?"\n• "Show equipment bookings"\n• "Check stock"`;
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user', text: input.trim(), time: now };
    const botReply = { sender: 'bot', text: generateBotReply(input.trim()), time: now };

    setMessages(prev => [...prev, userMsg, botReply]);
    setInput('');
  };

  const handleQuickPrompt = (promptText) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [
      ...prev,
      { sender: 'user', text: promptText, time: now },
      { sender: 'bot', text: generateBotReply(promptText), time: now }
    ]);
  };

  // Push latest bot report to real WhatsApp app
  const sendToRealWhatsApp = (text) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(`*MOLQEN OS Automated Dispatch*\n${text}`);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1b4332', margin: 0 }}>
            💬 WhatsApp Lab Assistant & Dispatch Hub
          </h2>
          <p style={{ fontSize: '13px', color: '#6c757d', margin: '4px 0 0 0' }}>
            Query live Firestore inventory & schedules via chat, or push instant status briefs to your lab's WhatsApp group
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Lab WhatsApp # (e.g. 919876543210)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '8px', fontSize: '12px', width: '210px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        
        {/* Left: Interactive WhatsApp Chat Simulator */}
        <div style={{ background: '#efeae2', border: '1px solid #ced4da', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '480px' }}>
          
          {/* WhatsApp Green Top Bar */}
          <div style={{ background: '#075e54', color: '#ffffff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px' }}>
                🧪
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700' }}>MOLQEN Bot ({currentOrg?.name || 'Active Lab'})</div>
                <div style={{ fontSize: '11px', color: '#d8f3dc' }}>● Online • Connected to Live Firestore</div>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: m.sender === 'user' ? '#dcf8c6' : '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  maxWidth: '80%',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  fontSize: '13px',
                  color: '#212529',
                  whiteSpace: 'pre-wrap'
                }}
              >
                <div>{m.text}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '12px' }}>
                  <span style={{ fontSize: '10px', color: '#868e96' }}>{m.time}</span>
                  {m.sender === 'bot' && (
                    <button
                      type="button"
                      onClick={() => sendToRealWhatsApp(m.text)}
                      style={{ background: 'transparent', border: 'none', color: '#128c7e', fontSize: '10px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                    >
                      📲 Forward to WhatsApp ↗
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} style={{ background: '#f0f2f5', padding: '10px 12px', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Ask e.g. 'Any low stock alerts?' or 'Show equipment bookings'..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ flex: 1, padding: '9px 14px', borderRadius: '20px', border: '1px solid #ced4da', fontSize: '13px', outline: 'none' }}
            />
            <button
              type="submit"
              style={{ background: '#128c7e', color: '#ffffff', border: 'none', borderRadius: '20px', padding: '0 18px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              Send
            </button>
          </form>
        </div>

        {/* Right: Quick Triggers & 1-Click Broadcasts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #ced4da', borderRadius: '14px', padding: '18px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#1b4332' }}>
              ⚡ Quick Bot Commands
            </h3>
            <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 12px 0' }}>
              Click any command below to query your live Firestore database immediately:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" onClick={() => handleQuickPrompt('Any low stock alerts?')} style={quickBtnStyle}>
                ⚠️ Check Low-Stock Reagents
              </button>
              <button type="button" onClick={() => handleQuickPrompt('Show upcoming equipment bookings')} style={quickBtnStyle}>
                🔬 Today's Instrument Schedule
              </button>
              <button type="button" onClick={() => handleQuickPrompt('Check current stock inventory')} style={quickBtnStyle}>
                📦 Full Inventory Snapshot
              </button>
            </div>
          </div>

          <div style={{ background: '#e8f5e9', border: '1px solid #b2f2bb', borderRadius: '14px', padding: '18px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#1b4332' }}>
              📢 1-Click Daily Lab Broadcast
            </h3>
            <p style={{ fontSize: '12px', color: '#2d6a4f', margin: '0 0 14px 0', lineHeight: '1.5' }}>
              Send a formatted morning summary of low-stock reagents and today's instrument schedule straight to your lab's WhatsApp group.
            </p>
            <button
              type="button"
              onClick={() => {
                const summary = `${generateBotReply('low stock')}\n\n${generateBotReply('bookings')}`;
                sendToRealWhatsApp(summary);
              }}
              style={{ width: '100%', background: '#25d366', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              📲 Broadcast Daily Summary to WhatsApp
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

const quickBtnStyle = {
  background: '#f8faf9',
  border: '1px solid #ced4da',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '12px',
  fontWeight: '600',
  color: '#1b4332',
  textAlign: 'left',
  cursor: 'pointer'
};
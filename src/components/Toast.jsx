import React, { useState, useEffect } from 'react';
import { playSuccessChime } from '../utils/audioFeedback';

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const newToast = e.detail;
      if (!newToast) return;

      if (newToast.type === 'success') {
        playSuccessChime();
      }

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep maximum 4 concurrent toasts

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 3200);
    };

    window.addEventListener('molqen_toast', handleToastEvent);
    return () => window.removeEventListener('molqen_toast', handleToastEvent);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
        zIndex: 999999,
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        const bg = isSuccess
          ? '#064e3b'
          : isWarning
          ? '#78350f'
          : isError
          ? '#7f1d1d'
          : '#0f172a';

        const borderColor = isSuccess
          ? '#059669'
          : isWarning
          ? '#d97706'
          : isError
          ? '#dc2626'
          : '#334155';

        return (
          <div
            key={toast.id}
            className="molqen-toast-pill"
            style={{
              background: bg,
              color: '#ffffff',
              border: `1px solid ${borderColor}`,
              borderRadius: '9999px',
              padding: '9px 18px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.35)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              userSelect: 'none',
              maxWidth: '90vw'
            }}
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            title="Click to dismiss"
          >
            <span
              style={{
                fontSize: '13px',
                color: isSuccess ? '#34d399' : isWarning ? '#fbbf24' : isError ? '#f87171' : '#38bdf8'
              }}
            >
              {toast.icon}
            </span>
            <span style={{ lineHeight: '1.4' }}>{toast.message}</span>
            <span
              style={{
                fontSize: '11px',
                opacity: 0.5,
                marginLeft: '6px'
              }}
            >
              ✕
            </span>
          </div>
        );
      })}
    </div>
  );
}

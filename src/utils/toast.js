/**
 * MOLQEN OS — Global Toast Dispatcher
 * Dispatches toast events across the application.
 */

/**
 * Helper to dispatch a toast notification from anywhere in the application
 * @param {string} message
 * @param {{ type?: 'success'|'info'|'warning'|'error', icon?: string, duration?: number }} [options]
 */
export function showToast(message, options = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('molqen_toast', {
      detail: {
        id: 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        message,
        type: options.type || 'info',
        icon: options.icon || (options.type === 'success' ? '✓' : options.type === 'warning' ? '⚠️' : '✦'),
        duration: options.duration || 3200
      }
    })
  );
}


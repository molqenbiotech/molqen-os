/**
 * MOLQEN OS — Laboratory Notification & Alert Dispatcher Hook
 * 
 * Manages:
 * 1. Real-time Firestore synchronization for lab-wide & personal notifications
 * 2. Web Notifications API (Browser push integration & desktop alerts)
 * 3. In-app toast banner queue with 5s auto-dismiss
 * 4. Automated deadline alerts & countdown incubation timers
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  limit
} from 'firebase/firestore';

export function useLabNotifications({ currentLab, user, role = 'student' }) {
  const [labNotifications, setLabNotifications] = useState([]);
  const [userNotifications, setUserNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [permissionStatus, setPermissionStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  });

  // Active incubation countdown timers
  const [activeTimers, setActiveTimers] = useState([]);

  // Track already notified IDs to prevent duplicate browser notification rings
  const notifiedIdsRef = useRef(new Set());

  // Request browser permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermissionStatus(perm);
        return perm;
      } catch (err) {
        console.warn('Browser notification permission error:', err);
      }
    }
    return 'denied';
  }, []);

  // Dispatch Native Desktop Notification
  const triggerDesktopNotification = useCallback((title, body, actionUrl) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: title
        });
        if (actionUrl) {
          notif.onclick = () => {
            window.focus();
          };
        }
      } catch (err) {
        console.warn('Could not launch desktop notification:', err);
      }
    }
  }, []);

  // Push in-app toast notification (auto-dismiss after 5s)
  const pushToast = useCallback((toast) => {
    const toastId = 'toast_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id: toastId, ...toast, createdAt: Date.now() };

    setToasts((prev) => [newToast, ...prev].slice(0, 4));

    // Auto dismiss after 5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 5000);
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // =========================================================================
  // 1. REAL-TIME FIRESTORE SYNCHRONIZATION
  // =========================================================================
  useEffect(() => {
    if (!currentLab?.id) return;

    // A. Lab-Wide Notifications (labs/{labId}/notifications)
    const labNotifRef = collection(db, 'labs', currentLab.id, 'notifications');
    const qLab = query(labNotifRef, limit(35));

    const unsubLab = onSnapshot(qLab, (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        isPersonal: false,
        ...d.data()
      }));
      setLabNotifications(items);

      // Check for incoming high-severity alerts to fire toasts / push notifications
      items.forEach((item) => {
        if (!item.read && !notifiedIdsRef.current.has(item.id)) {
          notifiedIdsRef.current.add(item.id);

          // If role matches or broadcast
          const roleMatch = !item.targetRole || item.targetRole === 'all' || item.targetRole === role;
          if (roleMatch) {
            triggerDesktopNotification(item.title, item.message, item.actionUrl);
            pushToast({
              title: item.title,
              message: item.message,
              severity: item.severity || 'info',
              actionUrl: item.actionUrl
            });
          }
        }
      });
    }, (err) => {
      console.warn('Lab notifications sync notice:', err);
    });

    // B. User-Personal Notifications (users/{user.uid}/notifications)
    let unsubUser = () => {};
    if (user?.uid) {
      const userNotifRef = collection(db, 'users', user.uid, 'notifications');
      const qUser = query(userNotifRef, limit(20));

      unsubUser = onSnapshot(qUser, (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          isPersonal: true,
          ...d.data()
        }));
        setUserNotifications(items);

        items.forEach((item) => {
          if (!item.read && !notifiedIdsRef.current.has(item.id)) {
            notifiedIdsRef.current.add(item.id);
            triggerDesktopNotification(item.title, item.message, item.actionUrl);
            pushToast({
              title: item.title,
              message: item.message,
              severity: item.severity || 'info',
              actionUrl: item.actionUrl
            });
          }
        });
      }, (err) => {
        console.warn('User notifications sync notice:', err);
      });
    }

    return () => {
      unsubLab();
      unsubUser();
    };
  }, [currentLab, user, role, triggerDesktopNotification, pushToast]);

  // Combined notifications list sorted by creation timestamp
  const allNotifications = useMemo(() => {
    return [...labNotifications, ...userNotifications].sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.timestamp || 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.timestamp || 0);
      return timeB - timeA;
    });
  }, [labNotifications, userNotifications]);

  // Unread counts & Critical badge indicators
  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !n.read).length;
  }, [allNotifications]);

  const hasCriticalUnread = useMemo(() => {
    return allNotifications.some((n) => !n.read && n.severity === 'critical');
  }, [allNotifications]);

  // =========================================================================
  // NOTIFICATION MANAGEMENT ACTIONS
  // =========================================================================
  const markAsRead = useCallback(async (notifId, isPersonal = false) => {
    try {
      if (isPersonal && user?.uid) {
        await updateDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
          read: true
        });
      } else if (currentLab?.id) {
        await updateDoc(doc(db, 'labs', currentLab.id, 'notifications', notifId), {
          read: true
        });
      }
    } catch (err) {
      console.warn('Error marking notification as read:', err);
    }
  }, [currentLab, user]);

  const markAllAsRead = useCallback(async () => {
    try {
      const unreadList = allNotifications.filter((n) => !n.read);
      for (const n of unreadList) {
        if (n.isPersonal && user?.uid) {
          updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), { read: true }).catch(() => {});
        } else if (currentLab?.id) {
          updateDoc(doc(db, 'labs', currentLab.id, 'notifications', n.id), { read: true }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error marking all notifications read:', err);
    }
  }, [allNotifications, currentLab, user]);

  const clearNotification = useCallback(async (notifId, isPersonal = false) => {
    try {
      if (isPersonal && user?.uid) {
        await deleteDoc(doc(db, 'users', user.uid, 'notifications', notifId));
      } else if (currentLab?.id) {
        await deleteDoc(doc(db, 'labs', currentLab.id, 'notifications', notifId));
      }
    } catch (err) {
      console.warn('Error clearing notification:', err);
    }
  }, [currentLab, user]);

  const clearAllNotifications = useCallback(async () => {
    try {
      for (const n of allNotifications) {
        if (n.isPersonal && user?.uid) {
          deleteDoc(doc(db, 'users', user.uid, 'notifications', n.id)).catch(() => {});
        } else if (currentLab?.id) {
          deleteDoc(doc(db, 'labs', currentLab.id, 'notifications', n.id)).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error clearing all notifications:', err);
    }
  }, [allNotifications, currentLab, user]);

  // Dispatch a new custom notification
  const sendNotification = useCallback(async ({
    title,
    message,
    type = 'system',
    severity = 'info',
    actionUrl = 'dashboard',
    targetUid = null,
    targetRole = 'all'
  }) => {
    if (!currentLab?.id) return;
    try {
      const payload = {
        title,
        message,
        type,
        severity,
        actionUrl,
        targetUid,
        targetRole,
        read: false,
        createdAt: serverTimestamp()
      };

      if (targetUid && targetUid === user?.uid) {
        await addDoc(collection(db, 'users', user.uid, 'notifications'), payload);
      } else {
        await addDoc(collection(db, 'labs', currentLab.id, 'notifications'), payload);
      }
    } catch (err) {
      console.error('Error dispatching notification:', err);
    }
  }, [currentLab, user]);

  // =========================================================================
  // 2. INCUBATION RUN TIMERS & DEADLINE SCHEDULER
  // =========================================================================
  const addCountdownTimer = useCallback((title, durationMinutes, actionUrl = 'notebook') => {
    const timerId = 'timer_' + Date.now();
    const durationSeconds = Math.round(durationMinutes * 60);

    const newTimer = {
      id: timerId,
      title,
      totalSeconds: durationSeconds,
      remainingSeconds: durationSeconds,
      actionUrl,
      startedAt: Date.now()
    };

    setActiveTimers((prev) => [...prev, newTimer]);
    pushToast({
      title: `⏱️ Timer Started: ${title}`,
      message: `Countdown active for ${durationMinutes} minutes. You will be alerted upon completion.`,
      severity: 'info',
      actionUrl
    });
  }, [pushToast]);

  // Tick countdown timers
  useEffect(() => {
    if (activeTimers.length === 0) return;

    const timerInterval = setInterval(() => {
      setActiveTimers((prev) => {
        const next = [];
        for (const t of prev) {
          if (t.remainingSeconds <= 1) {
            // Timer expired! Trigger notification
            triggerDesktopNotification(`⏰ Incubation Complete: ${t.title}`, 'Check your culture or readout at the bench terminal.', t.actionUrl);
            pushToast({
              title: `⏰ Incubation Complete: ${t.title}`,
              message: 'Target incubation time reached. Please record readout in ELN.',
              severity: 'warning',
              actionUrl: t.actionUrl
            });
            sendNotification({
              title: `⏰ Incubation Complete: ${t.title}`,
              message: 'Check plate or assay in progress.',
              type: 'experiment',
              severity: 'warning',
              actionUrl: t.actionUrl
            });
          } else {
            next.push({ ...t, remainingSeconds: t.remainingSeconds - 1 });
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [activeTimers.length, triggerDesktopNotification, pushToast, sendNotification]);

  return {
    notifications: allNotifications,
    unreadCount,
    hasCriticalUnread,
    toasts,
    activeTimers,
    permissionStatus,
    requestNotificationPermission,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    sendNotification,
    pushToast,
    dismissToast,
    addCountdownTimer
  };
}

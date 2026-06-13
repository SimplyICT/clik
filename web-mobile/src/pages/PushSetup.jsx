import { useState, useEffect } from 'react';

export default function PushSetup({ onSubscribed }) {
  const [status, setStatus] = useState('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // Check what's available
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPush = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    const isSecure = window.isSecureContext;

    if (!hasNotification) {
      setStatus('unsupported');
      setMsg('Browser does not support notifications');
      return;
    }

    if (!isSecure) {
      // Notifications still work on some browsers without HTTPS
      // Show the button anyway, it will fail gracefully if not supported
    }

    if (Notification.permission === 'granted') {
      subscribe();
    } else if (Notification.permission === 'denied') {
      setStatus('denied');
      setMsg('Notifications blocked in browser settings');
    } else {
      setStatus('prompt');
      setMsg('Enable job alerts');
    }
  }, []);

  const subscribe = async () => {
    try {
      setStatus('subscribing');
      setMsg('Setting up...');
      const token = localStorage.getItem('token');
      if (!token) { setStatus('prompt'); setMsg('Enable job alerts'); return; }

      const resp = await fetch('/api/push/vapid-key', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!resp.ok) { setStatus('prompt'); setMsg('Enable job alerts'); return; }
      const { publicKey } = await resp.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const profileId = localStorage.getItem('author_profile_id');
      await fetch('/api/notifications/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ pushToken: JSON.stringify(sub.toJSON()), platform: 'web', profileId }),
      });
      setStatus('active');
      onSubscribed?.();
    } catch (e) {
      setStatus('prompt');
      setMsg('Enable job alerts');
    }
  };

  const handleEnable = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        await subscribe();
      } else {
        setStatus('denied');
        setMsg('Notifications blocked');
      }
    } catch (e) {
      setStatus('prompt');
      setMsg('Enable job alerts');
    }
  };

  if (status === 'active' || status === 'loading') return null;

  if (status === 'denied') {
    return (
      <div style={{ background: '#fff3e0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#e65100', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🔕 {msg}</span>
        <button onClick={handleEnable} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#e65100', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  // Always show the button for prompt, subscribing, noauth, no-vapid, error, unsupported
  return (
    <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#1565c0', flex: 1 }}>🔔 {msg}</span>
      <button onClick={handleEnable} disabled={status === 'subscribing'}
        style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: status === 'subscribing' ? '#90caf9' : '#1565c0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: status === 'subscribing' ? 'default' : 'pointer' }}>
        {status === 'subscribing' ? '...' : 'Enable'}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

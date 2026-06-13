import { useState, useEffect } from 'react';

export default function PushSetup({ onSubscribed }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    // Check existing permission
    if (Notification.permission === 'granted') {
      subscribe();
    } else if (Notification.permission === 'denied') {
      setStatus('denied');
    } else {
      setStatus('prompt');
    }
  }, []);

  const subscribe = async () => {
    try {
      setStatus('subscribing');
      const token = sessionStorage.getItem('token');
      if (!token) { setStatus('noauth'); return; }

      const resp = await fetch('/api/push/vapid-key', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!resp.ok) { setStatus('no-vapid'); return; }
      const { publicKey } = await resp.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const profileId = sessionStorage.getItem('author_profile_id');
      await fetch('/api/notifications/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ pushToken: JSON.stringify(sub.toJSON()), platform: 'web', profileId }),
      });
      setStatus('active');
      onSubscribed?.();
    } catch (e) {
      setStatus('error');
    }
  };

  const handleEnable = async () => {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await subscribe();
    } else {
      setStatus('denied');
    }
  };

  if (status === 'active' || status === 'checking') return null;

  if (status === 'prompt') {
    return (
      <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#1565c0', flex: 1 }}>🔔 Enable job alerts</span>
        <button onClick={handleEnable} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#1565c0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {status === 'subscribing' ? '...' : 'Enable'}
        </button>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={{ background: '#fff3e0', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#e65100' }}>
        🔕 Notifications blocked. Enable in browser settings for job alerts.
      </div>
    );
  }

  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

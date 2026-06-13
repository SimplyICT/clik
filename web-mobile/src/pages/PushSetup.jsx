import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = 'BHAsqVznJ0KZnN4y9GvK0kRx7FcXz0GZnY0KZnN4y9GvK0kRx7Fc'; // placeholder

export default function PushSetup() {
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('not supported');
      return;
    }
    // Check existing subscription
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (sub) {
          setStatus('subscribed');
          // Send to server
          const token = sessionStorage.getItem('token');
          if (token) {
            fetch('/api/notifications/device-token', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ pushToken: JSON.stringify(sub.toJSON()), platform: 'web' }),
            }).catch(() => {});
          }
        }
      });
    });
  }, []);

  const subscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      setStatus('subscribed');
      const token = sessionStorage.getItem('token');
      if (token) {
        await fetch('/api/notifications/device-token', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ pushToken: JSON.stringify(sub.toJSON()), platform: 'web' }),
        });
      }
    } catch (e) {
      setStatus('blocked');
    }
  };

  if (status === 'subscribed') return null;

  return (
    <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#1565c0' }}>🔔 Get notified when jobs are available</span>
      <button onClick={subscribe} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#1565c0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Enable</button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

import { useEffect, useState } from 'react';

export default function PushSetup() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }

    // Always request permission on load
    Notification.requestPermission().then(perm => {
      if (perm !== 'granted') {
        setStatus('denied');
        return;
      }
      subscribe();
    });
  }, []);

  const subscribe = async () => {
    try {
      // Fetch VAPID public key from server
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

      // Register with server
      await fetch('/api/notifications/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ pushToken: JSON.stringify(sub.toJSON()), platform: 'web' }),
      });
      setStatus('active');
    } catch (e) {
      setStatus('error');
    }
  };

  if (status === 'active' || status === 'loading') return null;

  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

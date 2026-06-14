import { useState, useEffect } from 'react';

export default function PwaInstall() {
  const [show, setShow] = useState(null); // 'ios' | 'android' | 'installed'
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if already in standalone mode (added to home screen)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setShow('installed');
      return;
    }

    // Android Chrome: beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow('android');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS detection — works on Safari AND Chrome on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && !window.navigator.standalone) {
      setShow('ios');
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') setShow('installed');
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShow('dismissed');
    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa_dismissed', String(expiry));
  };

  if (show === 'dismissed') {
    const expiry = parseInt(localStorage.getItem('pwa_dismissed') || sessionStorage.getItem('pwa_dismissed') || '0');
    if (Date.now() < expiry) return null;
  }

  if (show === 'installed') return null;

  if (show === 'android') {
    return (
      <div style={{ background: '#1a1a2e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '1px solid #333' }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📲 Install SimplyClik</div>
        <div style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>
          Add to your home screen for the full app experience with push notifications.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleInstall} style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Install</button>
          <button onClick={dismiss} style={{ padding: '10px 16px', borderRadius: 6, border: '1px solid #555', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer' }}>Not now</button>
        </div>
      </div>
    );
  }

  if (show === 'ios') {
    const isChrome = /CriOS|Chrome/.test(navigator.userAgent);
    return (
      <div style={{ background: '#1a1a2e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '1px solid #333' }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📲 Add to Home Screen</div>
        <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>
          {isChrome ? (
            <>
              <div style={{ marginBottom: 8 }}>Chrome on iOS can't install web apps. Please use <strong style={{ color: '#fff' }}>Safari</strong> instead:</div>
              <div>1. Open this page in <strong style={{ color: '#fff' }}>Safari</strong> (not Chrome)</div>
              <div>2. Tap the <strong style={{ color: '#fff' }}>Share</strong> button at the bottom</div>
              <div>3. Scroll and tap <strong style={{ color: '#fff' }}>Add to Home Screen</strong></div>
              <div style={{ marginTop: 8 }}>4. Tap <strong style={{ color: '#fff' }}>Add</strong> — app appears with notifications enabled</div>
            </>
          ) : (
            <>
              <div>1. Tap the <strong style={{ color: '#fff' }}>Share</strong> button at the bottom of Safari</div>
              <div>2. Scroll down and tap <strong style={{ color: '#fff' }}>Add to Home Screen</strong></div>
              <div style={{ marginTop: 8 }}>3. Tap <strong style={{ color: '#fff' }}>Add</strong> — full screen, no browser chrome</div>
            </>
          )}
        </div>
        <button onClick={dismiss} style={{ marginTop: 12, padding: '10px 16px', borderRadius: 6, border: '1px solid #555', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer', width: '100%' }}>
          Got it
        </button>
      </div>
    );
  }

  return null;
}

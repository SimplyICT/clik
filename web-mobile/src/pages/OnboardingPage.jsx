import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = ['install', 'pushover', 'done'];

export default function OnboardingPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [pushoverKey, setPushoverKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    }
  };

  const skip = () => {
    finish();
  };

  const finish = () => {
    sessionStorage.removeItem('show_onboarding');
    nav('/', { replace: true });
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (result.outcome === 'accepted') {
      next();
    }
  };

  const handleSavePushover = async () => {
    if (!pushoverKey.trim()) {
      finish();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/pushover/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ pushover_user_key: pushoverKey.trim() }),
      });
      if (!resp.ok) throw new Error('Failed to save');
      finish();
    } catch (e) {
      setError('Failed to save key. Check it and try again.');
      setSaving(false);
    }
  };

  const alreadyDone = () => {
    next();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: 5,
            background: i === step ? '#00d4ff' : i < step ? '#22c55e' : '#333',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      {step === 0 && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📲</div>
          <h1 style={{ color: '#fff', fontSize: 22, margin: '0 0 8px' }}>Install SimplyClik</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Add SimplyClik to your home screen for the best experience with notifications.
          </p>

          {isStandalone ? (
            <div style={{ background: '#0f3460', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ color: '#22c55e', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✓ Installed!</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>SimplyClik is added to your home screen.</div>
            </div>
          ) : deferredPrompt ? (
            <div>
              <button onClick={handleInstall} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
                Install App
              </button>
              <button onClick={next} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #555', background: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer' }}>
                Skip — I'll do it later
              </button>
            </div>
          ) : isIOS ? (
            <div>
              <div style={{ background: '#0f3460', borderRadius: 10, padding: 16, marginBottom: 12, textAlign: 'left' }}>
                <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>
                  1. Tap the <strong style={{ color: '#fff' }}>Share</strong> button at the bottom of Safari<br />
                  2. Scroll and tap <strong style={{ color: '#fff' }}>Add to Home Screen</strong><br />
                  3. Tap <strong style={{ color: '#fff' }}>Add</strong> — app appears with notifications enabled
                </div>
              </div>
              <button onClick={alreadyDone} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
                I've added it
              </button>
              <button onClick={next} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #555', background: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer' }}>
                Skip
              </button>
            </div>
          ) : (
            <div>
              <button onClick={next} style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 12 }}>
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
          <h1 style={{ color: '#fff', fontSize: 22, margin: '0 0 8px' }}>Push Notifications</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            iOS doesn't support web push notifications. Get alerts via the <strong style={{ color: '#fff' }}>Pushover</strong> app instead.
          </p>

          <div style={{ background: '#0f3460', borderRadius: 10, padding: 16, marginBottom: 16, textAlign: 'left' }}>
            <div style={{ color: '#00d4ff', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>How to set up Pushover:</div>
            <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>
              1. Install <strong style={{ color: '#fff' }}>Pushover</strong> from the App Store<br />
              2. Open the app and find your <strong style={{ color: '#fff' }}>User Key</strong><br />
              3. Paste it below
            </div>
          </div>

          <input
            value={pushoverKey}
            onChange={e => setPushoverKey(e.target.value)}
            placeholder="Paste your Pushover User Key..."
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #333',
              background: '#16213e', color: '#fff', fontSize: 14, outline: 'none',
              boxSizing: 'border-box', marginBottom: 8,
            }}
          />
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          <button onClick={handleSavePushover} disabled={saving}
            style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 16, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, marginBottom: 12 }}>
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
          <button onClick={finish} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #555', background: 'transparent', color: '#888', fontSize: 14, cursor: 'pointer' }}>
            Skip — I'll do it later
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h1 style={{ color: '#fff', fontSize: 22, margin: '0 0 8px' }}>You're all set!</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            SimplyClik is ready to go. You'll get job alerts and updates right on your device.
          </p>
          <button onClick={finish}
            style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

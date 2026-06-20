import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function QRScannerPage() {
  const nav = useNavigate();
  const [manualId, setManualId] = useState('');
  const [error, setError] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let scanner = null;
    async function init() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;
        scanner = new Html5Qrcode('qr-reader');
        await scanner.start({ facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          decodedText => {
            const id = extractAssetId(decodedText);
            if (id) { scanner.stop().catch(() => {}); nav(`/assets/${id}`); }
          },
          () => {}
        );
        setScannerReady(true);
      } catch {
        if (mounted) setScannerReady(false);
      }
    }
    init();
    return () => {
      mounted = false;
      if (scanner) scanner.stop().catch(() => {});
    };
  }, [nav]);

  function extractAssetId(text) {
    try {
      const url = new URL(text);
      const match = url.pathname.match(/\/assets?\/(\d+)/i) || url.search.match(/id=(\d+)/);
      if (match) return match[1];
    } catch {}
    const digits = text.match(/\d+/);
    return digits ? digits[0] : null;
  }

  const handleManualLookup = () => {
    const trimmed = manualId.trim();
    if (!trimmed) { setError('Enter an asset ID'); return; }
    if (/^\d+$/.test(trimmed)) {
      nav(`/assets/${trimmed}`);
    } else {
      const extracted = extractAssetId(trimmed);
      if (extracted) nav(`/assets/${extracted}`);
      else setError('Could not parse asset ID from input');
    }
  };

  return (
    <div>
      <button onClick={() => nav(-1)}
        style={{ background: 'none', border: 'none', color: '#00d4ff', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 8, fontWeight: 600 }}>
        ← Back
      </button>

      <h2 style={{ fontSize: 18, margin: '0 0 12px', color: '#1a1a2e' }}>Scan QR Code</h2>

      <div id="qr-reader" style={{ width: '100%', maxWidth: 400, margin: '0 auto 16px', borderRadius: 10, overflow: 'hidden', background: '#000', minHeight: scannerReady ? 0 : 200 }} />

      {!scannerReady && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>
            Camera not available or QR library not loaded.
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, margin: '0 0 8px' }}>Manual Entry</h4>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 8px' }}>
          Enter the asset ID or scan URL manually:
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={manualId} onChange={e => { setManualId(e.target.value); setError(null); }}
            placeholder="Asset ID or QR URL" style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14 }} />
          <button onClick={handleManualLookup}
            style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: '#00d4ff', color: '#000', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Go
          </button>
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{error}</div>}
      </div>

      <div style={{ background: '#f0f9ff', borderRadius: 10, padding: 14, border: '1px solid #bae6fd' }}>
        <div style={{ fontSize: 13, color: '#0369a1', lineHeight: 1.6 }}>
          Point your camera at a QR code on the asset. The QR code typically contains a URL with the asset ID.
        </div>
      </div>
    </div>
  );
}

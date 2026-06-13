import { useState, useRef } from 'react';

export default function ImageUpload({ onImagesChange, existing = [] }) {
  const [images, setImages] = useState(existing);
  const fileRef = useRef(null);

  const addFiles = (files) => {
    const newImages = [];
    for (const f of files) {
      if (images.length + newImages.length >= 6) break;
      newImages.push({ file: f, preview: URL.createObjectURL(f), url: null });
    }
    const all = [...images, ...newImages];
    setImages(all);
    onImagesChange?.(all);
  };

  const remove = (i) => {
    const all = images.filter((_, idx) => idx !== i);
    setImages(all);
    onImagesChange?.(all);
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }}
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
        {images.map((img, i) => (
          <div key={i} style={{ position: 'relative', paddingTop: '100%', background: '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
            <img src={img.preview} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={() => remove(i)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ))}
        {images.length < 6 && (
          <div onClick={() => fileRef.current?.click()} style={{ paddingTop: '100%', border: '2px dashed #ddd', borderRadius: 6, position: 'relative', cursor: 'pointer' }}>
            <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 28, color: '#ccc' }}>+</span>
          </div>
        )}
      </div>
      <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#666' }}>
        📷 Add Photo{images.length > 0 ? ` (${images.length}/6)` : ''}
      </button>
    </div>
  );
}

export async function uploadImages(images, path) {
  const uploaded = [];
  for (const img of images) {
    if (img.url) { uploaded.push(img.url); continue; }
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const res = await fetch('/api/upload/presign', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
      body: JSON.stringify({ bucket: 'request-images', path: `${path}/${filename}` }),
    });
    const { uploadUrl } = await res.json();
    // Compress and upload
    const compressed = await compressImage(img.file);
    await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/jpeg' } });
    uploaded.push(`${path}/${filename}`);
  }
  return uploaded;
}

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1200, maxH = 1200;
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w *= r; h *= r; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
    };
    img.src = URL.createObjectURL(file);
  });
}

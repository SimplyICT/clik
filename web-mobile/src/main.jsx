import ReactDOM from 'react-dom/client';
import App from './App';
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/mobile/sw.js', { scope: '/mobile/', updateViaCache: 'none' })
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'activated') {
            window.location.reload();
          }
        });
      });
      if (reg.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }
    })
    .catch(() => {});
}

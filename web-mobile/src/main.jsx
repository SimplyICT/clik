import ReactDOM from 'react-dom/client';
import App from './App';

// Capacitor push notification registration
async function setupPush() {
  try {
    const { PushNotifications, ActionPerformed } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;

    await PushNotifications.register();
    
    PushNotifications.addListener('registration', (token) => {
      const t = sessionStorage.getItem('token');
      if (t && token.value) {
        const platform = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'android';
        fetch('/api/notifications/device-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
          body: JSON.stringify({ pushToken: token.value, platform, profileId: sessionStorage.getItem('author_profile_id') }),
        }).catch(() => {});
      }
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // In-app notification handled by the app's polling
    });
  } catch (e) {
    // Not running in Capacitor - fall back to web push
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
setupPush();

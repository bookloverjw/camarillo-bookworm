import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app/App';
import '@/styles/index.css';

// Old links and bookmarks use hash routes (/#/events). Rewrite them to the
// real path before the router starts. Supabase auth fragments
// (#access_token=...) don't start with "#/" and are left alone.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1));
}
// ...and the same for an old-style link followed while the app is open.
window.addEventListener('hashchange', () => {
  if (window.location.hash.startsWith('#/')) {
    window.location.replace(window.location.hash.slice(1));
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for offline caching - production only.
// In dev it would serve stale cached modules instead of Vite's live ones.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.update())
      .catch(() => {
        // Service worker registration failed — non-critical
      });
  });
} else if ('serviceWorker' in navigator) {
  // Clean up any SW a previous dev session registered
  navigator.serviceWorker.getRegistrations?.().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

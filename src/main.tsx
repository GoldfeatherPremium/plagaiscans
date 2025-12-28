import { createRoot } from "react-dom/client";
import { HelmetProvider } from 'react-helmet-async';
import App from "./App.tsx";
import "./index.css";

/**
 * Service worker init
 * - Keep existing registrations (do NOT unregister on every load)
 * - Register if missing, then trigger an update check
 *
 * Unregistering clears PushManager subscriptions, which makes the push toggle
 * look "off" again after refresh.
 */
async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    // Prefer existing registration (keeps any existing push subscription)
    let reg = await navigator.serviceWorker.getRegistration();

    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
    }

    // Ask the browser to check for an updated SW script
    try {
      await reg.update();
    } catch (e) {
      console.log('[PWA] Service worker update check failed (non-fatal):', e);
    }

    console.log('[PWA] Service worker ready:', reg.scope);
  } catch (e) {
    console.log('[PWA] Service worker init failed (non-fatal):', e);
  }
}

// Initialize SW after page load (non-blocking)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void initServiceWorker();
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

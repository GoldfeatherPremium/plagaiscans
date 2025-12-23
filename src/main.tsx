import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * HARD RESET: Unregister ALL service workers and re-register fresh.
 * This ensures old buggy SWs are completely removed.
 */
async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    // Step 1: Unregister ALL existing service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const reg of registrations) {
      console.log('[PWA] Unregistering old SW:', reg.scope);
      await reg.unregister();
    }

    // Step 2: Clear ALL caches to remove stale offline pages
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        console.log('[PWA] Deleting cache:', name);
        await caches.delete(name);
      }
    }

    // Step 3: Register our clean service worker
    const newReg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Never use cached SW script
    });

    console.log('[PWA] New SW registered:', newReg.scope);

    // Force update check
    await newReg.update();

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

createRoot(document.getElementById("root")!).render(<App />);

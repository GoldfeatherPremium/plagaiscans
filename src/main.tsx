import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function hardResetServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  try {
    // Unregister ALL existing service workers (required to purge buggy cached logic)
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));

    // Register the new one fresh
    await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Ensure it takes control immediately
    await navigator.serviceWorker.ready;
  } catch (e) {
    console.log('[PWA] Service worker hard reset failed (non-fatal):', e);
  }
}

// Run after load so it doesn't interfere with first paint
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void hardResetServiceWorkers();
  });
}

createRoot(document.getElementById("root")!).render(<App />);

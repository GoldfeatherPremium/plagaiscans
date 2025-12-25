import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // DISABLE auto service worker generation - we use our own public/sw.js
      // This ensures only ONE service worker exists and no Workbox navigateFallback
      selfDestroying: false,
      registerType: 'autoUpdate',
      injectRegister: false, // We register manually in main.tsx
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        // Don't inject anything - we handle everything ourselves
        injectionPoint: undefined,
      },
      includeAssets: [
        'favicon.png',
        'robots.txt',
        'pwa-icon-192.png',
        'pwa-icon-512.png',
        'offline.html',
      ],
      manifest: {
        name: "Plagaiscans",
        short_name: "Plagaiscans",
        description: "Professional plagiarism checker and AI content detection service",
        theme_color: "#0f172a",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        id: "/",
        categories: ["education", "productivity"],
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        screenshots: [
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "wide",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "narrow",
          },
        ],
      },
      devOptions: {
        enabled: false, // Disable SW in dev to avoid caching issues
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import puppeteer from "puppeteer";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { PRERENDER_READY_EVENT, PRERENDER_ROUTES } from "./src/lib/prerender";
import { buildSitemapXml } from "./src/lib/sitemap-routes";

/**
 * Auto-generates `public/sitemap.xml` from `src/lib/sitemap-routes.ts`
 * so the sitemap stays in sync whenever routes are added/changed.
 *
 * - Runs on dev server start (so /sitemap.xml is fresh in preview).
 * - Runs at the start of every build (so the file is bundled into dist/).
 * - Re-runs after build to also stamp dist/sitemap.xml directly (defensive).
 */
function autoSitemapPlugin(): Plugin {
  const writeSitemap = async (targetDir: string) => {
    const xml = buildSitemapXml();
    const target = path.join(targetDir, "sitemap.xml");
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(target, xml, "utf8");
  };

  return {
    name: "auto-sitemap",
    async buildStart() {
      // Ensures the freshly generated sitemap.xml is copied into dist/ by Vite
      // as part of the normal `public/` -> `dist/` static copy step.
      await writeSitemap(path.join(__dirname, "public"));
    },
    async configureServer() {
      // Keep dev preview in sync.
      await writeSitemap(path.join(__dirname, "public"));
    },
    async closeBundle() {
      // Defensive: write directly into dist/ in case the public copy ran before
      // we updated public/sitemap.xml in this build.
      const distDir = path.join(__dirname, "dist");
      try {
        await fs.access(distDir);
        await writeSitemap(distDir);
      } catch {
        // dist/ doesn't exist yet (e.g. running in dev) — ignore.
      }
    },
  };
}

function getMimeType(filePath: string) {
  const ext = path.extname(filePath);
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".woff2":
      return "font/woff2";
    case ".woff":
      return "font/woff";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function spaPrerenderPlugin(): Plugin {
  return {
    name: "spa-prerender-inline",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const distDir = path.join(__dirname, "dist");
      const indexFile = path.join(distDir, "index.html");
      const host = "127.0.0.1";

      const server = createServer(async (req, res) => {
        try {
          const requestUrl = new URL(req.url || "/", `http://${host}`);
          const pathname = decodeURIComponent(requestUrl.pathname);
          const requestedPath = pathname === "/" ? "/index.html" : pathname;
          const normalized = requestedPath.replace(/^\/+/, "");
          let filePath = path.join(distDir, normalized);

          try {
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
              filePath = path.join(filePath, "index.html");
            }
          } catch {
            filePath = path.join(distDir, normalized, "index.html");
          }

          let body: Buffer;
          let contentType: string;

          try {
            body = await fs.readFile(filePath);
            contentType = getMimeType(filePath);
          } catch {
            body = await fs.readFile(indexFile);
            contentType = "text/html; charset=utf-8";
          }

          res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
          res.end(body);
        } catch (error) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(error instanceof Error ? error.message : "Prerender server error");
        }
      });

      await new Promise<void>((resolve) => server.listen(0, host, () => resolve()));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 4173;
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      try {
        for (const route of PRERENDER_ROUTES) {
          const page = await browser.newPage();
          await page.goto(`http://${host}:${port}${route}`, { waitUntil: "networkidle0" });
          await page.evaluate((eventName) => {
            const globalRef = globalThis as any;
            const html = globalRef.document?.documentElement;
            if (html?.dataset?.prerenderReady === "true") return Promise.resolve(true);

            return new Promise<boolean>((resolve) => {
              const done = () => resolve(true);
              globalRef.document?.addEventListener?.(eventName, done, { once: true });
              globalRef.setTimeout?.(() => resolve(false), 4000);
            });
          }, PRERENDER_READY_EVENT);

          const html = await page.content();
          const outputPath =
            route === "/"
              ? indexFile
              : path.join(distDir, route.replace(/^\//, ""), "index.html");

          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(outputPath, html, "utf8");
          await page.close();
        }
      } finally {
        await browser.close();
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    autoSitemapPlugin(),
    spaPrerenderPlugin(),
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks to reduce main bundle size
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-tooltip', '@radix-ui/react-tabs', '@radix-ui/react-select'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
}));

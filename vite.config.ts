import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "SR Expense",
        short_name: "SR Expense",
        description:
          "SR Expense — offline-first personal finance tracker by SR",
        theme_color: "#2a1860",
        background_color: "#0a0914",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        share_target: {
          action: "/share-target",
          method: "GET",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
        // Long-press the installed app icon (Android/desktop Chrome) for
        // instant jump-list actions. No effect on iOS Safari — it just
        // ignores unsupported manifest fields, so this is safe everywhere.
        shortcuts: [
          {
            name: "Quick Add",
            short_name: "Quick Add",
            description: "Log an expense in two taps",
            url: "/quick-add",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Reports",
            short_name: "Reports",
            description: "View spending reports",
            url: "/reports",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  define: {
    // Injected at build time — formatted in Settings as YYYY.M.D.H.mm
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: true,
    port: 5173,
  },
});

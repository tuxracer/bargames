import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execFileSync } from "node:child_process";
import type { Plugin } from "vite";

const resolveCommitSha = (): string => {
  // Vercel injects this at build time; prefer it so the SHA matches the deployed commit.
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
  } catch {
    return "unknown";
  }
};

const commitShaMeta = (): Plugin => {
  const sha = resolveCommitSha();
  return {
    name: "commit-sha-meta",
    transformIndexHtml: (html) =>
      html.replace(
        "</head>",
        `  <meta name="version" content="${sha}" />\n  </head>`,
      ),
  };
};

/** The three.js bundle alone is ~750 kB; leave headroom for precaching. */
const PRECACHE_LIMIT_BYTES = 4 * 1024 * 1024;

export default defineConfig({
  plugins: [
    react(),
    commitShaMeta(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icons/*.png", "icons/*.svg"],
      manifest: {
        id: "/",
        name: "neongames",
        short_name: "neongames",
        description:
          "Chinese Checkers on a wooden board at a bar table. Drag your marbles across the star.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0d0b0e",
        theme_color: "#0d0b0e",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Everything the app needs is in the build: code, styles, fonts,
        // icons. Precache it all so the game works with no network at all.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: PRECACHE_LIMIT_BYTES,
        navigateFallback: "/index.html",
        // Vercel's analytics endpoint is not part of the app.
        navigateFallbackDenylist: [/^\/_vercel\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)", "**/tests.[jt]s?(x)"],
  },
});

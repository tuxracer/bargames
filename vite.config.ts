import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
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

export default defineConfig({
  plugins: [react(), commitShaMeta()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)", "**/tests.[jt]s?(x)"],
  },
});

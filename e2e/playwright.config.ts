import { defineConfig } from '@playwright/test';

// Backend, frontend, and Redis are managed externally by e2e/docker-compose.yml
// (with healthchecks gating startup order), not by Playwright — this config just
// points at wherever they end up. See e2e/run.sh for the orchestration.
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 15 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    channel: 'chromium',
    // The frontend's Docker-network hostname (e.g. http://frontend:5173) is plain HTTP
    // and not "localhost", so Chromium doesn't treat it as a secure context — and the
    // app calls crypto.randomUUID() (secure-context-only) on load to assign a player id.
    // This flag is the standard way to opt a specific test origin into secure-context
    // APIs without HTTPS; real deployments are HTTPS or localhost, so unaffected.
    launchOptions: {
      args: [`--unsafely-treat-insecure-origin-as-secure=${baseURL}`],
    },
  },
});

import { defineConfig } from '@playwright/test';

// Playwright cannot download browsers on Termux/Android: run e2e on a desktop or in GitHub Actions.
export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'pnpm release:web && pnpm --filter @opmas/website preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:4173' },
});

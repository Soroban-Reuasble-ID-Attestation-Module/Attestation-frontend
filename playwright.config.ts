import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the built app served by `vite preview`.
 *
 * The escrow/attestation flows require a Freighter extension and a funded
 * testnet account, so the e2e suite covers the public shell: navigation,
 * wallet prompt, and configuration display. Contract interactions are
 * covered by the unit/integration suites instead.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
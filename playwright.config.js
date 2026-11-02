import { defineConfig } from '@playwright/test';

// Runs against local Supabase. Reset and seed it first: npm run test:e2e does both.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.js',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5175',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort --host localhost',
    url: 'http://localhost:5175/login',
    reuseExistingServer: !process.env.CI,
  },
});

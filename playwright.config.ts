import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 120000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5190', headless: true, actionTimeout: 15000, channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5190 --strictPort', url: 'http://127.0.0.1:5190', reuseExistingServer: false, timeout: 120000 },
});

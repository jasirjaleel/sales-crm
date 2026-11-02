// Takes the README screenshots from a running demo-mode app (invented data only).
//   VITE_DEMO_MODE=true VITE_DEMO_PASSWORD=... npm run dev -- --port 5176
//   node scripts/take-screenshots.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/login`);
await page.screenshot({ path: 'docs/screenshots/login.png' });
await page.getByRole('button', { name: 'Try as Owner' }).click();
await page.waitForURL(/dashboard/);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'docs/screenshots/dashboard.png' });

await page.goto(`${BASE}/leads/pipeline`);
await page.locator('[data-stage=won]').waitFor();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'docs/screenshots/pipeline.png' });

await page.goto(`${BASE}/clients/reports`);
await page.getByText('Weighted Forecast').first().waitFor();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'docs/screenshots/reports.png' });

// The briefing is a sample so the screenshot needs no API key
await page.route('**/functions/v1/lead-assistant', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  headers: { 'Access-Control-Allow-Origin': '*' },
  json: {
    summary: 'Interested after two calls. The owner said their website is not mobile friendly and asked for examples of similar work.',
    close_likelihood: 'medium',
    likelihood_reason: 'They engaged and asked for examples, but no meeting is booked yet.',
    next_action: 'Send two examples, then call to book a 15-minute meeting.',
    whatsapp_draft: 'Hi! Thanks for your time on the call. Here are two sites we built for similar businesses. Would a quick 15-minute chat this week suit you?',
  },
}));
await page.goto(`${BASE}/leads/pipeline`);
await page.locator('[data-stage=interested] h4').first().click();
await page.getByRole('button', { name: 'Prepare Me' }).click();
await page.getByLabel('WhatsApp draft, edit before sending').waitFor();
await page.getByTestId('ai-assistant').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/screenshots/assistant.png' });

await browser.close();
console.log('Screenshots saved to docs/screenshots.');

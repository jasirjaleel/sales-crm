import { test, expect } from '@playwright/test';

const PASSWORD = 'local-test-password';

async function login(page, email) {
  await page.goto('/login');
  await page.getByPlaceholder('you@company.com').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

const column = (page, stage) => page.locator(`[data-stage=${stage}]`);

test.describe('admin', () => {
  test.beforeEach(({ page }) => login(page, 'admin@test.local'));

  test('drags a deal to a new stage with the mouse, and it stays after reload', async ({ page }) => {
    await page.goto('/leads/pipeline');
    const card = column(page, 'contacted').getByText('Spice Route');
    await expect(card).toBeVisible();
    await card.dragTo(column(page, 'interested'));
    await expect(column(page, 'interested').getByText('Spice Route')).toBeVisible();

    await page.reload();
    await expect(column(page, 'interested').getByText('Spice Route')).toBeVisible();
  });

  test('asks why when a deal is lost', async ({ page }) => {
    await page.goto('/leads/pipeline');
    const card = column(page, 'new').getByText('Green Dental');
    await card.hover();
    await page.mouse.down();
    await page.mouse.move(600, 500, { steps: 5 });
    await page.getByTestId('drop-lost').hover();
    await page.mouse.up();
    await page.getByLabel('Why was it lost?').selectOption('Chose Competitor');
    await page.getByRole('button', { name: 'Move Lead' }).click();
    await expect(column(page, 'lost').getByText('Chose Competitor')).toBeVisible();
  });

  test('takes a deal from quotation to paid, and revenue updates', async ({ page }) => {
    await page.goto('/leads/pipeline');
    await column(page, 'meeting_booked').getByText('Metro Gym').click();
    await page.getByRole('button', { name: 'Generate Quotation' }).click();
    const form = page.locator('form');
    await form.getByPlaceholder('e.g. Website Design').fill('Website Design');
    await form.getByPlaceholder('35000').fill('40000');
    await form.getByPlaceholder('e.g. 14 Days').fill('14 Days');
    await form.locator('textarea').first().fill('- 5 Pages');
    const download = page.waitForEvent('download');
    await form.getByRole('button', { name: 'Generate Quotation' }).click();
    await download;

    await page.goto('/finance/quotations');
    await page.getByRole('button', { name: /Mark Sent/i }).first().click();
    await page.getByRole('button', { name: /Accept/i }).first().click();
    await page.getByRole('button', { name: /Convert Invoice/i }).first().click();

    await expect(page).toHaveURL(/finance\/invoices/);
    await page.getByRole('row', { name: /Metro Gym/ }).click();
    await page.getByRole('button', { name: /Mark Paid/i }).click();
    await expect(page.getByRole('row', { name: /Metro Gym/ })).toContainText(/paid/i);

    await page.goto('/finance/dashboard');
    await expect(page.locator('main')).toContainText('₹40,000');

    await page.goto('/leads/pipeline');
    await expect(column(page, 'won').getByText('Metro Gym')).toBeVisible();
  });

  test('shows the business summary and creates its PDF', async ({ page }) => {
    await page.goto('/clients/reports');
    await expect(page.getByText('Weighted Forecast').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Deals at Risk' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    expect((await download).suggestedFilename()).toMatch(/^business-report-.*\.pdf$/);
  });

  test('exports leads to CSV', async ({ page }) => {
    await page.goto('/leads/database');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('dialog').getByRole('button', { name: 'Export' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  });
});

test.describe('agent', () => {
  test.beforeEach(({ page }) => login(page, 'agent@test.local'));

  test('cannot reach admin pages', async ({ page }) => {
    for (const path of ['/finance/invoices', '/clients/reports', '/queue', '/leads/import']) {
      await page.goto(path);
      await expect(page).toHaveURL(/dashboard/);
    }
  });

  test('sees only their own deals', async ({ page }) => {
    await page.goto('/leads/pipeline');
    await expect(column(page, 'interested').getByText('Pearl Interiors')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Nova Clinic');
    await expect(page.locator('main')).not.toContainText('Pool Lead One');
  });

  test('gets an AI briefing and can edit the draft before sending', async ({ page }) => {
    await page.route('**/functions/v1/lead-assistant', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        summary: 'Interested in a website, no call logged yet.',
        close_likelihood: 'medium',
        likelihood_reason: 'They moved to Interested.',
        next_action: 'Call to confirm scope.',
        whatsapp_draft: 'Hi, following up on your website.',
      },
    }));
    await page.goto('/leads/pipeline');
    await column(page, 'interested').getByText('Pearl Interiors').click();
    await page.getByRole('button', { name: 'Prepare Me' }).click();
    await expect(page.getByText('Interested in a website')).toBeVisible();

    const draft = page.getByLabel('WhatsApp draft, edit before sending');
    await draft.fill('Hi Pearl team, edited by me.');
    const link = page.getByRole('link', { name: 'Review in WhatsApp' });
    await expect(link).toHaveAttribute('href', /edited%20by%20me/);
  });

  test('shows a clear message when the assistant is unavailable', async ({ page }) => {
    await page.route('**/functions/v1/lead-assistant', route => route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { error: "You have reached today's AI limit. It resets tomorrow." },
    }));
    await page.goto('/leads/pipeline');
    await column(page, 'interested').getByText('Pearl Interiors').click();
    await page.getByRole('button', { name: 'Prepare Me' }).click();
    await expect(page.getByRole('alert')).toContainText("today's AI limit");
  });

  test('pipeline fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/leads/pipeline');
    await expect(page.getByRole('button', { name: /^New \(/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});

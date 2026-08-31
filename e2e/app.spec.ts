import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

function visibleRunButton(page: Page) {
  return page
    .locator('.run-cluster .run-button:visible, .mobile-run-dock .primary-button:visible')
    .first();
}

async function showAssumptionDomain(page: Page, name: 'Input' | 'Throughput' | 'Output') {
  const switcher = page.locator('.domain-switcher');
  if (await switcher.isVisible()) {
    await switcher.getByRole('button', { name, exact: true }).click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads the complete orientation and passes an automated accessibility scan', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { level: 1, name: 'ED Throughput Sandbox' }),
  ).toBeVisible();
  await expect(page.getByText('Synthetic model', { exact: true })).toBeVisible();
  await expect(page.getByText('No patient data', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mean arrivals, numeric value')).toHaveValue('6');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('runs the default scenario, renders uncertainty, and exports results', async ({ page }) => {
  await visibleRunButton(page).click();
  await expect(page.getByRole('heading', { name: /Results for Balanced baseline/u })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('10th–90th percentile').first()).toBeVisible();
  await expect(page.locator('.metric-card')).toHaveCount(15);
  await expect(page.locator('.metric-card h3')).toHaveText([
    'Median wait',
    '90th-percentile wait',
    'Boarder-hours',
    'Departures',
    'Average occupied',
    'High-occupancy time',
    'Peak queue',
    'Remaining in system',
    'Arrivals',
    'Waiting at end',
    'Occupying at end',
    'Median length of stay',
    'Discharged length of stay',
    'Admitted length of stay',
    'Peak occupied',
  ]);
  await expect(page.getByText(/p90 .*10th–90th/u).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'System status over time' })).toBeVisible();
  await expect(
    page
      .getByRole('img', { name: /Occupied treatment spaces over 24 hours/u })
      .getByText('6 AM', { exact: true })
      .first(),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('ed-throughput-results.csv');
  const csvPath = await download.path();
  expect(csvPath).toBeTruthy();
  const csv = await readFile(csvPath!, 'utf8');
  expect(csv.match(/"wait_by_acuity"/gu)).toHaveLength(6);
  expect(csv).toContain('"high_median_wait"');
  expect(csv).toContain('"low_p90_wait"');

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: /Results for Balanced baseline/u })).toBeVisible();
});

test('applies all illustrative presets without losing global run settings', async ({ page }) => {
  const preset = page.getByLabel('Illustrative preset');
  for (const [value, name] of [
    ['balanced', 'Balanced baseline'],
    ['evening', 'Evening surge'],
    ['boarding', 'Boarding bottleneck'],
    ['constrained', 'Capacity constraint'],
    ['fastTrack', 'Fast-track experiment'],
    ['variability', 'High-variability day'],
  ]) {
    await preset.selectOption(value);
    await expect(page.getByLabel('Active scenario name')).toHaveValue(name);
  }
});

test('changes every major assumption domain and runs the captured values', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One browser covers control wiring.');
  await page.getByLabel('Mean arrivals, numeric value').fill('8');
  await page.getByLabel('Arrival pattern').selectOption('evening');
  await page.getByLabel('Total treatment spaces, numeric value').fill('24.5');
  await expect(page.getByLabel('Total treatment spaces, numeric value')).toHaveValue('25');
  await page.getByLabel('Total treatment spaces, numeric value').fill('30');
  await page.getByLabel('Treatment-time scale, numeric value').fill('90');
  await page.getByRole('checkbox', { name: /Enable low-acuity fast track/u }).check();
  await page.getByLabel('Allocate to fast track, numeric value').fill('1.5');
  await expect(page.getByLabel('Allocate to fast track, numeric value')).toHaveValue('2');
  await page.getByLabel('Weighted admission rate, numeric value').fill('20');
  await page.getByLabel('Median boarding duration, numeric value').fill('180');
  await page.locator('.advanced-controls summary').click();
  await page.getByLabel('Monte Carlo replications, numeric value').fill('25');
  await expect(page.getByLabel('Monte Carlo replications, numeric value')).toHaveValue('30');
  await page.getByLabel('Master seed').fill('12.5');
  await expect(page.getByLabel('Master seed')).toHaveValue('13');

  await visibleRunButton(page).click();
  await expect(page.getByRole('heading', { name: /Results for Balanced baseline/u })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Current', { exact: true }).first()).toBeVisible();
});

test('duplicates, edits, and runs a paired A/B comparison', async ({ page }) => {
  await page.getByRole('button', { name: 'Duplicate A → B' }).click();
  await expect(page.getByRole('tab', { name: /Scenario B/u })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await showAssumptionDomain(page, 'Throughput');
  await page.getByLabel('Total treatment spaces, numeric value').fill('28');
  await visibleRunButton(page).click();
  await expect(page.getByRole('heading', { name: 'Scenario comparison' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Treatment spaces', { exact: true })).toBeVisible();
  await expect(page.getByText('Paired replication deltas · B minus A')).toBeVisible();
  await expect(page.getByText('A capacity', { exact: true })).toBeVisible();
  await expect(page.getByText('B capacity', { exact: true })).toBeVisible();
  await page.getByLabel('Total treatment spaces, numeric value').fill('29');
  await page.getByRole('tab', { name: /Scenario A/u }).click();
  await expect(page.getByText(/Assumptions changed/u)).toBeVisible();
});

test('exports, imports, rejects invalid JSON atomically, and reopens a shared URL', async ({
  page,
}) => {
  if ((await page.locator('.more-menu').getAttribute('open')) === null) {
    await page.locator('.more-menu summary').click();
  }
  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export scenario JSON' }).click();
  const jsonDownload = await jsonDownloadPromise;
  const path = await jsonDownload.path();
  expect(path).toBeTruthy();
  const exported = JSON.parse(await readFile(path!, 'utf8')) as {
    derived: { normalizedHourlyArrivalMultipliers: { a: number[]; b: number[] } };
  };
  expect(exported.derived.normalizedHourlyArrivalMultipliers.a).toHaveLength(24);
  expect(exported.derived.normalizedHourlyArrivalMultipliers.b).toHaveLength(24);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles(path!);
  await expect(page.getByText(/Scenario bundle imported and validated/u)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1,"scenarios":{}}'),
  });
  await expect(page.getByText(/Import rejected/u)).toBeVisible();
  await expect(page.getByLabel('Active scenario name')).toHaveValue('Balanced baseline');

  if ((await page.locator('.more-menu').getAttribute('open')) === null) {
    await page.locator('.more-menu summary').click();
  }
  await page.getByRole('button', { name: 'Copy share link' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has('state')).toBe(true);
  const sharedUrl = page.url();
  await page.goto(sharedUrl);
  await expect(page.getByLabel('Active scenario name')).toHaveValue('Balanced baseline');
});

test('opens methodology and runs the one-at-a-time sensitivity explorer', async ({
  page,
}, testInfo) => {
  await page.getByRole('button', { name: 'Methodology', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Methodology' })).toBeVisible();
  await expect(page.locator('.hourly-profile-list li')).toHaveCount(24);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Sources', exact: true }).click();
  await expect(page.getByText(/Asplin BR/u)).toBeVisible();
  await page.getByRole('button', { name: 'Close methodology' }).click();

  test.skip(testInfo.project.name.includes('mobile'), 'Desktop run covers the same worker path.');
  await page.getByRole('button', { name: 'Sensitivity' }).click();
  await expect(page.getByRole('dialog', { name: 'Sensitivity explorer' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Run sensitivity' }).click();
  await expect(page.getByText(/replications per point/u)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Close sensitivity explorer' }).click();
  await page.getByLabel('Mean arrivals, numeric value').fill('7');
  await page.getByRole('button', { name: 'Sensitivity' }).click();
  await expect(page.getByText(/active scenario changed/u)).toBeVisible();
});

test('keeps the mobile viewport free of horizontal page overflow and the run action reachable', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only reflow assertion.');
  await expect(page.locator('.mobile-run-dock .primary-button')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).not.toHaveJSProperty('tagName', 'BODY');
});

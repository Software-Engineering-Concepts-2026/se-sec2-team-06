const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const sprintRoot = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let browser;

before(async () => {
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
});

after(async () => {
  await browser?.close();
});

test('Shuwichada deadline planner adds, completes and filters a task', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(2000);
  const deadlineFile = path.join(sprintRoot, 'shuwichada', 'shuwichada_set_prototypes.html');
  await page.goto(pathToFileURL(deadlineFile).href);

  await page.locator('#task-title').fill('ทบทวนฟิสิกส์ก่อนสอบ');
  await page.locator('#task-subject').selectOption('ฟิสิกส์');
  await page.locator('#task-date').fill('2026-09-01');
  await page.locator('#task-time').fill('18:30');
  await page.locator('input[name="priority"][value="high"]').check();
  await page.locator('#task-reminder').selectOption('1');
  await page.getByRole('button', { name: 'บันทึกกำหนดส่ง' }).click();

  const newCard = page.locator('[data-task-card]').filter({ hasText: 'ทบทวนฟิสิกส์ก่อนสอบ' });
  await newCard.waitFor();
  assert.equal(await page.locator('#deadline-status').innerText(), 'เพิ่มกำหนดส่งแล้ว');

  await newCard.locator('[data-action="toggle"]').click();
  await page.locator('[data-filter="completed"]').click();
  assert.equal(await page.locator('[data-filter="completed"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-task-card]').filter({ hasText: 'ทบทวนฟิสิกส์ก่อนสอบ' }).count(), 1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false);
  await page.close();
});

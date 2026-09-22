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

test('Thakorn quiz uses the shared accent and fits a mobile viewport', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(pathToFileURL(path.join(sprintRoot, 'Thakorn', 'thakorn_quizgenerator_prototype.html')).href);

  const metrics = await page.evaluate(() => ({
    buttonBackground: getComputedStyle(document.querySelector('#generate-btn')).backgroundColor,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  assert.equal(metrics.accent, '#5959d6');
  assert.equal(metrics.buttonBackground, 'rgb(89, 89, 214)');
  assert.equal(metrics.overflow, false);
  await page.close();
});

test('Thakorn and Chaiwat use the Home visual system and Navbar colors', async () => {
  const expected = {
    accent: '#5959D6',
    accentWarm: '#B9B9FF',
    pageBg: '#F3F3F0',
    surface: '#FFFFFF',
  };

  for (const relativePath of [
    path.join('Thakorn', 'thakorn_quizgenerator_prototype.html'),
    path.join('Chaiwat', 'chaiwat_library_prototypes.html'),
    path.join('Chaiwat', 'chaiwat_View_Document_prototypes.html'),
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(pathToFileURL(path.join(sprintRoot, relativePath)).href);

    const visual = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const shell = document.querySelector('.app-frame, .dropzone, .viewer-zone');
      const navbar = document.querySelector('.site-bar');
      const brandMark = document.querySelector('.site-brand__mark');
      const navAction = document.querySelector('.site-bar__action');
      return {
        accent: root.getPropertyValue('--accent').trim(),
        accentWarm: root.getPropertyValue('--accent-warm').trim(),
        pageBg: root.getPropertyValue('--page-bg').trim(),
        surface: root.getPropertyValue('--surface').trim(),
        shellBackgroundImage: shell ? getComputedStyle(shell).backgroundImage : '',
        navbarBackground: navbar ? getComputedStyle(navbar).backgroundColor : '',
        brandBackground: brandMark ? getComputedStyle(brandMark).backgroundColor : '',
        navActionBackground: navAction ? getComputedStyle(navAction).backgroundColor : '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    assert.equal(visual.accent.toLowerCase(), expected.accent.toLowerCase());
    assert.equal(visual.accentWarm.toLowerCase(), expected.accentWarm.toLowerCase());
    assert.equal(visual.pageBg.toLowerCase(), expected.pageBg.toLowerCase());
    assert.equal(visual.surface.toLowerCase(), expected.surface.toLowerCase());
    assert.match(visual.shellBackgroundImage, /linear-gradient/);
    assert.equal(visual.navbarBackground, 'rgba(255, 255, 255, 0.88)');
    assert.equal(visual.brandBackground, 'rgb(34, 34, 32)');
    assert.equal(visual.navActionBackground, 'rgb(34, 34, 32)');
    assert.equal(visual.overflow, false);
    await page.close();
  }
});

test('Chaiwat library hands document metadata to the viewer without storage', async () => {
  const page = await browser.newPage();
  page.setDefaultTimeout(2000);
  const libraryFile = path.join(sprintRoot, 'Chaiwat', 'chaiwat_library_prototypes.html');
  await page.goto(pathToFileURL(libraryFile).href);

  await page.locator('#fileInput').setInputFiles({
    name: 'lesson.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('prototype lesson'),
  });
  await page.getByRole('button', { name: /ฟิสิกส์/ }).click();
  await page.locator('.doc-card').waitFor();
  assert.equal(await page.locator('.doc-card').count(), 1);

  await page.locator('.doc-card').click();
  await page.waitForLoadState('domcontentloaded');
  assert.match(await page.url(), /chaiwat_View_Document_prototypes\.html\?name=lesson\.txt/);
  assert.equal(await page.locator('#fileName').innerText(), 'lesson.txt');
  assert.deepEqual(await page.evaluate(() => ({
    local: window.localStorage.length,
    session: window.sessionStorage.length,
  })), { local: 0, session: 0 });
  await page.close();
});

test('shuwichada deadline planner adds, completes and filters a task', async () => {
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

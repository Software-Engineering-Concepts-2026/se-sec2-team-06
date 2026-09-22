const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const sprintRoot = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const pages = [
  {
    file: path.join(sprintRoot, 'webtest', 'register.html'),
    page: 'register',
  },
  {
    file: path.join(sprintRoot, 'webtest', 'login.html'),
    page: 'login',
  },
  {
    file: path.join(sprintRoot, 'webtest', 'home.html'),
    page: 'home',
  },
  {
    file: path.join(sprintRoot, 'Thakorn', 'thakorn_quizgenerator_prototype.html'),
    page: 'quiz',
  },
  {
    file: path.join(sprintRoot, 'Chaiwat', 'chaiwat_library_prototypes.html'),
    page: 'library',
  },
  {
    file: path.join(sprintRoot, 'Chaiwat', 'chaiwat_View_Document_prototypes.html'),
    page: 'library',
  },
  {
    file: path.join(sprintRoot, 'shuwichada', 'shuwichada_set_prototypes.html'),
    page: 'deadlines',
  },
];

const expectedNavbarText = 'SynapseSync SPRINT 1 PROTOTYPE เริ่มใหม่';

let browser;

before(async () => {
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
});

after(async () => {
  await browser?.close();
});

for (const entry of pages) {
  test(`${entry.page} renders the same shared navbar content`, async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(1500);
    await page.goto(pathToFileURL(entry.file).href);

    const navbarRoot = page.locator(`[data-navbar-root][data-page="${entry.page}"]`);
    await navbarRoot.locator('.site-bar').waitFor();

    assert.equal(await page.locator('.site-bar').count(), 1);
    assert.equal(
      (await navbarRoot.locator('.site-bar').innerText()).replace(/\s+/g, ' ').trim(),
      expectedNavbarText,
    );
    assert.match(
      await navbarRoot.locator('.site-brand').getAttribute('href'),
      /webtest\/login\.html|^login\.html/,
    );
    assert.match(await navbarRoot.getByRole('link', { name: 'เริ่มใหม่' }).getAttribute('href'), /webtest\/register\.html|^register\.html/);

    await page.close();
  });
}

test('every mobile page renders the same stable navbar', async () => {
  for (const entry of pages) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(1500);
    await page.goto(pathToFileURL(entry.file).href);

    const bar = page.locator('[data-navbar-root] .site-bar');
    assert.equal(await bar.locator('[data-nav-toggle]').count(), 0);
    assert.equal(await bar.locator('.site-brand').isVisible(), true);
    assert.equal(await bar.locator('.site-bar__status').isVisible(), true);
    assert.equal(await bar.getByRole('link', { name: 'เริ่มใหม่' }).isVisible(), true);

    const mobileMetrics = await bar.evaluate((element) => ({
      barHeight: element.getBoundingClientRect().height,
      logoWidth: element.querySelector('.site-brand__mark').getBoundingClientRect().width,
      fontFamily: getComputedStyle(element).fontFamily,
      scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
    }));
    assert.deepEqual(mobileMetrics, {
      barHeight: 71,
      logoWidth: 40,
      fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      scrollbarGutter: 'stable',
    }, `${entry.page} mobile navbar differs from the shared design`);

    await page.close();
  }
});

test('every desktop page renders the shared navbar at identical size and position', async () => {
  const expectedMetrics = {
    barHeight: 81,
    logoWidth: 46,
    brandFont: 18.9,
    statusFont: 12.24,
    actionFont: 14.76,
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    scrollbarGutter: 'stable',
  };
  let expectedPosition;

  for (const entry of pages) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(pathToFileURL(entry.file).href);

    const metrics = await page.evaluate(() => ({
      barHeight: document.querySelector('.site-bar').getBoundingClientRect().height,
      logoWidth: document.querySelector('.site-brand__mark').getBoundingClientRect().width,
      brandFont: Number.parseFloat(getComputedStyle(document.querySelector('.site-brand__name')).fontSize),
      statusFont: Number.parseFloat(getComputedStyle(document.querySelector('.site-bar__status')).fontSize),
      actionFont: Number.parseFloat(getComputedStyle(document.querySelector('.site-bar__action')).fontSize),
      fontFamily: getComputedStyle(document.querySelector('.site-bar')).fontFamily,
      scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
    }));
    const position = await page.evaluate(() => {
      const inner = document.querySelector('.site-bar__inner').getBoundingClientRect();
      const brand = document.querySelector('.site-brand').getBoundingClientRect();
      const tools = document.querySelector('.site-bar__tools').getBoundingClientRect();
      return { innerX: inner.x, innerWidth: inner.width, brandX: brand.x, toolsRight: tools.right };
    });

    assert.deepEqual(metrics, expectedMetrics, `${entry.page} navbar size differs from the shared design`);
    expectedPosition ??= position;
    assert.deepEqual(position, expectedPosition, `${entry.page} navbar position differs from the other pages`);
    await page.close();
  }
});

test('quiz flow shows only the shared site header on every screen', async () => {
  const page = await browser.newPage();
  page.setDefaultTimeout(1500);
  await page.goto(pathToFileURL(pages[3].file).href);

  assert.equal(await page.locator('header:visible').count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'สร้างแบบทดสอบด้วย AI' }).isVisible(), true);

  await page.locator('#file-input').setInputFiles({
    name: 'lesson.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('prototype lesson'),
  });
  await page.locator('#qnum').fill('1');
  await page.locator('#generate-btn').click();

  assert.equal(await page.locator('header:visible').count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'ข้อ 1 จาก 1' }).isVisible(), true);

  await page.locator('.choice-option').first().click();
  await page.locator('#next-btn').click();

  assert.equal(await page.locator('header:visible').count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'ผลคะแนน' }).isVisible(), true);

  await page.close();
});

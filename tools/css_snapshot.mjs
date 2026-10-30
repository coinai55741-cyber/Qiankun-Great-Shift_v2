// CSS regression snapshots: drives the game through its main screens (story, intro, quiz, brush, results, share)
// at 6 viewport sizes and saves a screenshot of each, so style.css edits can be pixel-diffed.
//
//   python -m http.server 8791                         (from the project root, in another terminal)
//   node tools/css_snapshot.mjs before                 (all viewports; or add names: desktop wide tablet phone small land)
//   ...edit style.css...
//   node tools/css_snapshot.mjs after
//   python tools/css_compare.py before after           (prints every screenshot that differs, writes magenta diff images)
//
// Env: BASE (default http://127.0.0.1:8791/index.html), PLAYWRIGHT_CORE_DIR (folder whose node_modules holds playwright-core),
//      CHROME_PATH. Run at most 2 viewports at once; more makes clicks time out.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire((process.env.PLAYWRIGHT_CORE_DIR || 'C:/Users/User/AppData/Roaming/npm/node_modules/@playwright/mcp/') + '/node_modules/');
const { chromium } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:8791/index.html';
const outDir = process.argv[2];
const only = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  wide:    { viewport: { width: 1920, height: 1080 } },
  tablet:  { viewport: { width: 820, height: 1180 }, hasTouch: true },
  phone:   { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  small:   { viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  land:    { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};

const FREEZE_CSS = `
  canvas { visibility: hidden !important; }
  #score-display, #result-time, .result-rank-list time, .badge-timer, [class*="timer"] { color: transparent !important; text-shadow: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--font-render-hinting=none', '--disable-lcd-text'],
});

async function run(name, opts) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'no-preference', locale: 'zh-TW' });
  const page = await ctx.newPage();
  // Deterministic randomness and no external network.
  await page.addInitScript(() => {
    let s = 123456789;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (label, extra = {}) => {
    if (!extra.keepScroll) await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    delete extra.keepScroll;
    await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(outDir, `${name}__${label}.png`), animations: 'disabled', caret: 'hide', ...extra });
  };
  const click = async (sel) => { await page.locator(sel).first().click({ timeout: 8000 }); };

  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // ---- story ----
  await shot('01-story-0');
  for (let i = 0; i < 4; i++) { await click('#story-next-btn'); await page.waitForTimeout(250); }
  await shot('02-story-audio');
  for (let i = 0; i < 2; i++) { await click('#story-next-btn'); await page.waitForTimeout(250); }
  await page.waitForTimeout(1800);
  await shot('03-story-bridge');
  for (let i = 0; i < 2; i++) { await click('#story-next-btn'); await page.waitForTimeout(250); }
  await shot('04-story-last');
  await click('#story-next-btn');
  await page.waitForTimeout(700);

  // ---- intro ----
  await shot('05-intro');
  await shot('05b-intro-full', { fullPage: true });
  const rankBtn = page.locator('#lobby-rank-toggle:visible, .lobby-rank-link:visible').first();
  if (await rankBtn.count()) {
    await rankBtn.click();
    await page.waitForTimeout(500);
    await shot('06-intro-rank-modal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // ---- game ----
  await click('#start-adventure-btn');
  await page.waitForTimeout(600);
  await shot('07-game-opening');
  await page.waitForFunction(() => !document.getElementById('hint-btn')?.disabled, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot('08-game-ready');
  await click('#hint-btn');
  await page.waitForTimeout(400);
  await shot('09-game-hint');
  // place a few blocks by clicking candidates
  for (let i = 0; i < 3; i++) {
    const c = page.locator('#candidates-container .word-block').first();
    if (await c.count()) { await c.click().catch(() => {}); await page.waitForTimeout(150); }
  }
  await shot('10-game-blocks-placed');
  for (let i = 0; i < 4; i++) {
    const c = page.locator('#candidates-container .word-block').first();
    if (await c.count()) { await c.click().catch(() => {}); await page.waitForTimeout(150); }
  }
  await shot('10b-game-all-placed');
  await click('#submit-btn').catch(() => {});
  await page.waitForTimeout(700);
  await shot('11-game-wrong-feedback');

  // Use 求助伯公 on every question to reach the brush stage deterministically.
  for (let q = 0; q < 5; q++) {
    await page.waitForFunction(() => {
      const b = document.getElementById('help-bg-btn');
      return b && !b.disabled && getComputedStyle(b).visibility !== 'hidden';
    }, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await click('#help-bg-btn').catch(() => {});
    if (q === 0) { await page.waitForTimeout(900); await shot('12-game-bokong-help'); }
    // wait for next question (or brush stage on the last one)
    if (q < 4) {
      await page.waitForFunction((n) => {
        const t = document.querySelector('.progress-text, #progress-text, .question-count');
        return true;
      }, q).catch(() => {});
      await page.waitForTimeout(9000);
    }
  }
  await page.waitForSelector('#brush-stage-overlay:not(.hidden)', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await shot('13-brush-overlay');

  // ---- finish brush from inside the iframe, then results ----
  const frame = page.frames().find((f) => f.url().includes('brush-prototype'));
  if (frame) {
    await frame.evaluate(() => {
      parent.postMessage({ type: 'brush-complete', score: 15.5, strokes: [], chars: [] }, location.origin);
    });
  }
  await page.waitForSelector('#results-card:not(.hidden)', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot('14-results');
  await shot('14b-results-full', { fullPage: true });
  await page.evaluate(() => document.querySelector('#review-list')?.scrollIntoView());
  await page.waitForTimeout(300);
  await shot('15-results-review', { keepScroll: true });
  await page.locator('#open-scroll-share-btn').click().catch(() => {});
  await page.waitForTimeout(2500);
  await shot('16-scroll-share');

  if (errors.length) fs.writeFileSync(path.join(outDir, `${name}__errors.txt`), errors.join('\n'));
  await ctx.close();
}

for (const [name, opts] of Object.entries(VIEWPORTS)) {
  if (only.length && !only.includes(name)) continue;
  try { await run(name, opts); console.log('done', name); }
  catch (e) { console.log('FAILED', name, e.message.split('\n')[0]); }
}
await browser.close();

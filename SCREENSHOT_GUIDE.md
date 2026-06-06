# Automated Screenshots & GIF Generation Guide

How to automatically capture screenshots and a user-flow GIF from any web app and embed them in a GitHub README — no manual screen recording needed.

---

## What this produces

- **Static screenshots** — crisp PNG files at real mobile resolution (393×852 @2x retina), one per page
- **App-tour GIF** — animated walkthrough of the full user flow, ready to embed in a README

Both are captured from a headless browser running the actual app, with realistic seeded data, in a fully automated script.

---

## Technology stack

| Tool | Purpose | Why this one |
|------|---------|--------------|
| **[Playwright](https://playwright.dev)** | Headless browser automation | Controls Chrome headlessly — navigate pages, click buttons, scroll, wait for renders |
| **[gifski](https://gif.ski)** | PNG frames → GIF | Produces the highest-quality GIFs of any encoder (uses a Rust palette algorithm) |
| **Node.js ESM** | Script runtime | Ships with every dev machine; no extra runtime needed |
| **Chromium (Headless Shell)** | Rendering engine | Playwright downloads it automatically — no manual browser install |

---

## How it works — end-to-end flow

```
npm run dev           ← your app running locally
       │
       ▼
capture-screenshots.mjs
       │
       ├── 1. Launch headless Chromium at iPhone viewport (393×852 @2x)
       │
       ├── 2. Load the app → wait for it to initialise (DB schema, default data)
       │
       ├── 3. Seed realistic sample data directly into the app's storage
       │        (IndexedDB + localStorage — bypasses the UI so data is instant)
       │
       ├── 4. Reload the app so it picks up the seeded data
       │
       ├── 5. Navigate to each page → wait for render → screenshot
       │        → .github/screenshots/01-dashboard.png, 02-…, etc.
       │
       ├── 6. Re-navigate the same pages capturing individual frames
       │        (duplicate frames = hold time, more frames = smoother scroll)
       │
       └── 7. Run gifski to stitch all PNG frames into app-tour.gif
```

---

## Step-by-step: setting it up for any app

### Step 1 — Install dependencies

```bash
# Playwright (browser automation)
npm install --save-dev playwright

# Download the headless Chromium browser (~90 MB, one-time)
npx playwright install chromium

# gifski (GIF encoder) — macOS
brew install gifski

# gifski — Linux
cargo install gifski          # via Rust/cargo
# or: snap install gifski

# gifski — Windows
winget install gifski
# or download from https://gif.ski
```

### Step 2 — Start your dev server

The script captures from a running local server. Make sure it's up before running:

```bash
npm run dev          # Vite, Next.js, CRA — whatever your app uses
```

### Step 3 — Create the capture script

Create `capture-screenshots.mjs` at your project root. The core structure is always the same:

```js
import { chromium } from 'playwright';
import { mkdir, readdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT    = join(__dirname, '.github', 'screenshots');   // static PNGs
const FRAMES = join(__dirname, '.github', '_gif_frames');   // temp GIF frames
const BASE   = 'http://localhost:3000';                     // ← your dev server URL

// Viewport to simulate — match your target device
const VIEWPORT = { width: 393, height: 852 };  // iPhone 14 Pro
const SCALE    = 2;                             // retina = 2×, desktop = 1×
```

#### Viewport cheat sheet

| Target | Width | Height | Scale |
|--------|-------|--------|-------|
| iPhone 14 Pro | 393 | 852 | 2 |
| iPhone SE | 375 | 667 | 2 |
| Pixel 7 | 412 | 915 | 2.6 |
| iPad Air | 820 | 1180 | 2 |
| Desktop 1080p | 1920 | 1080 | 1 |
| Desktop 1440p | 1440 | 900 | 2 |

### Step 4 — Seed sample data (most important step)

Screenshots with empty/blank state look bad. You want the app to look like a real user has been using it. Seed data directly into whatever storage your app uses — **before** navigating to each page.

#### For apps using localStorage

```js
async function seedData(page) {
  await page.evaluate(() => {
    localStorage.setItem('user-prefs', JSON.stringify({
      theme: 'dark',
      currency: 'USD',
      onboardingDone: true,   // skip any first-run wizards
    }));
    localStorage.setItem('my-todos', JSON.stringify([
      { id: '1', text: 'Buy groceries', done: false },
      { id: '2', text: 'Pay rent',      done: true  },
    ]));
  });
}
```

#### For apps using IndexedDB

```js
async function seedData(page) {
  await page.waitForTimeout(2000); // let the app create the DB schema first

  await page.evaluate(async () => {
    const req = indexedDB.open('YourDBName'); // must match your app's DB name
    await new Promise(r => { req.onsuccess = r; req.onerror = r; });
    const db = req.result;

    function put(store, record) {
      return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        const r  = tx.objectStore(store).put(record);
        r.onsuccess = res;
        r.onerror   = () => rej(r.error);
      });
    }

    await put('items', { id: 'item1', name: 'Sample item', value: 42 });
    // ... more records
    db.close();
  });
}
```

#### For apps using a REST API / cookies

```js
async function seedData(page) {
  // Set auth cookie directly
  await page.context().addCookies([{
    name: 'session', value: 'your-test-session-token',
    domain: 'localhost', path: '/',
  }]);

  // Or call your API endpoints
  await page.evaluate(async () => {
    await fetch('/api/seed', { method: 'POST' });
  });
}
```

#### Key gotcha: Zustand `persist` + localStorage

If your app uses Zustand with the `persist` middleware, the stored value is **nested**:

```js
// ❌ Wrong — Zustand will replace the whole state object with this
localStorage.setItem('my-store', JSON.stringify({ onboardingDone: true }))

// ✅ Correct — include the full state shape
localStorage.setItem('my-store', JSON.stringify({
  state: {
    onboardingDone: true,
    theme: 'dark',
    // ... ALL fields, not just the ones you're changing
  },
  version: 0,
}))
```

Zustand does a **shallow merge** at the `state` level when rehydrating — it replaces `state.settings` entirely with what's in storage. If you only write `{ onboardingDone: true }`, all other settings fields become `undefined`, which crashes components that call `.toString()` on them.

#### Key gotcha: IndexedDB boolean indexes

Dexie.js (and some other IndexedDB wrappers) index booleans as integers (`1`/`0`), not as JS `true`/`false`. If you seed with raw `indexedDB.put()`, use integers:

```js
// ❌ Dexie query .where('isActive').equals(1) won't find this
{ id: 'r1', isActive: true }

// ✅ Use integer 1 so Dexie's .equals(1) finds it
{ id: 'r1', isActive: 1 }
```

### Step 5 — Take static screenshots

```js
async function shot(page, name) {
  await page.waitForTimeout(600);  // let animations settle
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

// In your main function:
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await shot(page, '01-dashboard');

await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);   // lazy-loaded routes need more time
await shot(page, '02-settings');
```

**Naming tip:** prefix with `01-`, `02-` so files sort in the right order in your repo browser.

**`waitUntil: 'networkidle'`** — waits until there are no network requests for 500ms. Good for pages that fetch data on load. For purely local/offline apps, `'load'` or `'domcontentloaded'` is faster.

#### Interacting with the UI before screenshotting

```js
// Click a button to open a modal
await page.locator('button:has-text("Add Expense")').click();
await page.waitForTimeout(700);
await shot(page, '03-add-modal');

// Close with Escape (safer than clicking close buttons that may be covered)
await page.keyboard.press('Escape');

// Scroll to a specific position
await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
await shot(page, '04-scrolled');

// Navigate via the app's own UI (useful for pages behind drawers/tabs)
await page.locator('button:has-text("More")').click();
await page.waitForTimeout(400);
await page.locator('button:has-text("Settings")').click();
await page.waitForTimeout(1500);
await shot(page, '05-settings');
```

### Step 6 — Capture GIF frames

For the GIF, capture the same flow but output numbered PNG frames instead of named screenshots. Duplicate a frame multiple times to create a "hold" effect (pause on that screen).

```js
let frameIdx = 0;

async function frame(page, hold = 1) {
  const name = String(frameIdx++).padStart(4, '0');
  await page.screenshot({ path: join(FRAMES, `${name}.png`) });

  // Duplicate = hold time. hold=10 at 10fps = 1 second pause
  for (let i = 1; i < hold; i++) {
    const dup = String(frameIdx++).padStart(4, '0');
    execSync(`cp "${join(FRAMES, name + '.png')}" "${join(FRAMES, dup + '.png')}"`);
  }
}

// Usage — fps=10, so hold=10 ≈ 1s, hold=20 ≈ 2s, hold=5 ≈ 0.5s
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await frame(page, 20);    // pause 2s on dashboard

// Slow scroll — each step is a new frame
for (let y = 0; y <= 500; y += 30) {
  await page.evaluate(y => window.scrollTo({ top: y }), y);
  await page.waitForTimeout(60);
  await frame(page, 2);   // 2 frames each step = smooth-ish scroll
}

await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
await frame(page, 15);    // pause 1.5s on reports
```

### Step 7 — Build the GIF

```js
async function buildGif(outputName, fps = 10) {
  const files = (await readdir(FRAMES))
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => join(FRAMES, f));

  const output = join(OUT, `${outputName}.gif`);

  execSync(
    `gifski --fps ${fps} --quality 85 --width ${VIEWPORT.width * SCALE} -o "${output}" ${
      files.map(f => `"${f}"`).join(' ')
    }`,
    { stdio: 'pipe' }
  );

  // Clean up temp frames
  for (const f of files) await rm(f, { force: true });
}

await buildGif('app-tour', 10);
```

**gifski flags:**

| Flag | What it does |
|------|-------------|
| `--fps 10` | 10 frames per second — smooth without huge file size |
| `--quality 85` | 0–100, higher = sharper but larger. 80–90 is the sweet spot |
| `--width 786` | Output pixel width (viewport × scale = 393 × 2 = 786) |
| `--lossy-quality 80` | Optional: smaller file, slight dithering |

### Step 8 — Run it

```bash
# Terminal 1: start the app
npm run dev

# Terminal 2: run the capture
node capture-screenshots.mjs
```

Output:
```
Opening app...
Seeding sample data...

── Static screenshots ─────────────────────────────────────────
  ✓ 01-dashboard.png
  ✓ 02-reports.png
  ...

── Capturing GIF frames ───────────────────────────────────────

Building GIF...
  ✓ app-tour.gif (183 frames)

All done! Files saved to .github/screenshots/
```

### Step 9 — Embed in README

```markdown
## App Tour

<p align="center">
  <img src=".github/screenshots/app-tour.gif" alt="App Tour" width="280" />
</p>

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src=".github/screenshots/01-dashboard.png" width="180" />
      <br/><sub><b>Dashboard</b></sub>
    </td>
    <td align="center">
      <img src=".github/screenshots/02-reports.png" width="180" />
      <br/><sub><b>Reports</b></sub>
    </td>
    <td align="center">
      <img src=".github/screenshots/03-settings.png" width="180" />
      <br/><sub><b>Settings</b></sub>
    </td>
  </tr>
</table>
```

GitHub renders HTML tables in README files, so the 3-column grid works perfectly.

---

## Complete minimal template

Copy this and adapt it to any app:

```js
import { chromium } from 'playwright';
import { mkdir, readdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT    = join(__dirname, '.github', 'screenshots');
const FRAMES = join(__dirname, '.github', '_gif_frames');
const BASE   = 'http://localhost:3000';          // ← your URL
const VIEWPORT = { width: 393, height: 852 };   // ← your target device
const SCALE    = 2;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ✓ ${name}.png`);
}

let frameIdx = 0;
async function frame(page, hold = 1) {
  const name = String(frameIdx++).padStart(4, '0');
  await page.screenshot({ path: join(FRAMES, `${name}.png`) });
  for (let i = 1; i < hold; i++) {
    const dup = String(frameIdx++).padStart(4, '0');
    execSync(`cp "${join(FRAMES, `${name}.png`)}" "${join(FRAMES, `${dup}.png`)}"`);
  }
}

async function buildGif(name, fps = 10) {
  const files = (await readdir(FRAMES)).filter(f => f.endsWith('.png')).sort().map(f => join(FRAMES, f));
  execSync(`gifski --fps ${fps} --quality 85 --width ${VIEWPORT.width * SCALE} -o "${join(OUT, name + '.gif')}" ${files.map(f => `"${f}"`).join(' ')}`, { stdio: 'pipe' });
  for (const f of files) await rm(f, { force: true });
  frameIdx = 0;
  console.log(`  ✓ ${name}.gif`);
}

// ── Seed function — adapt to your app's storage ───────────────────────────────

async function seedData(page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    // Example: localStorage
    localStorage.setItem('app-state', JSON.stringify({
      state: { user: { name: 'Demo User' }, onboardingDone: true },
      version: 0,
    }));
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  await mkdir(OUT, { recursive: true });
  await mkdir(FRAMES, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();

  // Load, seed, reload
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await seedData(page);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // ── Static screenshots
  await shot(page, '01-home');
  await page.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
  await shot(page, '02-about');

  // ── GIF
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await frame(page, 20);                      // 2s on home
  await page.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
  await frame(page, 15);                      // 1.5s on about
  await buildGif('app-tour', 10);

  await browser.close();
  console.log('Done!');
})();
```

---

## Common problems & fixes

### Page renders black / blank

**Cause:** Lazy-loaded route not finished rendering when the screenshot fires.

**Fix:** Increase `waitForTimeout` after navigation, or wait for a specific element:
```js
await page.waitForSelector('h1', { timeout: 10000 });
await shot(page, 'page');
```

### Onboarding / welcome modal blocks the page

**Cause:** App shows a first-run wizard before any content.

**Fix:** Set the "onboarding done" flag in your storage before reloading:
```js
localStorage.setItem('onboarded', 'true');
// or in IndexedDB, set the flag in your settings record
```

### A modal/overlay intercepts clicks

**Cause:** A floating element (numpad, drawer) sits on top of the button you're clicking.

**Fix:** Use `Escape` to close modals rather than clicking Cancel/Close:
```js
await page.keyboard.press('Escape');
```

### GIF is too large

**Cause:** Too many frames or too high quality.

**Fixes:**
```bash
gifski --fps 8 --quality 75 --lossy-quality 70 ...   # lower quality
gifski --fps 10 --width 393 ...                        # half-width (no @2x)
```
Or reduce hold counts in the script to make the GIF shorter.

### IndexedDB store not found

**Cause:** Seeding before the app has created the database schema.

**Fix:** Wait for the app to fully initialise before seeding:
```js
await page.waitForTimeout(2000);  // or wait for a specific element to appear
await page.evaluate(async () => {
  // seed here
});
```

### Zustand / Redux state resets on reload despite localStorage patch

**Cause:** The state shape you wrote doesn't match what the middleware expects — missing fields get dropped and overwritten with `undefined`.

**Fix:** Write the **complete** default state, not just the fields you're changing:
```js
const fullState = {
  user: { name: 'Demo', email: 'demo@example.com' },
  settings: { theme: 'dark', currency: 'USD', onboardingDone: true },
  // ... every field
};
localStorage.setItem('my-store', JSON.stringify({ state: fullState, version: 0 }));
```

---

## Keeping screenshots up to date

Add this to your `package.json`:

```json
{
  "scripts": {
    "screenshots": "node capture-screenshots.mjs"
  }
}
```

Then re-run `npm run screenshots` (with the dev server running) whenever the UI changes significantly. Commit the updated files and the GitHub README automatically shows the new images.

For CI, you can run it in GitHub Actions on release branches — but GIF generation needs `gifski` installed in the runner, so add:

```yaml
- name: Install gifski
  run: cargo install gifski

- name: Capture screenshots
  run: |
    npm run dev &
    sleep 10
    node capture-screenshots.mjs
```

---

## Summary of decisions made for this project

| Decision | Reason |
|----------|--------|
| Playwright over Puppeteer | Better API, built-in wait strategies, first-class TypeScript support, actively maintained |
| gifski over ffmpeg | Dramatically better GIF quality (perceptual palette), same file size |
| `deviceScaleFactor: 2` | Retina screenshots look sharp in README; GitHub's image renderer handles large PNGs well |
| `waitUntil: 'networkidle'` | SR Expense is offline-first (no network calls), so this resolves immediately — safe default for any app |
| Seed via raw IndexedDB API | Faster and more reliable than clicking through the UI; no dependency on UI state |
| Duplicate frames for hold | gifski requires all frames as individual PNGs; duplicating is the simplest way to control timing without re-rendering |
| `.github/screenshots/` folder | GitHub convention; images load as relative paths in README without any hosting setup |

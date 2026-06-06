import { chromium } from 'playwright';
import { mkdir, readdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '.github', 'screenshots');
const FRAMES = join(__dirname, '.github', '_gif_frames');
const BASE = 'http://localhost:5173';

// iPhone 14 Pro — mobile-first app, matches real device dimensions
const VIEWPORT = { width: 393, height: 852 };
const SCALE = 2;

async function shot(page, name, dir = OUT) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

async function seedData(page) {
  // Wait until Dexie has created the schema (app renders first)
  await page.waitForSelector('body', { state: 'attached' });
  await page.waitForTimeout(2000); // let seedDefaults() run

  await page.evaluate(async () => {
    // DB name matches ExpenseDB constructor: "ExpenseManager"
    const DB_NAME = 'ExpenseManager';

    // Open without upgrading (schema already exists from app init)
    const req = indexedDB.open(DB_NAME);
    await new Promise((res, rej) => {
      req.onsuccess = res;
      req.onerror = () => rej(req.error);
      req.onblocked = res; // proceed even if blocked
    });
    const db = req.result;

    function put(storeName, record) {
      return new Promise((res, rej) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.onerror = () => rej(tx.error);
        const r = tx.objectStore(storeName).put(record);
        r.onsuccess = res;
        r.onerror = () => rej(r.error);
      });
    }

    function getAll(storeName) {
      return new Promise(res => {
        const tx = db.transaction(storeName, 'readonly');
        const r = tx.objectStore(storeName).getAll();
        r.onsuccess = () => res(r.result);
      });
    }

    function getOne(storeName, key) {
      return new Promise(res => {
        const tx = db.transaction(storeName, 'readonly');
        const r = tx.objectStore(storeName).get(key);
        r.onsuccess = () => res(r.result);
      });
    }

    const now = Date.now();
    const day = 86400000;

    // Get categories seeded by the app
    const cats = await getAll('categories');
    const byName = Object.fromEntries(cats.map(c => [c.name, c.id]));

    const food = byName['Food & Dining'] ?? cats[0]?.id ?? 'food';
    const transport = byName['Transport'] ?? cats[2]?.id ?? 'transport';
    const shopping = byName['Shopping'] ?? cats[3]?.id ?? 'shopping';
    const entertainment = byName['Entertainment'] ?? cats[4]?.id ?? 'entertainment';
    const health = byName['Health'] ?? cats[5]?.id ?? 'health';
    const housing = byName['Housing'] ?? cats[6]?.id ?? 'housing';
    const groceries = byName['Groceries'] ?? cats[1]?.id ?? 'groceries';

    const expenses = [
      { id: 'e1', type: 'expense', amount: 320, currency: 'INR', categoryId: food, tags: [], date: now - 1 * day, paymentMethod: 'upi', isRecurring: false, notes: 'Dinner with friends', createdAt: now, updatedAt: now },
      { id: 'e2', type: 'expense', amount: 150, currency: 'INR', categoryId: transport, tags: [], date: now - 2 * day, paymentMethod: 'upi', isRecurring: false, notes: 'Uber ride', createdAt: now, updatedAt: now },
      { id: 'e3', type: 'expense', amount: 2400, currency: 'INR', categoryId: shopping, tags: [], date: now - 3 * day, paymentMethod: 'card', isRecurring: false, notes: 'New shoes', createdAt: now, updatedAt: now },
      { id: 'e4', type: 'expense', amount: 800, currency: 'INR', categoryId: groceries, tags: [], date: now - 4 * day, paymentMethod: 'cash', isRecurring: false, notes: 'Weekly groceries', createdAt: now, updatedAt: now },
      { id: 'e5', type: 'expense', amount: 499, currency: 'INR', categoryId: entertainment, tags: [], date: now - 5 * day, paymentMethod: 'card', isRecurring: 1, notes: 'Netflix', recurrence: { interval: 'monthly', nextDate: now + 25 * day }, createdAt: now, updatedAt: now },
      { id: 'e6', type: 'expense', amount: 250, currency: 'INR', categoryId: health, tags: [], date: now - 6 * day, paymentMethod: 'cash', isRecurring: false, notes: 'Pharmacy', createdAt: now, updatedAt: now },
      { id: 'e7', type: 'expense', amount: 180, currency: 'INR', categoryId: food, tags: [], date: now - 7 * day, paymentMethod: 'upi', isRecurring: false, notes: 'Lunch', createdAt: now, updatedAt: now },
      { id: 'e8', type: 'income', amount: 65000, currency: 'INR', categoryId: food, tags: [], date: now - 8 * day, paymentMethod: 'bank_transfer', isRecurring: false, notes: 'Salary', createdAt: now, updatedAt: now },
      { id: 'e9', type: 'expense', amount: 12000, currency: 'INR', categoryId: housing, tags: [], date: now - 9 * day, paymentMethod: 'bank_transfer', isRecurring: 1, notes: 'Rent', recurrence: { interval: 'monthly', nextDate: now + 21 * day }, createdAt: now, updatedAt: now },
      { id: 'e10', type: 'expense', amount: 199, currency: 'INR', categoryId: entertainment, tags: [], date: now - 10 * day, paymentMethod: 'card', isRecurring: 1, notes: 'Spotify', recurrence: { interval: 'monthly', nextDate: now + 20 * day }, createdAt: now, updatedAt: now },
      // Past months for trend chart
      ...Array.from({ length: 25 }, (_, i) => ({
        id: `ph${i}`, type: 'expense',
        amount: 800 + Math.floor(Math.sin(i) * 400 + 300),
        currency: 'INR',
        categoryId: [food, transport, shopping, groceries, entertainment][i % 5],
        tags: [], date: now - (32 + i * 5) * day, paymentMethod: 'upi',
        isRecurring: false, notes: 'Past expense', createdAt: now, updatedAt: now,
      })),
    ];

    for (const e of expenses) await put('expenses', e);

    await put('budgets', {
      id: 'b1', amount: 20000, currency: 'INR', period: 'monthly',
      startDate: now - 5 * day, createdAt: now,
    });

    await put('tasks', {
      id: 't1', title: 'Pay electricity bill', type: 'todo', status: 'pending',
      priority: 'high', dueDate: now + 2 * day, amount: 1200,
      tags: [], createdAt: now, updatedAt: now,
    });
    await put('tasks', {
      id: 't2', title: 'Buy groceries', type: 'checklist', status: 'pending',
      priority: 'medium', dueDate: now + 1 * day, amount: 600,
      items: [
        { id: 'i1', name: 'Milk', checked: false, quantity: 2, estimatedPrice: 60 },
        { id: 'i2', name: 'Eggs', checked: true, quantity: 1, estimatedPrice: 80 },
        { id: 'i3', name: 'Vegetables', checked: false, quantity: 1, estimatedPrice: 120 },
      ],
      tags: [], createdAt: now, updatedAt: now,
    });

    // Update settings in IndexedDB (source of truth)
    const settingsRow = await getOne('settings', 'app');
    if (settingsRow) {
      const updated = { ...settingsRow, value: { ...settingsRow.value, enableBudgets: true, defaultCurrency: 'INR', onboardingDone: true } };
      await put('settings', updated);
    }

    db.close();

    // Patch Zustand localStorage persist with FULL default settings merged with our overrides.
    // Must include all fields — Zustand persist replaces settings object, not deep-merges.
    const fullDefaults = {
      theme: 'dark', accentColor: '#7c5cfc', defaultCurrency: 'INR',
      defaultPaymentMethod: 'upi', firstDayOfWeek: 1, showCents: true,
      enableBiometrics: false, enableEncryption: false, compactMode: false,
      notifications: false, onboardingDone: true, includeGroupSpends: false,
      myGroupName: '', enableBudgets: true, tripMode: false,
      tripCurrency: 'USD', tripName: '',
    };
    try {
      const raw = localStorage.getItem('expense-settings');
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = { ...(parsed.state ?? {}), settings: { ...fullDefaults, ...(parsed.state?.settings ?? {}) } };
      localStorage.setItem('expense-settings', JSON.stringify(parsed));
    } catch {}
  });
}

// ─── GIF helpers ─────────────────────────────────────────────────────────────

let frameIdx = 0;
async function frame(page, delay = 1) {
  // Pad name so gifski picks up the right order
  const name = String(frameIdx++).padStart(4, '0');
  await page.screenshot({ path: join(FRAMES, `${name}.png`), fullPage: false });
  // Duplicate the frame `delay` times to simulate hold time
  for (let i = 1; i < delay; i++) {
    const dup = String(frameIdx++).padStart(4, '0');
    execSync(`cp "${join(FRAMES, `${name}.png`)}" "${join(FRAMES, `${dup}.png`)}"`);
  }
}

async function buildGif(outputName, fps = 10) {
  const files = (await readdir(FRAMES))
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => join(FRAMES, f));

  if (files.length === 0) { console.log('  No frames found'); return; }

  const output = join(OUT, `${outputName}.gif`);
  execSync(
    `gifski --fps ${fps} --quality 85 --width ${VIEWPORT.width * SCALE} -o "${output}" ${files.map(f => `"${f}"`).join(' ')}`,
    { stdio: 'pipe' }
  );
  console.log(`  ✓ ${outputName}.gif (${files.length} frames)`);

  // Clean up frames
  for (const f of files) await rm(f, { force: true });
  frameIdx = 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  await mkdir(OUT, { recursive: true });
  await mkdir(FRAMES, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();

  console.log('\nOpening app...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log('Seeding sample data...');
  await seedData(page);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // ── Static screenshots ──────────────────────────────────────────────────────
  console.log('\n── Static screenshots ─────────────────────────────────────────');

  // Dashboard (top)
  await shot(page, '01-dashboard');

  // Dashboard (scrolled to show trend + categories)
  await page.evaluate(() => window.scrollTo({ top: 360, behavior: 'instant' }));
  await page.waitForTimeout(400);
  await shot(page, '02-dashboard-trends');

  // Expenses list
  await page.goto(`${BASE}/expenses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '03-expenses');

  // Reports
  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '04-reports');

  // Calendar
  await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '05-calendar');

  // Tasks
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '06-tasks');

  // Subscriptions
  await page.goto(`${BASE}/subscriptions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '07-subscriptions');

  // Groups
  await page.goto(`${BASE}/groups`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '08-groups');

  // Settings — navigate via clicking "More" then "Settings" to ensure proper initialization
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Open "More" drawer
  await page.locator('button:has-text("More")').click();
  await page.waitForTimeout(500);
  // Click Settings in the drawer
  await page.locator('button:has-text("Settings")').click();
  await page.waitForTimeout(2000);
  await shot(page, '09-settings');

  // Add-expense modal
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const addBtn = page.locator('button:has-text("Add")').first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(700);
    await shot(page, '10-add-expense');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Quick-add standalone page
  await page.goto(`${BASE}/quick-add`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '11-quick-add');

  // ── PWA user-flow GIF ───────────────────────────────────────────────────────
  console.log('\n── Capturing GIF frames ───────────────────────────────────────');

  // --- Scene 1: Dashboard hero (hold 3 frames = ~0.3s at 10fps)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await frame(page, 18);   // ~1.8s hold on dashboard

  // --- Scene 2: Scroll down slowly to show trend + categories
  for (let y = 0; y <= 400; y += 40) {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(80);
    await frame(page, 2);
  }
  await frame(page, 12);  // pause on trend chart

  // --- Scene 3: Navigate to Expenses
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.goto(`${BASE}/expenses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await frame(page, 15);

  // --- Scene 4: Open Add Expense modal
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const addBtnGif = page.locator('button:has-text("Add")').first();
  if (await addBtnGif.isVisible()) {
    await addBtnGif.click();
    await page.waitForTimeout(700);
    await frame(page, 18);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // --- Scene 5: Reports
  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await frame(page, 18);

  // --- Scene 6: Calendar
  await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await frame(page, 15);

  // --- Scene 7: Subscriptions
  await page.goto(`${BASE}/subscriptions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await frame(page, 15);

  // --- Scene 8: Tasks
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await frame(page, 15);

  // --- Scene 9: Settings
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await frame(page, 15);

  // --- Scene 10: Back to dashboard (loop end)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await frame(page, 20);

  console.log('\nBuilding GIF...');
  await buildGif('app-tour', 10);

  await browser.close();
  console.log('\nAll done! Files saved to .github/screenshots/\n');
})();

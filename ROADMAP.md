# SpendWise — Product Roadmap & Improvement Ideas

---

## High-Impact Features

### Smart Budgeting
- Per-category monthly budget alerts (infrastructure exists in `useBudgetStore`, but no push notifications or visual warnings when approaching limits)
- "Envelope budgeting" — allocate income into buckets, track what's left

### Recurring Expenses
- ✅ Shipped — `src/services/recurringProcessor.ts` auto-logs recurring expenses on app load
- Upcoming subscription reminder strip on dashboard

### Receipt Scanning
- Camera → OCR → auto-fill amount/merchant using a free API (Tesseract.js client-side, or a small Cloudflare Worker)

### Split & Settle (Groups)
- The Groups page exists but likely lacks a "settle up" flow — who owes whom, one-tap settle with history

---

## UX / Interaction Improvements

### Onboarding
- ✅ Shipped — `src/components/ui/OnboardingWizard.tsx`, wired into `AppLayout`

### Quick Add
- ✅ Shipped — `src/features/quick-add/QuickAddPage.tsx` + `DraggableFab.tsx`
- Home screen widget via `share_target` in PWA manifest — receive amounts from other apps (see PWA Hardening below — the manifest entry itself is done, `ShareTargetPage.tsx` handles it)

### Search & Filter
- ✅ Shipped — `src/components/ui/GlobalSearch.tsx`

### Gestures
- ✅ Shipped — `src/components/ui/SwipeableRow.tsx` used across expense/task lists

---

## Design / Theme Improvements

### Theme System
- Current: single dark theme with CSS vars — already structured for multi-theme
- Add presets: AMOLED Black, Midnight Blue, Forest Green, Rose Gold
- Let users pick accent color (swap `--brand` value)

### Typography Scale
- `text-[9px]` / `text-[10px]` labels too small on older devices — add "comfortable" display size setting in Settings

### Dashboard Redesign
- Replace flat card list with a spending wheel (donut chart) as the hero element
- Add a monthly spend sparkline in the header (7-day trend inline with the balance)

### Haptic Feedback
- ✅ Shipped — `src/core/haptics.ts` (light/medium/success/delete patterns), check call sites cover all the actions listed here

---

## Productization / Growth

### Data Portability
- PDF statement export — one page, printable, looks like a bank statement
- Import from bank CSV (HDFC / SBI / ICICI column mappings)

### PWA Hardening
- ✅ Shipped — `share_target` configured in `vite.config.ts` manifest, handled by `ShareTargetPage.tsx`
- Background sync: queue offline changes, flush when online (instead of relying solely on Drive sync)

### Notifications
- Web Push API for budget alerts and overdue tasks — store subscription in Drive alongside backup

### Analytics Depth
- Merchant-level tracking (payee field on expenses) → "You spent ₹4,200 at Swiggy this month"
- Weekday vs weekend spend breakdown
- Year-over-year comparison in Reports

### Multi-profile / Family Mode
- Groups exist per-expense; a full "family vault" — shared budget, each member logs their own, one household dashboard

### Monetization Hooks
- Free tier: 3 months history, 1 Drive account
- Pro (₹99/mo): unlimited history, PDF exports, recurring auto-log, push notifications, live FX rates
- Settings page is a natural place for a "Go Pro" banner

---

## Quick Wins (low effort, high polish)

| What | Where | Effort |
|---|---|---|
| ✅ Confetti animation when all checklist items checked | TaskCard | Shipped |
| ✅ "Good morning / evening" greeting on Dashboard | DashboardPage header | Shipped |
| ✅ Skeleton loading screens instead of spinner | All lazy routes | Shipped |
| Long-press category icon to edit it inline | Category picker | 2h |
| Monthly summary share card (screenshot-ready) | Reports | 3h |
| Drag-to-reorder checklist items | TaskForm | 2h |

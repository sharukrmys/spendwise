# Spend Right — Complete Documentation

> **Offline-first · 100% Private · Zero server data**
> All data lives on your device (IndexedDB) or your own Google Drive — nothing is ever sent to any app server.

---

## Table of Contents

1. [App Overview](#1-app-overview)
2. [Features](#2-features)
3. [Navigation & Layout](#3-navigation--layout)
4. [Expenses & Income](#4-expenses--income)
5. [Dashboard](#5-dashboard)
6. [Reports](#6-reports)
7. [Calendar View](#7-calendar-view)
8. [Groups & Expense Splitting](#8-groups--expense-splitting)
9. [Settings](#9-settings)
10. [Data Storage Architecture](#10-data-storage-architecture)
11. [Google Drive Sync](#11-google-drive-sync)
12. [Shared Groups — How It Works](#12-shared-groups--how-it-works)
13. [Security & Privacy](#13-security--privacy)
14. [Data Export & Import](#14-data-export--import)
15. [Technical Stack](#15-technical-stack)

---

## 1. App Overview

**Spend Right** is a personal finance tracker built as a Progressive Web App (PWA). It is designed around three core principles:

| Principle | What it means |
|-----------|--------------|
| **Offline-first** | Works fully without internet. Data is written to your device first, synced later when connectivity is available. |
| **Zero server storage** | No app backend ever stores your financial data. Sync goes directly to your own Google Drive account. |
| **Privacy by design** | The only parties who can read your data are you and anyone you explicitly share a group invite code with. |

---

## 2. Features

| Feature | Description |
|---------|-------------|
| Expense & income tracking | Log transactions with amount, category, payment method, notes, date |
| Category management | Default + custom categories with sub-categories, emoji icons, and color coding |
| Monthly budget | Set a monthly spending limit with a live progress bar on the dashboard |
| Recurring transactions | Mark expenses as recurring with daily/weekly/monthly/yearly intervals |
| Multi-currency | Per-transaction currency with a configurable default currency |
| Group expense splitting | Create groups, add members, split bills equally or with custom amounts, settle up |
| **Shared groups** | Share a group across multiple users via Google Drive invite code — no server |
| Google Drive sync | One-tap backup/restore to your own Drive; bidirectional smart sync |
| Reports & charts | Spending trend, category breakdown, payment method analysis |
| Calendar view | Month and week views showing daily spending heatmap |
| Themes | Dark, Light, System — persisted across sessions |
| Compact mode | Denser expense list for power users |
| CSV & JSON export | Export your full data for use in spreadsheets or external tools |
| JSON import | Restore from a backup file |

---

## 3. Navigation & Layout

### Global Top Bar (all screens)
A persistent header bar is shown at the top of every screen. It contains:
- **Logo (left)** — the Spend Right brand mark
- **Search icon** — taps directly into the Expenses search/filter view
- **Sync icon** *(visible when Google Drive is connected)* — triggers a smart bidirectional sync; spins while active, turns green on success
- **Settings icon** — opens Settings

### Bottom Navigation Bar
Five tabs accessible from anywhere:
- **Home** — Dashboard with spending summary, donut chart, budget bar, trend sparkline
- **Expenses** — Full transaction list with search, filter, and month navigation
- **Reports** — Spending analytics with charts
- **Calendar** — Month/week calendar with spending heatmap
- **Groups** — Shared expense groups

### Add Transaction (FAB)
A draggable floating action button (bottom-right on most screens) opens the Add Transaction form. Draggable so it never obscures content you're reading.

---

## 4. Expenses & Income

### Adding a Transaction
Tap the **+** FAB or the **+ Add Expense** button. Fill in:
- **Type** — Expense or Income
- **Amount + Currency**
- **Category** (and optional subcategory)
- **Payment method** — Cash, Card, UPI, Bank transfer, Crypto, Other
- **Date**
- **Notes** (optional)
- **Recurring** toggle — set interval if enabled

### Editing / Deleting
Tap any transaction in the list to edit. Swipe or use the delete action within the edit form to remove it.

### Searching & Filtering
In the Expenses screen:
- Live **search** by notes or amount
- **Month navigator** — swipe between months using chevron arrows
- **Filter panel** — filter by type (All / Expense / Income)
- **Sort** — by date (newest first) or by amount

---

## 5. Dashboard

The home screen gives a high-level snapshot of the current month:

| Section | What it shows |
|---------|--------------|
| **Greeting** | Your first name (from Google profile when synced) with profile photo |
| **Privacy badge** | Confirms: offline-first, zero server data |
| **Donut chart** | Top 5 spending categories, total spent in the center |
| **Monthly spend** | Large total figure for the current month |
| **Budget bar** | Progress toward your monthly budget (turns red above 85%) |
| **Spending trend** | 6-month area sparkline; taps through to full reports |
| **Top categories** | Category breakdown with mini bar indicators |
| **Recent expenses** | Last 6 expense transactions |

---

## 6. Reports

Three time periods: **Month**, **Quarter**, **Year**.

Charts:
- **Bar chart** — daily or monthly spending bars
- **Category pie** — spending by category
- **Payment method breakdown** — which payment methods you use most
- **Month-over-month trend** — area chart of total spending over time

---

## 7. Calendar View

Two view modes toggled at the top:
- **Month view** — grid of all days; cells are shaded by daily spend intensity (heat map). Tap a day to see all transactions for that day in a bottom sheet.
- **Week view** — scrollable week strip with the same heat shading; selected-day transactions shown inline below.

---

## 8. Groups & Expense Splitting

### Creating a Group
1. Tap **Groups** → **New Group**
2. Set group name, optional description, and group currency
3. Add members (name + optional email)

### Adding a Group Expense
1. Open the group → **Add Expense**
2. Set description, amount, who paid, and split type:
   - **Equal** — amount divided evenly across all members
   - **Custom** — set exact amounts per member

### Settling Up
In the expense card, tap **Settle** next to any member's split to mark it as paid. The Balances tab shows a net summary (who owes whom overall).

### Sharing a Group (Multi-user sync)
See [Section 12](#12-shared-groups--how-it-works) for the full flow.

Quick summary:
- **Owner** taps **Share this Group** → a Drive file is created → copy the invite code
- **Members** tap **Join Group** on the Groups screen → paste the invite code → group and expenses are imported
- Anyone can tap **Sync Group Now** to pull the latest data and push their changes

---

## 9. Settings

| Section | Options |
|---------|---------|
| **Appearance** | Dark / Light / System theme; Compact mode; Show cents |
| **Preferences** | Default currency; Default payment method; Week start day |
| **Budget** | Set / edit / remove monthly spending limit |
| **Categories** | Add custom categories and subcategories with emoji + color |
| **Cloud Sync** | Connect / disconnect Google Drive; Auto-sync toggle; Manual sync; Restore from Drive; Delete cloud backup |
| **Data & Backup** | Export JSON; Export CSV; Import JSON; Clear local data |

---

## 10. Data Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Browser                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              IndexedDB  (Dexie.js)                    │  │
│  │  expenses · categories · tags · budgets               │  │
│  │  groups · groupExpenses · settings                    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              localStorage                             │  │
│  │  Google OAuth token · token expiry · user profile     │  │
│  │  sync state (enabled, lastSyncAt, autoSync)           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │ (when sync is enabled)
              ▼
┌─────────────────────────────────────────────────────────────┐
│                   YOUR Google Drive                          │
│  appDataFolder/expense-backup.json  ← personal backup       │
│  sr-group-{id}.json  (×N)          ← shared group files     │
└─────────────────────────────────────────────────────────────┘
```

**No app servers. No databases. No analytics. Zero third-party data sharing.**

### IndexedDB Tables

| Table | Contents |
|-------|---------|
| `expenses` | All income and expense transactions |
| `categories` | Default + custom categories and subcategories |
| `tags` | User-defined tags |
| `budgets` | Monthly/weekly/yearly budget limits |
| `groups` | Group metadata (members, currency, shareCode) |
| `groupExpenses` | Expense records within groups (with split details) |
| `settings` | App preferences (theme, currency, etc.) |

---

## 11. Google Drive Sync

### How It Works

1. **Connect** — tap Settings → Cloud Sync → Connect Google Drive. A Google OAuth popup appears. You grant permission to:
   - `drive.appdata` — read/write a private app folder in your Drive (invisible in Drive UI)
   - `openid email profile` — read your name and profile photo

2. **Push** — the app serialises all data to a single JSON file (`expense-backup.json`) and writes it to your Drive's `appDataFolder`. This folder is private — only this app can read it, not even you from the Drive website.

3. **Pull / Restore** — reads the same file back and replaces local data. Useful when switching devices.

4. **Smart Sync** (the sync button in the top bar):
   - Reads the cloud file's `exportedAt` timestamp
   - If cloud is **newer** → pulls and merges, then pushes back with updated timestamp
   - If local is **newer or equal** → pushes local data to cloud
   - Net effect: the most recent version always wins

5. **Auto-sync** — when enabled, any data change triggers a 2-second debounced push so your Drive is always up to date.

### Token Lifecycle
- OAuth tokens are short-lived (1 hour). The app transparently re-requests a token when the cached one expires — no re-login required unless you revoke access.
- Tokens are stored in `localStorage` for the session. They are cleared on disconnect.

### What is `appDataFolder`?
It is a special hidden Google Drive folder created per-app. Files in it:
- Are not visible in your Google Drive UI
- Cannot be accessed by any other app
- Are not shared with anyone
- Are fully owned by you and deleted when you remove the app's Drive access

---

## 12. Shared Groups — How It Works

This feature lets multiple people collaborate on the same group **without any app server**. All coordination happens through a regular Google Drive file that every member has write access to.

### Technical Mechanism

```
Owner device                      Google Drive                  Member device
─────────────────────────────────────────────────────────────────────────────
1. Create group locally
2. Tap "Share this Group"
3. POST /drive/v3/files          → sr-group-{id}.json created
4. PATCH /files/{id}/permissions → role:writer, type:anyone
5. Copy fileId as "invite code"
                                                    6. Paste invite code
                                                    7. GET /files/{id}?alt=media
                                                    8. Import group + expenses
                                                    9. Save locally with shareCode

──── Any member taps "Sync Group Now" ────────────────────────────────────────
A. GET /files/{id}?alt=media  (pull latest from Drive)
B. Merge expenses by ID (newest createdAt wins)
C. Merge member list (union — no member is ever lost)
D. PUT /files/{id}            (push merged result back)
```

### Permission Model
- The Drive file uses `role: "writer", type: "anyone"` — meaning any authenticated Google user who knows the file ID can read and write it.
- The file ID itself acts as a secret key — it is a 28-character random Google-generated string. Treat it like a password.
- The group owner can tap **Stop Sharing** to delete the Drive file and revoke all access at once. Members who have already joined retain their local copy.

### Conflict Resolution
- **Expenses**: union merge by `id`. If the same expense ID exists on both sides, the one with the higher `createdAt` wins.
- **Members**: union merge by `id`. Members are never removed by a sync (only by explicitly removing them).
- **Group metadata** (name, currency): the device that syncs last wins.

### Limitations
- All participants must have a Google account and must connect Drive sync before joining a shared group.
- Sync is manual (tap "Sync Group Now") or triggered when you open a group. There is no real-time push — think of it as "optimistic sync on demand".
- Simultaneous writes from two devices without syncing between them will result in a merge — no data is lost, but the last sync timestamp determines which metadata wins.

---

## 13. Security & Privacy

### What data leaves your device?

| Scenario | Data transmitted | Destination |
|----------|-----------------|-------------|
| No Drive connected | Nothing | — |
| Drive sync enabled | Encrypted-in-transit backup JSON | Your Google Drive only |
| Shared group | Group JSON (members + expenses) | A specific Drive file you created |
| Google sign-in | OAuth token exchange | Google's auth servers |

**The app has no backend. There is no API server. No analytics. No crash reporting.**

### OAuth Scopes Requested

| Scope | Purpose |
|-------|---------|
| `drive.appdata` | Private per-app backup folder |
| `openid email profile` | Display your name and photo in the app |

### Data at Rest
All data is stored in browser **IndexedDB** and **localStorage**. Neither is encrypted at rest by default (browser sandbox enforces isolation between origins). Enable your device's full-disk encryption for an additional layer of protection.

### OAuth Token Storage
The short-lived Google access token is stored in `localStorage` (key: `gd_token`). It expires after 1 hour. The app uses Google Identity Services (GIS) Token Client — no refresh tokens are stored.

### Disconnect at Any Time
- Settings → Cloud Sync → Disconnect Google Drive
- This clears the cached token and user profile from `localStorage`
- Your local data is unaffected
- Your Drive `appDataFolder` data is kept (you can delete it from Google Account → Security → Third-party app access)

---

## 14. Data Export & Import

### JSON Export (Full Backup)
Settings → Export JSON backup  
Exports a JSON file containing all expenses, categories, tags, budgets, groups, and group expenses. Filename: `expenses-backup-YYYY-MM-DD.json`.

**Restore**: Settings → Import backup → select the JSON file.

### CSV Export
Settings → Export as CSV  
A flat CSV with one row per transaction. Columns: Date, Type, Amount, Currency, Category, Payment, Notes, Recurring. Suitable for Excel, Google Sheets, or Numbers.

### What the Backup Contains

```json
{
  "version": 1,
  "exportedAt": 1712345678901,
  "expenses": [...],
  "categories": [...],
  "tags": [...],
  "budgets": [...],
  "groups": [...],
  "groupExpenses": [...]
}
```

### Clear Local Data
Settings → Clear local data  
Removes all expenses, groups, group expenses, budgets, and tags from IndexedDB in the current browser. Does **not** affect your Google Drive backup.

---

## 15. Technical Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript (Vite) |
| Styling | Tailwind CSS v4 (CSS-first config) |
| Local database | Dexie.js (IndexedDB wrapper) |
| State management | Zustand with `persist` middleware |
| Charts | Recharts |
| Date utilities | date-fns |
| Cloud sync | Google Drive REST API v3 via GIS Token Client |
| Icons | Lucide React |
| Routing | React Router v6 |
| Build | Vite with lazy-loaded route chunks |

### Key Architectural Decisions

**Offline-first via IndexedDB**: All reads and writes go to IndexedDB first. The Drive sync is a background operation that never blocks the UI.

**No service worker required**: The app works offline because all data is in IndexedDB. A service worker can be added for shell caching in a future version.

**Lazy route loading**: Each page is a separate chunk (`React.lazy` + `Suspense`). The initial bundle is small; pages load on first navigation.

**Zustand stores**: One store per domain (`useExpenseStore`, `useCategoryStore`, `useBudgetStore`, `useGroupStore`, `useSettingsStore`, `useSyncStore`). The sync store uses `persist` middleware to remember the connected state across page reloads without re-running OAuth.

**Google Drive `appDataFolder` for personal backup**: Invisible to the user in Drive UI, inaccessible to other apps, deleted automatically if the user removes app access. Perfect for private backups.

**Regular Drive files for shared groups**: Shared groups need a file that multiple Google accounts can access. Regular Drive files with `role:writer, type:anyone` permission achieve this. The file ID is the invite code.

---

*Document version: 1.0 — reflects app state as of implementation.*

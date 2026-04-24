<p align="center">
  <img src=".github/sr-logo.png" alt="SR Logo" width="280" />
</p>

<h1 align="center">SR Expense</h1>

<p align="center">
  <strong>Offline-first personal finance tracker — private, powerful, mobile-ready.</strong><br/>
  Built by <strong>SR</strong> &nbsp;·&nbsp; No backend &nbsp;·&nbsp; No sign-up &nbsp;·&nbsp; Your data stays on your device.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/PWA-Installable-7C5CFC?logo=pwa&logoColor=white" alt="PWA" />
</p>

---

## Features

| Feature           | Description                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Dashboard**     | Net balance, income/expense summaries, donut chart, spending trend, budget progress  |
| **Expenses**      | Full CRUD with search, filters by category/payment method, month navigation          |
| **Categories**    | 15 built-in categories with emoji icons, custom category support                     |
| **Reports**       | Monthly/quarterly/yearly analytics with charts and daily averages                    |
| **Calendar**      | Visual calendar view showing daily spending with heat indicators                     |
| **Groups**        | Split expenses with friends — add members, track balances, settle up                 |
| **Budgets**       | Monthly budget tracking with visual progress bars                                    |
| **Settings**      | Dark/light/system theme, currency selection (10 currencies), payment method defaults |
| **PWA**           | Install as native app on iOS & Android — works fully offline                         |
| **Offline-first** | All data stored in IndexedDB (Dexie.js) — no server needed                           |
| **Draggable FAB** | Floating action button that can be repositioned anywhere on screen                   |

## Tech Stack

| Layer          | Technology                |
| -------------- | ------------------------- |
| **Framework**  | React 19 + TypeScript 6.0 |
| **Build**      | Vite 8                    |
| **Styling**    | Tailwind CSS 4            |
| **State**      | Zustand 5                 |
| **Database**   | Dexie.js (IndexedDB)      |
| **Charts**     | Recharts 3                |
| **Icons**      | Lucide React              |
| **Routing**    | React Router 7            |
| **Animations** | Framer Motion             |
| **Search**     | Fuse.js                   |
| **PWA**        | vite-plugin-pwa (Workbox) |

## Project Structure

```
expense-manager/
├── public/                     # Static assets & PWA icons
├── src/
│   ├── components/
│   │   ├── layout/             # AppLayout, BottomNav, PageHeader
│   │   └── ui/                 # Button, Card, Modal, Input, Toast, DraggableFab, etc.
│   ├── core/
│   │   ├── constants.ts        # Default categories, currencies, settings
│   │   ├── types.ts            # TypeScript interfaces
│   │   └── utils.ts            # Currency formatting, date helpers
│   ├── db/
│   │   ├── schema.ts           # Dexie DB schema, seed defaults
│   │   └── queries.ts          # Database query functions
│   ├── features/
│   │   ├── dashboard/          # Home page with summary widgets
│   │   ├── expenses/           # Expense list, form, item components
│   │   ├── reports/            # Analytics & charts
│   │   ├── calendar/           # Calendar view
│   │   ├── groups/             # Group expense splitting
│   │   └── settings/           # App settings
│   ├── store/                  # Zustand stores (expenses, categories, budgets, groups, settings)
│   ├── App.tsx                 # Root component with routing
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles, theme variables, utilities
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9 (or pnpm / yarn)

## Getting Started

```bash
# Clone the repo
git clone <your-repo-url>
cd expense-manager

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will be available at **http://localhost:5173**

### Available Scripts

| Command           | Description                       |
| ----------------- | --------------------------------- |
| `npm run dev`     | Start development server with HMR |
| `npm run build`   | Type-check + production build     |
| `npm run preview` | Preview production build locally  |
| `npm run lint`    | Run ESLint                        |

## Deployment

### Option 1: Netlify (Recommended — Free)

```bash
npm run build
npx netlify-cli deploy --prod --dir=dist
```

Or connect your GitHub repo at [netlify.com](https://netlify.com) for automatic deploys on push.

**Free tier:** 100 GB bandwidth/month, HTTPS, custom domains.

### Option 2: Vercel (Free)

```bash
npm run build
npx vercel --prod
```

Or import your repo at [vercel.com](https://vercel.com).

**Free tier:** Unlimited bandwidth for personal projects, HTTPS, custom domains.

### Option 3: Cloudflare Pages (Free)

```bash
npm run build
npx wrangler pages deploy dist --project-name=sr-expense
```

**Free tier:** Unlimited bandwidth, global CDN, HTTPS.

### Option 4: GitHub Pages (Free)

1. Push to GitHub
2. Go to **Settings → Pages → Source: GitHub Actions**
3. Add this workflow as `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm run build
        working-directory: expense-manager
      - uses: actions/upload-pages-artifact@v3
        with:
          path: expense-manager/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

> **Note:** For GitHub Pages, set `base: '/<repo-name>/'` in `vite.config.ts` if not deploying to a custom domain.

### Option 5: AWS S3 + CloudFront

```bash
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache (if using)
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

Enable **Static Website Hosting** on the S3 bucket and set both index and error document to `index.html`.

## Install as Mobile App (PWA)

Once deployed to any HTTPS URL:

### iOS (Safari)

1. Open the app URL in Safari
2. Tap the **Share** button (↑)
3. Tap **"Add to Home Screen"**
4. Tap **Add**

### Android (Chrome)

1. Open the app URL in Chrome
2. Tap the **⋮** menu
3. Tap **"Install app"** or **"Add to Home Screen"**

The app will appear on your home screen as a native app — full screen, no browser bar, works offline.

## Configuration

### Default Currency

Edit `src/core/constants.ts` → `DEFAULT_SETTINGS.defaultCurrency` (default: `INR`).

Available: USD, EUR, GBP, INR, JPY, CAD, AUD, CHF, SGD, AED.

### Theme

Supports **Dark**, **Light**, and **System** themes. Change in Settings page or edit `DEFAULT_SETTINGS.theme`.

### Categories

15 built-in categories. Add custom ones via the category management in settings. Categories are stored locally in IndexedDB.

## Data & Privacy

- **Zero backend** — all data is stored in your browser's IndexedDB
- **No accounts** — no sign-up, no login
- **No tracking** — no analytics, no telemetry
- **Offline-first** — works without internet after first load
- **Your data, your device** — nothing leaves the browser

> **Tip:** Export/import functionality can be added for backup. Data persists as long as browser data isn't cleared.

## License

MIT

---

<p align="center">
  Built with ❤️ by <strong>SR</strong>
</p>

--

Vercel doesn't have a "stop/start" toggle like a server — it's serverless static hosting, so:

No running costs — your app is just static files on a CDN. There's no server running. You only consume bandwidth when someone visits.
Free tier has no idle charges — you're not billed for time, only for bandwidth and build minutes.
If you want to take it offline temporarily:

cd /Users/appify/codebase/reactapp/expense-manager && npx vercel deploy --prod --prebuilt 2>&1


# Disable the production deployment (makes URL return 404)
cd /Users/appify/codebase/reactapp/expense-manager
npx vercel rm expense-manager --safe

npx vercel deploy --prod --prebuilt
vercel --prod --yes 2>&1
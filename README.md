# CanvasFlow — ELTE Canvas Academic Command Center

> A production-ready, set-and-forget personal academic command center connecting to the **ELTE Canvas LMS** (`https://canvas.elte.hu`). Built with Next.js, Prisma, Supabase PostgreSQL, and Vercel Serverless with automated 24/7 background synchronization and browser push notifications.

---

## 1. Production Cloud Architecture

```
                                  ELTE Canvas LMS
                              (canvas.elte.hu/api/v1)
                                         ▲
                                         │ HTTPS (Bearer Token)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Vercel Cloud Platform                            │
│                                                                             │
│   ┌─────────────────────┐   ┌───────────────────────┐   ┌───────────────┐   │
│   │ Next.js App Router  │   │  Serverless API &     │   │ Vercel Cron / │   │
│   │ UI (React 19)       │   │  Sync Engine          │   │ GitHub Action │   │
│   │ - Dashboard (/)     │   │  - /api/cron/sync     │   │ (Every 15min) │   │
│   │ - Calendar (/cal)   │   │  - /api/cron/notif    │   └───────┬───────┘   │
│   │ - Deep Link (/tasks)│   │  - Concurrency Lock   │           │           │
│   └──────────┬──────────┘   └───────────┬───────────┘           │           │
│              │                          │                       │           │
│              │                          ▼                       │           │
│              │                Prisma ORM (v6.4.1)               │           │
│              │               (Pooled Connection)                │           │
└──────────────┼──────────────────────────┬───────────────────────┼───────────┘
               │                          │                       │
               ▼ Web Push (VAPID)         ▼ Port 6543 (Pooler)    ▼ CRON_SECRET
       ┌───────────────┐         ┌────────────────────────┐
       │ Browser Tab / │         │  Supabase PostgreSQL   │
       │ ServiceWorker │         │  (Managed Database)    │
       │ (sw.js)       │         └────────────────────────┘
       └───────────────┘
```

---

## 2. Key Production Features

- **24/7 Automation**: Synchronizes Canvas courses, assignments, quizzes, and deadlines every 15 minutes in the cloud without requiring your computer to be running.
- **Set & Forget Push Notifications**: Browser push notifications via Web Push API for upcoming deadlines (24h, 6h, 1h), newly unlocked assignments, and rescheduled deadlines. Reminders arrive even when all browser tabs are closed.
- **Quiet Hours Enforcement**: Respects Europe/Budapest local quiet hours (e.g. 22:00 – 08:00) so notifications are safely held until morning.
- **Deep-Linked Task Pages**: Clicking a reminder notification navigates directly to `https://YOUR_DOMAIN/tasks/TASK_ID` with immediate cached task details and an "Open in Canvas" button.
- **Concurrency & Idempotency Locking**: Prevents overlapping sync jobs from causing race conditions or duplicate notification entries.
- **Air-Tight Security**: Personal Canvas token is strictly server-side (`process.env.CANVAS_TOKEN`). Zero client-side leakage, zero public CDN caching of assignment data (`Cache-Control: private, no-cache`), and sanitized HTML via `isomorphic-dompurify`.
- **Diagnostics Dashboard**: Built-in `/debug` dashboard to verify live Canvas API connectivity, database health, and background notification queue states.

---

## 3. Production Deployment Guide (Step-by-Step)

### Step 1: Create a Supabase PostgreSQL Database

1. Go to [Supabase](https://supabase.com) and create a free account (or log in).
2. Click **New Project**, name it `canvasflow`, choose a strong database password, and select region **Central EU (Frankfurt)** for lowest latency to ELTE and Vercel.
3. Once the project is provisioned, go to **Project Settings** → **Database**.
4. Scroll down to **Connection parameters** and locate:
   - **Connection Pooling URL** (port `6543`, transaction mode): This is your `DATABASE_URL`.
     ```
     postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **Direct Connection URL** (port `5432`): This is your `DIRECT_URL` used for migrations.
     ```
     postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
     ```

### Step 2: Push Database Schema to Supabase

Run the migration against your Supabase database from your terminal:

```bash
# Set your Supabase connection strings in .env.local temporarily
DATABASE_URL="your_supabase_pooler_url"
DIRECT_URL="your_supabase_direct_url"

# Push schema and create all production tables and indexes
npx prisma db push
```

### Step 3: Generate Web Push VAPID Keys

Run the included key generator:

```bash
node scripts/generate-vapid-keys.mjs
```

Keep the generated `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` handy.

### Step 4: Generate ELTE Canvas Access Token

1. Log into your account at [canvas.elte.hu](https://canvas.elte.hu).
2. Navigate to **Profile** (avatar) → **Settings** (or *Beállítások*).
3. Scroll down to **Approved Integrations** and click **+ New Access Token** (*+ Új hozzáférési token*).
4. Set Purpose to `CanvasFlow Production` and generate the token. Copy it immediately.

### Step 5: Push Project to GitHub

Initialize Git and push to your private GitHub repository:

```bash
git add .
git commit -m "feat: production deployment readiness"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/canvasflow.git
git push -u origin main
```

### Step 6: Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and click **Add New...** → **Project**.
2. Select your `canvasflow` GitHub repository and click **Import**.
3. Under **Environment Variables**, enter all required production secrets:

| Variable Name | Description | Example / Source |
|---|---|---|
| `CANVAS_BASE_URL` | Canvas instance URL | `https://canvas.elte.hu` |
| `CANVAS_TOKEN` | ELTE Personal Access Token | `7~abc123...` (server-side only) |
| `CANVAS_MOCK_MODE` | Force live API mode | `false` |
| `DATABASE_URL` | Supabase Pooler URL | `postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase Direct URL | `postgresql://...@...pooler.supabase.com:5432/postgres` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public Web Push Key | From `node scripts/generate-vapid-keys.mjs` |
| `VAPID_PRIVATE_KEY` | Private Web Push Key | From `node scripts/generate-vapid-keys.mjs` |
| `VAPID_SUBJECT` | Web Push Contact URI | `mailto:your-email@example.com` |
| `CRON_SECRET` | Secret authorizing cron jobs | Generate 32+ random hex characters |
| `APP_URL` | Deployed application URL | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `https://your-app.vercel.app` |

4. Click **Deploy**. Vercel will install dependencies, automatically execute `prisma generate`, compile all pages, and deploy to global edge servers!

---

## 4. Automated 24/7 Background Synchronization

CanvasFlow supports two ways to trigger automatic 15-minute synchronization:

### Option A: Free GitHub Actions Scheduled Workflow (Recommended for Vercel Hobby)
Vercel Hobby plan only permits 1 cron run per day. To run every 15 minutes 100% free without a Vercel Pro subscription:
1. In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**.
2. Add two repository secrets:
   - `APP_URL`: `https://your-app.vercel.app`
   - `CRON_SECRET`: The same secret you entered in Vercel.
3. The included workflow `.github/workflows/cron-sync.yml` will automatically trigger `/api/cron/sync` and `/api/cron/notifications` every 15 minutes around the clock.

### Option B: Native Vercel Cron (Vercel Pro)
The included `vercel.json` automatically configures Vercel's managed cron scheduler:
- `/api/cron/sync` every 15 minutes (`*/15 * * * *`)
- `/api/cron/notifications` every 5 minutes (`*/5 * * * *`)

---

## 5. Production Acceptance Checklist

- [x] **Zero Local Dependencies**: App, API, database, and cron execute entirely in the cloud.
- [x] **Database Persistence**: Supabase PostgreSQL stores courses, tasks, and notifications across deployments.
- [x] **Prisma Client Automation**: `"postinstall": "prisma generate"` guarantees build reliability on Vercel.
- [x] **Serverless Connection Pooling**: Prepared for Supavisor pooler on port 6543.
- [x] **Canvas Token Protection**: Stored exclusively as server-side secret, never logged, never returned to browser.
- [x] **Concurrency Locking**: Prevents simultaneous sync executions.
- [x] **Task Status Recalculation**: Backend automatically transitions deadlines (`locked` → `available` → `due-soon` → `overdue`).
- [x] **Quiet Hours**: Respects Europe/Budapest local quiet hours (22:00 – 08:00).
- [x] **Direct Notification Deep-Links**: Clicks navigate to `/tasks/[id]`.
- [x] **XSS Sanitization**: `DOMPurify` scrubs assignment descriptions.
- [x] **Diagnostics Endpoint**: `/debug` monitors Canvas connectivity and notification queue.
- [x] **Automated Tests**: 15/15 unit tests pass (`npm test`).
- [x] **Build Verification**: `npm run build` succeeds with zero errors.

---

## 6. Local Development

To run locally for testing or development:

```bash
# 1. Install dependencies
npm install

# 2. Configure local environment
cp .env.example .env.local
# (Optional: set CANVAS_MOCK_MODE=true to run offline without credentials)

# 3. Run unit tests
npm test

# 4. Start development server
npm run dev
```

---

## 7. License

MIT © ELTE Student Academic Command Center

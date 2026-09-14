# CanvasFlow — ELTE Canvas Academic Command Center

> A production-ready, set-and-forget personal academic command center connecting to the **ELTE Canvas LMS** (`https://canvas.elte.hu`). Built with Next.js, Prisma, Supabase PostgreSQL, and Vercel Serverless with near-real-time adaptive synchronization and instant browser push notifications.

> [!IMPORTANT]
> **Architecture Clarification:** This is near-real-time adaptive polling (~60s target), not a Canvas webhook/event stream. Canvas REST API does not offer native outbound webhooks to standard student tokens; hence CanvasFlow utilizes an intelligent, adaptive polling controller with telemetry and automatic rate-limit backoff.

---

## 1. Near-Real-Time Adaptive Synchronization Architecture

```
                                  ELTE Canvas LMS
                               (canvas.elte.hu/api/v1)
                                          ▲
                                          │ HTTPS (Bearer Token)
                                          │ Monitors: X-Rate-Limit-Remaining, X-Request-Cost
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Vercel Cloud Platform                            │
│                                                                             │
│   ┌─────────────────────┐   ┌───────────────────────┐   ┌───────────────┐   │
│   │ Next.js App Router  │   │ Near-Real-Time        │   │ Cloud Trigger │   │
│   │ UI (React 19)       │   │ Adaptive Sync Engine  │   │ - Cron-job.org│   │
│   │ - Dashboard (/)     │   │ - 60s Target Interval │   │   (Every 60s) │   │
│   │ - Calendar (/cal)   │   │ - Controlled Concurr. │   │ - GitHub Action│  │
│   │ - Diagnostics(/debug│   │ - Detection Latency   │   │   (5m backup) │   │
│   │ - Deep Link (/tasks)│   │ - 429 Auto-Backoff    │   └───────┬───────┘   │
│   └──────────┬──────────┘   └───────────┬───────────┘           │           │
│              │                          │                       │           │
│              │                          ▼                       │           │
│              │                Prisma ORM (v6.4.1)               │           │
│              │             (SyncState & Telemetry)              │           │
│              │                          │                       │           │
│              │                          ▼ Port 5432 / 6543      │           │
│              │               ┌────────────────────────┐         │           │
│              │               │  Supabase PostgreSQL   │         │           │
│              │               │  (Managed Database)    │         │           │
│              │               └────────────────────────┘         │           │
│              │                                                  │           │
│              ▼ Immediate Web Push (Zero delay)                  ▼           │
│        ┌───────────────┐                               ┌────────────────┐   │
│        │ Phone/Browser │ ◄──────────────────────────── │ Web Push VAPID │   │
│        │ Push Delivery │                               │ (Immediate)    │   │
│        └───────────────┘                               └────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Adaptive Polling & Rate-Limit Strategy

Canvas REST API enforces dynamic, leaky-bucket rate limiting based on request cost rather than a fixed static interval. CanvasFlow adaptively inspects response headers and throttles accordingly:

| Canvas API State | Rate-Limit Remaining | Polling Interval | Action |
| :--- | :--- | :--- | :--- |
| **Healthy** | `> 400` or standard | **60 seconds** | Normal high-speed detection |
| **Mild Rate Pressure** | `200 – 400` | **90 seconds** | Slight interval escalation |
| **Moderate Pressure** | `100 – 200` | **120 seconds** | Controlled throttling |
| **High Rate Pressure** | `< 100` | **180 seconds+** | Aggressive backoff |
| **HTTP 429 Throttled** | `0` (throttled) | **Retry-After** / Exp. Backoff | Respects Canvas `Retry-After` header |

### Safe Step-Down Recovery
After rate pressure or an HTTP 429 event subsides, CanvasFlow requires **3 consecutive successful cycles** before stepping down to the next faster interval (`180s → 120s → 90s → 60s`). It **never** jumps directly from a 429 back to 60 seconds.

### Concurrency Locking
Overlapping synchronizations are strictly blocked via a distributed lease lock on `SyncRun`. If an execution crashes or a serverless worker recycles, leases auto-expire after 45 seconds to prevent deadlock.

---

## 3. Event-Driven Notification Pipeline

When CanvasFlow detects a meaningful change, it **does not wait** for another cron cycle:

```
Canvas change occurs (e.g. assignment unlocked or published)
  ↓ (~0–60s detection)
Sync engine detects change
  ↓
Database updated immediately
  ↓
Notification record created with unique `idempotencyKey`
  ↓
Immediate Web Push broadcast via VAPID
  ↓
Your phone / desktop receives push notification
```

### Supported Immediate Events:
1. **New Assignment / Quiz**: Newly published or visible.
2. **Assignment Unlocked**: Task availability timestamp reached (`unlock_at <= now`).
3. **Date Changes**: `due_at`, `unlock_at`, or `lock_at` rescheduled.
4. **Grading Updates**: Score or submission status recorded.

### Scheduled Deadline Reminders:
The background scheduler continues to handle safety deadline reminders:
- **24 hours before due**
- **6 hours before due**
- **1 hour before due**
- **Overdue notification**

All notifications utilize database-level idempotency keys (`idempotencyKey`), preventing duplicate notifications across retries or multiple triggers.

---

## 4. Scheduling & Platform Capabilities

To run approximately every 60 seconds 24/7 without needing your PC to stay on:

### Platform Comparison:

| Scheduler Infrastructure | Minimum Supported Trigger | Reliability for 60s Target | Setup Required |
| :--- | :--- | :--- | :--- |
| **Vercel Hobby** | 1 execution per day (`0 0 * * *`) | Cannot run 60s (Platform limit) | Built-in |
| **Vercel Pro** | 1 minute (`* * * * *`) | Reliable 60s | Paid ($20/mo) |
| **GitHub Actions** | 5 minutes (`*/5 * * * *`) | Variable (5–15 min queue latency) | Configured in `.github/workflows/cron-sync.yml` |
| **Cron-job.org (Recommended)** | **1 minute (60s)** | **Very High (Free, reliable)** | Free account hitting `/api/cron/sync` |
| **Upstash QStash** | **1 minute (60s)** | **Enterprise Grade** | Free tier (500 msgs/day) or $1/mo |

### Setting up Free 60-Second Trigger with Cron-job.org:
1. Create a free account at [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **URL**: `https://YOUR_APP.vercel.app/api/cron/sync`
   - **Schedule**: Every 1 minute (`* * * * *`)
   - **Request Method**: `POST`
   - **Request Headers**:
     - `Authorization`: `Bearer YOUR_CRON_SECRET`
     - `Content-Type`: `application/json`
3. Save the job. CanvasFlow will now synchronize 24/7 every 60 seconds in the cloud.

---

## 5. System Diagnostics Dashboard (`/debug`)

The `/debug` page provides real-time operational telemetry:
- **Canvas connection**: `CONNECTED` / `ERROR`
- **Sync mode**: `Adaptive near-real-time`
- **Target interval**: `60 sec`
- **Current interval**: Dynamic interval (`60s`, `90s`, `120s`, `180s`)
- **Last sync & Last successful sync**: Precise timestamps and relative age
- **Sync duration**: Milliseconds taken by the last sync run
- **Detection latency**: Measured difference between Canvas event timestamp and detection time (Last, Average, Worst)
- **Canvas rate-limit remaining**: Remaining request credit
- **Last request cost**: Cost consumed by the most recent request
- **Current backoff**: Active backoff countdown or `none`
- **Recent Sync Runs**: Historical log of last 8 executions with change counts and statuses
- **Trigger Sync Now**: Safe immediate manual sync respecting backoff and showing rate limit notices if Canvas is throttled.

---

## 6. Testing & Production Verification

```bash
# Typecheck
npx tsc --noEmit

# Run complete test suite (38 unit & integration tests)
npm test

# Production build
npm run build
```

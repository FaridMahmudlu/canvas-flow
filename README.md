<div align="center">

# 🎓 CanvasFlow

### Next-Gen Academic Command Center & Multi-University Canvas LMS Sync

<p align="center">
  <strong>A high-performance, privacy-first academic productivity platform connecting students to any Canvas LMS institution worldwide with near-real-time adaptive synchronization, AES-256-GCM encrypted multi-tenancy, and instant event-driven Web Push alerts.</strong>
</p>

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Security: AES-256-GCM](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![Tests: 51 Passed](https://img.shields.io/badge/Tests-51%20Passed-success?style=for-the-badge&logo=jest)](https://github.com/FaridMahmudlu/canvas-flow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

---

## ⚡ Highlights

- 🌐 **Universal Multi-University Architecture**: Connects seamlessly with any Canvas LMS instance—from ELTE (`https://canvas.elte.hu`), Oxford, Harvard, to Canvas Cloud (`instructure.com`).
- 🔒 **Zero-Exposure Security**: Student Canvas API tokens are **never** transmitted to the browser or stored in plain-text. All credentials are encrypted at rest using **AES-256-GCM** with random 96-bit initialization vectors (IV) and 128-bit authentication tags.
- ⚡ **Near-Real-Time Adaptive Engine**: Sub-60-second change detection powered by an adaptive leaky-bucket controller that monitors Canvas API rate limits (`X-Rate-Limit-Remaining`, `X-Request-Cost`) and auto-throttles to prevent HTTP 429 penalties.
- 🔔 **Instant Event-Driven Web Push**: Direct notification pipeline triggered the instant an assignment is published, rescheduled, or unlocked, as well as when quiz grades are recorded—dispatched straight to your mobile phone or desktop even when the browser tab is closed.
- 🧠 **Intelligent Task Lifecycle Engine**: Real-time status recalculation (`upcoming`, `available`, `due-soon`, `submitted`, `overdue`, `locked`) with dynamic urgency weighting and priority sorting.
- 📊 **Live Operational Telemetry Dashboard**: Complete visibility on `/debug` displaying live Canvas API rate limits, rolling detection latencies, active backoff timers, and sync execution logs.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Client["Student Devices & Web Browser"]
        PWA["CanvasFlow PWA (Next.js 15 App Router)"]
        SW["Service Worker (sw.js) - Web Push Listener"]
    end

    subgraph Platform["CanvasFlow Cloud (Vercel Serverless)"]
        direction TB
        Auth["Auth.js v5 (JWT Sessions + Sliding-Window Rate Limiter)"]
        Crypto["AES-256-GCM Security Layer (Crypto API)"]
        Sync["Near-Real-Time Adaptive Engine (60s Target)"]
        Scheduler["Event & Deadline Notification Scheduler"]
        Telemetry["Telemetry & Rate-Limit Controller"]
    end

    subgraph Storage["Persistent Cloud Database (Supabase)"]
        DB[(Supabase PostgreSQL)]
        Prisma["Prisma ORM (Connection Pooling via Supavisor)"]
    end

    subgraph CanvasLMS["Canvas LMS REST APIs (Multi-Institution)"]
        ELTE["ELTE Canvas (canvas.elte.hu)"]
        UnivX["University X (canvas.instructure.com)"]
        UnivY["Custom Institution Canvas"]
    end

    subgraph WebPush["Web Push Infrastructure"]
        VAPID["VAPID Push Service (Mozilla/Google/Apple)"]
    end

    PWA <-->|HTTPS / Secure Cookies| Auth
    Auth <--> Prisma
    Sync <-->|Encrypted Read/Write| Crypto
    Crypto <--> Prisma
    Prisma <--> DB
    Sync -->|HTTPS Bearer Auth| CanvasLMS
    Sync --> Scheduler
    Scheduler -->|Signed VAPID Payload| VAPID
    VAPID -->|Push Notification| SW
    SW --> PWA
    Sync --> Telemetry
    Telemetry --> Prisma
```

---

## 🔐 Security & Privacy Architecture

CanvasFlow was engineered from day one with enterprise security and strict student data privacy:

| Security Vector | Implementation Detail | Guarantee |
| :--- | :--- | :--- |
| **Token Storage** | `AES-256-GCM` authenticated symmetric cipher | No plain-text tokens in DB or logs; tampering triggers an auth tag failure. |
| **Key Management** | Separate `ENCRYPTION_KEY` & `AUTH_SECRET` environment secrets | Database breaches cannot decrypt credentials without external platform secrets. |
| **Client Exposure** | Server-side only token execution | The client browser **never** receives or queries the Canvas access token directly. |
| **Session Security** | HTTP-Only, Secure, SameSite=Lax JWT cookies | Protection against Cross-Site Scripting (XSS) and token theft. |
| **Brute Force Defense** | In-memory sliding-window IP rate limiter on `/api/auth/*` | Protects registration and login endpoints from credential stuffing. |
| **Redirect Safety** | Strict URL whitelist parser (`getSafeCallbackUrl`) | Blocks open-redirect vulnerabilities and protocol-relative phishing attacks. |
| **Cron Protection** | Timing-safe secret verification (`crypto.timingSafeEqual`) | Immunizes scheduled automation endpoints against side-channel timing attacks. |

---

## 🚀 Quickstart & Local Development

Follow these steps to set up and run CanvasFlow on your local machine:

### Prerequisites
- **Node.js**: `v18.17.0` or higher (Node 20+ recommended)
- **npm** or **pnpm**
- **PostgreSQL Database**: A free [Supabase](https://supabase.com) project or local PostgreSQL instance

### 1. Clone the Repository
```bash
git clone https://github.com/FaridMahmudlu/canvas-flow.git
cd canvas-flow
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create your local configuration by copying `.env.example`:
```bash
cp .env.example .env.local
```

Populate the required keys in `.env.local`:
```env
# 1. NextAuth / Session Secret (generate with: openssl rand -base64 32)
AUTH_SECRET="your-32-byte-base64-secret"
AUTH_TRUST_HOST=true
AUTH_URL="http://localhost:3000"

# 2. Multi-Tenant AES-256-GCM Key (generate with: openssl rand -hex 32)
ENCRYPTION_KEY="your-64-character-hex-encryption-key"

# 3. Database (Supabase PostgreSQL Connection Strings)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# 4. Web Push VAPID Keys (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-vapid-key"
VAPID_PRIVATE_KEY="your-private-vapid-key"
VAPID_SUBJECT="mailto:your-email@university.edu"

# 5. Background Cron Security
CRON_SECRET="your-strong-random-cron-secret"

# 6. Canvas LMS Base URL (Defaults to ELTE Canvas; users can connect their own)
CANVAS_BASE_URL="https://canvas.elte.hu"
CANVAS_MOCK_MODE=false
```

### 4. Setup Prisma Database Schema
Generate the Prisma Client and push the schema to your database:
```bash
# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### 5. Run the Automated Test Suite
CanvasFlow includes 51 unit and integration tests covering token encryption, auth security, adaptive throttling, semester parsing, and task priority:
```bash
npm test
```

### 6. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎓 Connecting Your University Canvas Account

Students from any Canvas LMS university can link their account in less than 60 seconds:

1. **Log in** to your university Canvas web portal (e.g., `https://canvas.elte.hu` or your university URL).
2. Click **Account** (your profile icon in the left sidebar) ➔ **Settings**.
3. Scroll down to **Approved Integrations** and click **+ New Access Token**.
4. In the **Purpose** box, enter `CanvasFlow` and leave the expiration date blank (or choose a future date), then click **Generate Token**.
5. Copy the generated token string.
6. In **CanvasFlow**, navigate to **Settings** ➔ **Connected Canvas Accounts** ➔ click **+ Connect Canvas**.
7. Paste your university Canvas URL (e.g., `https://canvas.elte.hu`) and your **Access Token**, then click **Verify & Save**.
8. CanvasFlow will instantly encrypt your token, verify connection health, and initiate your academic synchronization.

---

## ⏱️ Near-Real-Time Adaptive Synchronization

Canvas LMS utilizes a **leaky-bucket rate limiter** that assigns costs to API requests. To achieve fastest practical detection without exceeding API quotas, CanvasFlow dynamically recalculates sync intervals based on live telemetry:

| API Health State | Rate-Limit Remaining | Target Interval | Action Taken |
| :--- | :--- | :--- | :--- |
| **Optimal** | `> 400` credits | **60 seconds** | High-speed active detection |
| **Mild Pressure** | `200 – 400` credits | **90 seconds** | Controlled throttling |
| **Moderate Pressure** | `100 – 200` credits | **120 seconds** | Safety escalation |
| **High Pressure** | `< 100` credits | **180 seconds** | Aggressive backoff |
| **HTTP 429 Throttled** | `0` credits | **Dynamic Backoff** | Respects Canvas `Retry-After` header |

### Safe Step-Down Recovery
When returning from rate pressure, the controller enforces **3 consecutive healthy cycles** before stepping down to a faster interval (`180s → 120s → 90s → 60s`), guaranteeing safe and predictable operation.

### Time-Budget Guard & Crash Recovery
Serverless functions on platforms like Vercel enforce strict execution limits (e.g. 60 seconds). CanvasFlow enforces an internal **40-second time budget guard**:
- If network latency approaches 40s, the engine gracefully wraps up the batch, commits progress, and marks the run `completed`.
- Distributed concurrency locks auto-expire after 45 seconds to prevent deadlock from aborted worker recycling.

---

## 🔔 Immediate Web Push Pipeline

CanvasFlow bypasses waiting cycles when important academic events occur:

```
Canvas LMS change occurs (e.g., assignment unlocked or grade posted)
   ↓ (~0–60s detection via adaptive engine)
Change detected & normalized into AcademicTask
   ↓
Database updated immediately via Prisma transaction
   ↓
Unique notification scheduled with database-level idempotencyKey
   ↓
Direct Web Push payload signed via VAPID
   ↓
Service worker displays instant push banner on your phone or desktop
```

### Real-Time Triggers:
- **New Task Published**: Immediate alert when an assignment or quiz is posted.
- **Task Unlocked**: Instant notification the moment assignment availability opens.
- **Deadline Changes**: Immediate notice if a professor extends or alters a due date.
- **Grade & Score Recorded**: Notification when assignment score or feedback is published.
- **Safety Reminders**: Automated reminders at `24 hours`, `6 hours`, and `1 hour` before deadlines.

---

## 🚢 Production Deployment on Vercel

1. **Import the Repository** on [Vercel](https://vercel.com).
2. Configure your **Environment Variables** in Vercel Project Settings (copy values from your `.env.local`).
3. Set the **Framework Preset** to **Next.js**.
4. **Deploy**: Vercel automatically builds and deploys the production bundle.
5. **Set up 60-Second Trigger (Recommended)**:
   - Create a free account at [cron-job.org](https://cron-job.org).
   - Add a cron job pointing to `https://your-domain.vercel.app/api/cron/sync`.
   - Set schedule to **Every 1 minute (`* * * * *`)**.
   - Add Header: `Authorization: Bearer YOUR_CRON_SECRET`.

---

## 🧪 Testing & Verification

CanvasFlow maintains rigorous code quality and regression testing:

```bash
# Typecheck TypeScript across the entire project
npx tsc --noEmit

# Run unit and integration tests
npm test

# Production build verification
npm run build
```

---

## 👨‍💻 Author & Maintainer

Developed and maintained with precision by:

**Farid Mahmudlu (SEK2L3)**
- **GitHub**: [@FaridMahmudlu](https://github.com/FaridMahmudlu)
- **Project**: [FaridMahmudlu/canvas-flow](https://github.com/FaridMahmudlu/canvas-flow)

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details. Open source and built for students worldwide.

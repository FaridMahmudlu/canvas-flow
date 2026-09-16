# Contributing to CanvasFlow

Thank you for your interest in contributing to **CanvasFlow**! We welcome contributions from developers and students around the world to improve academic productivity and Canvas LMS integration.

---

## 🔒 Security First: Critical Contribution Rules

1. **NEVER Commit Secrets or API Keys**:
   - Canvas personal access tokens, database connection strings (`DATABASE_URL`), `AUTH_SECRET`, `ENCRYPTION_KEY`, and VAPID private keys must **never** be committed to version control.
   - Always use `.env.local` for local secrets (this file is `.gitignore`'d).
   - If you accidentally commit a secret, notify the maintainers immediately and invalidate the key on Canvas / Supabase.

2. **Always Use Token Encryption**:
   - Any feature that handles Canvas credentials must store them using `encryptToken()` from `@/lib/crypto` and decrypt on demand with `decryptToken()`.
   - Never expose raw tokens to client components or send them in API responses.

---

## 🛠️ Development Workflow

### 1. Fork & Clone
```bash
# Fork the repository on GitHub, then clone your fork:
git clone https://github.com/YOUR_USERNAME/canvas-flow.git
cd canvas-flow
git remote add upstream https://github.com/FaridMahmudlu/canvas-flow.git
```

### 2. Set Up Environment
```bash
cp .env.example .env.local
npm install
```
Configure your `.env.local` following the instructions in [README.md](README.md).

### 3. Create a Feature Branch
Use descriptive branch names:
- `feature/canvas-announcements`
- `fix/calendar-timezone-offset`
- `refactor/sync-telemetry-chart`

```bash
git checkout -b feature/your-feature-name
```

### 4. Running the Project Locally
```bash
# Start Next.js development server
npm run dev

# Run Prisma Studio to inspect local database state
npx prisma studio
```

---

## 🧪 Testing Guidelines

Before opening a pull request, ensure all verification checks pass:

```bash
# 1. Verify TypeScript types
npx tsc --noEmit

# 2. Run unit and integration tests
npm test

# 3. Verify production build
npm run build
```

If you add new functionality (e.g. date parsing, rate-limiting, status transitions), please include corresponding unit tests in the `tests/` directory.

---

## 🎨 UI & Design Principles

CanvasFlow emphasizes a **sleek, modern, and exclusive design aesthetic**:
- **Design System**: Responsive glassmorphism, tailored gradients, and high-contrast typography.
- **Components**: Reusable, accessible, and performant. Avoid heavy third-party component libraries.
- **Branding**: Use the centralized `<Logo />` component from `@/components/brand/logo` for brand consistency.
- **Accessibility**: Include ARIA labels on icon buttons and ensure good color contrast ratios.

---

## 📝 Pull Request Checklist

When submitting a PR, verify:
- [ ] Branch is rebased against the latest `upstream/main`.
- [ ] TypeScript typechecking passes (`npx tsc --noEmit`).
- [ ] All tests pass (`npm test`).
- [ ] Production build succeeds (`npm run build`).
- [ ] No secrets, tokens, or personal identifiers are committed.
- [ ] A concise PR description explaining the problem and solution is provided.

---

## 💬 Questions or Feedback?

Feel free to open an issue or start a discussion on GitHub:
- Maintainer: **Farid Mahmudlu (SEK2L3)**
- Repository: [FaridMahmudlu/canvas-flow](https://github.com/FaridMahmudlu/canvas-flow)

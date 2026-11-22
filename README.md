# Senior Project

ระบบ web application สำหรับโปรเจกต์จบการศึกษา พร้อม spec และ documentation ส่งอาจารย์

A web application for senior projects: task tracking, accounts, quizzes, admin reporting, and the spec and documentation needed for submission.

## Features

- [x] **Authentication & User Accounts**: register, log in, log out; session in an httpOnly cookie (7-day TTL, `SameSite=Lax`); admin role via `ADMIN_EMAILS`
- [x] **Responsive UI (mobile-first)**: small-screen base styles, `min-width` breakpoints at 640px and 1024px
- [x] **Real-time updates (WebSocket)**: `/ws` broadcasts task created, updated and deleted events, with auto-reconnect
- [x] **Push Notifications**: Web Push (VAPID) adapter, subscription storage, admin broadcast
- [x] **LINE Notification**: LINE Messaging API adapter, admin broadcast to a LINE user ID
- [x] **File Upload & Storage**: PNG, JPEG, PDF, or TXT up to 5 MB, stored behind a `FileStorage` interface (local disk adapter)
- [x] **Search & Filters**: task search by text, status filter, pagination
- [x] **Payment Integration (Omise)**: charge a card token through the Omise adapter, store the payment record
- [x] **Admin Dashboard**: user and task statistics, quiz averages, paid total
- [x] **Dark mode / Theme switching**: system, light, or dark, saved per browser
- [x] **Offline support (PWA)**: web app manifest and service worker that caches the app shell
- [x] **Internationalization (i18n)**: Thai (default) and English, with a key-parity test
- [x] **Analytics & Reporting**: admin stats plus a CSV task report, with formula-injection protection
- [x] **SEO & Meta Tags**: per-route metadata, Open Graph, Twitter cards, `robots.txt`, `sitemap.xml`
- [x] **AI / ML Integration**: Anthropic Messages API adapter for text summarisation (`claude-haiku-5-5` by default)
- [x] **Quiz Engine & Scoring**: admin-authored quizzes, server-side scoring, answers hidden until submission
- [x] **Gamification & Badges**: five badges (first task, finisher, quiz taker, perfect score, uploader), awarded automatically; admins can view every user's badges and grant one from `/admin`
- [x] **CLAUDE.md + AI Workflow**: spec in `CLAUDE.md`, workflow in `docs/AI_WORKFLOW.md`

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript | Static pages; client components call the API |
| Backend | Node.js, Express 5, `ws` | REST API under `/api`, WebSocket on `/ws` |
| Database | PostgreSQL (`pg`) | Migrations in `server/db/migrations`, applied at startup |
| Integrations | Omise, Anthropic, LINE, Web Push (`web-push`) | Each behind an interface, with a fake for tests |
| Testing | Vitest (+ v8 coverage), Supertest, pg-mem, Playwright | Browser E2E in `e2e/`; optional real-Postgres runs via `TEST_DATABASE_URL` |
| Package manager | pnpm | `pnpm install --frozen-lockfile` |

## Getting started

```bash
pnpm install
cp .env.example .env.local        # then fill in your own keys and DATABASE_URL
pnpm db:migrate                   # create the schema (also runs when the API starts)
pnpm server                       # API on http://localhost:4000
pnpm dev                          # web app on http://localhost:3000
```

## Scripts

| Command | What it does |
|---------|--------------|
| `pnpm test` | Unit and API tests (Vitest) |
| `pnpm test:coverage` | Same tests with a coverage report for `lib/` and `server/services/` (fails below 70%) |
| `pnpm e2e` | Builds the web app, then runs the Playwright browser flows against a real API |
| `pnpm lint` | Type-check with `tsc --noEmit` |
| `pnpm build` | Production build of the web app |
| `pnpm server` | Start the Express API with WebSocket |
| `pnpm db:migrate` | Apply pending SQL migrations |

To also run the real-PostgreSQL integration test:

```bash
TEST_DATABASE_URL=postgres://user:password@localhost:5432/senior_test pnpm test
```

Use a disposable database. That test drops and recreates the `public` schema.

### End-to-end flows

`pnpm e2e` runs three Playwright flows in Chromium: student login → create a task, student login → take a quiz, and admin login → dashboard, grant a badge, download the CSV report. The Playwright config starts the API (port 4000) and the built web app (port 3000) itself.

- Without `TEST_DATABASE_URL` the API uses an in-memory database (pg-mem), so the command works on any machine.
- With `TEST_DATABASE_URL=postgres://...` the API runs on that PostgreSQL. Its `public` schema is reset on every run, so use a disposable database.
- If Chromium is at `/opt/pw-browsers/chromium`, that binary is used; otherwise run `pnpm exec playwright install chromium` once.

### Coverage

`pnpm test:coverage` measures `lib/**` and `server/services/**` (the business logic). The thresholds in `vitest.config.ts` are 70% for lines, functions, branches and statements.

## Keys you must add yourself

None of these are in the repository. Add them to `.env.local`:

| Variable | Needed for | Without it |
|----------|-----------|-----------|
| `DATABASE_URL` | Everything that stores data | API will not start |
| `ANTHROPIC_API_KEY` | AI summarisation | `/api/ai/summarize` returns 503 |
| `OMISE_SECRET_KEY` | Payments | `/api/payments` returns 503 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE notifications | LINE channel returns 503 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push | Push channel returns 503 |
| `ADMIN_EMAILS` | Admin accounts | No admin unless set |

## Project layout

```
app/            Next.js pages (/, /account, /tasks, /quiz, /admin), manifest, robots, sitemap
components/     Providers (theme and language), site header
lib/            Pure logic shared by UI and API: quiz scoring, badges, CSV, i18n, theme, SEO
server/         Express app, routes, repositories, providers, migrations, tests
public/         Service worker and icon
e2e/            Playwright browser flows, plus the API launcher and seeding they use
docs/           AI workflow
CLAUDE.md       Project specification
```

## Architecture

```mermaid
graph TD
  U[👤 User] --> FE[Frontend\nNext.js]
  FE --> API[API Layer\nNode.js + Express]
  FE <-->|WebSocket /ws| API
  API --> DB[(Database\nPostgreSQL)]
  API --> EXT[External Services\nOmise · Anthropic · LINE · Web Push]
```

## Known limits

- **Sessions are cookies, so the web app and API must share a site.** The session cookie is `SameSite=Lax`. Browsers send it on cross-origin `fetch` only when the site is the same, for example `app.example.com` with `api.example.com`, or local development on `localhost:3000` and `localhost:4000`. A Vercel frontend calling an API on a different site will not be logged in until the API is reverse-proxied under the same site (for example with Next.js rewrites). The `Authorization` header is no longer accepted. Set `NODE_ENV=production` on the API so the cookie is marked `Secure` (HTTPS only).
- **CSRF relies on `SameSite=Lax`.** There is no separate CSRF token. Login has no rate limiting yet.
- **Browser E2E covers three flows only** (login → task, login → quiz, admin → report and badge grant). Live WebSocket updates are verified by the server-side realtime test, not in the browser.
- **Lighthouse and axe-core audits are not run yet.** The CLAUDE.md targets (score ≥ 80, zero critical violations) are unverified.
- **Coverage** for `lib/` and `server/services/` is 97% of lines, measured by `pnpm test:coverage`. Route handlers and provider adapters are covered by API tests but are outside that number.
- **Push, LINE, Omise and Anthropic** are tested against fakes. No live call has been made to any external service.
- **File storage uses local disk.** Use object storage before deploying to a multi-instance host.
- **The PWA service worker** is checked for structure only. Offline behaviour is not tested in a browser.

# Senior Project

ระบบ web application สำหรับโปรเจกต์จบการศึกษา พร้อม spec และ documentation ส่งอาจารย์

A web application for senior projects: task tracking, accounts, quizzes, admin reporting, and the spec and documentation needed for submission.

## Features

- [x] **Authentication & User Accounts**: register, log in, log out, session tokens (7-day TTL), admin role via `ADMIN_EMAILS`
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
- [x] **Gamification & Badges**: five badges (first task, finisher, quiz taker, perfect score, uploader), awarded automatically
- [x] **CLAUDE.md + AI Workflow**: spec in `CLAUDE.md`, workflow in `docs/AI_WORKFLOW.md`

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript | Static pages; client components call the API |
| Backend | Node.js, Express 5, `ws` | REST API under `/api`, WebSocket on `/ws` |
| Database | PostgreSQL (`pg`) | Migrations in `server/db/migrations`, applied at startup |
| Integrations | Omise, Anthropic, LINE, Web Push (`web-push`) | Each behind an interface, with a fake for tests |
| Testing | Vitest, Supertest, pg-mem | Optional real-Postgres test via `TEST_DATABASE_URL` |
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
| `pnpm lint` | Type-check with `tsc --noEmit` |
| `pnpm build` | Production build of the web app |
| `pnpm server` | Start the Express API with WebSocket |
| `pnpm db:migrate` | Apply pending SQL migrations |

To also run the real-PostgreSQL integration test:

```bash
TEST_DATABASE_URL=postgres://user:password@localhost:5432/senior_test pnpm test
```

Use a disposable database. That test drops and recreates the `public` schema.

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

- Real-time and PWA behaviour are verified with unit and API tests. Browser-level E2E tests (Playwright) and Lighthouse/axe audits are not wired into `pnpm test` yet.
- Session tokens are stored in `localStorage` for simplicity. Moving them to `httpOnly` cookies is the next hardening step.
- File storage uses local disk. Use object storage before deploying to a multi-instance host.

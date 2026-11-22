# AI Workflow

This project was built with Claude Code working from the spec in `CLAUDE.md`.

## How the work is organised

1. **Spec first.** `CLAUDE.md` is the source of truth: features, schema, test plan, and sprint tasks.
2. **One feature at a time, in spec order.** Each feature ships code plus at least one passing test before the next one starts.
3. **Tests run through the real code path.** API tests drive the Express app with supertest against a PostgreSQL-compatible in-memory database (pg-mem). An optional integration test runs the same migrations on a real PostgreSQL server (`TEST_DATABASE_URL`).
4. **External services sit behind interfaces.** Payments, AI, LINE, Web Push and file storage each have an interface, a real adapter, and a recording fake. A missing API key returns HTTP 503. It never fakes success.
5. **Checks before every push:** `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm lint` (`tsc --noEmit`), `pnpm build`.

## Guardrails for AI-assisted changes

- Secrets only come from environment variables. `.env*.local` and `uploads/` are git-ignored, and `.env.example` holds placeholders only.
- Migrations live in `server/db/migrations/` as numbered SQL files. Add a new file rather than editing an applied one.
- Use `pnpm` only. Do not mix in `npm` or `yarn`.
- Mobile-first CSS: base styles for small screens, `min-width` queries for larger ones.

## Prompts and review

Each feature was specified in the commit message and checked against the test list. Review the diff, run the four checks above, and confirm that new behaviour has a test.

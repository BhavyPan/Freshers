# OBSIDIAN '26 Smart QR Entry

Production-ready Next.js entry and attendance system for the OBSIDIAN '26 Freshers event.

## Architecture

- Next.js 16, React 19, TypeScript and Tailwind CSS
- Prisma ORM connected to Supabase PostgreSQL
- Supabase pooled connection for Vercel runtime traffic
- Direct PostgreSQL connection for Prisma migrations
- Server-side organizer sessions with ADMIN and VOLUNTEER roles
- Durable PostgreSQL rate limiting and immutable check-in/audit history

## Local setup

1. Copy .env.example to .env.local and replace every placeholder.
2. Install dependencies with bun install or npm install.
3. Apply the database migration:

       npm run db:deploy

4. Create the first production-style administrator:

       npm run db:bootstrap

5. Start the application:

       npm run dev

For a disposable local demo only, run npm run db:seed:demo. The demo command refuses to run when NODE_ENV is production.

## Supabase and Vercel deployment

1. Create a fresh Supabase project.
2. Put the Supavisor transaction-pooler URL in DATABASE_URL and the direct or session-pooler URL in DIRECT_URL.
3. Run npm run validate:env, npm run db:deploy, and npm run db:bootstrap from a trusted environment.
4. Remove BOOTSTRAP_ADMIN_PASSWORD and optional volunteer bootstrap values after the accounts exist.
5. Configure DATABASE_URL, DIRECT_URL, APP_BASE_URL, SESSION_SECRET, and IP_HASH_SECRET in Vercel Production and Preview environments.
6. Deploy the repository. The Vercel build runs Prisma generation followed by next build.
7. Confirm /api/health returns HTTP 200 with database set to ready.

The repository intentionally does not migrate db/custom.db. It contains demo and QA records from the prototype.

## Verification

Run these before a release:

    npm run typecheck
    npm run lint
    npm test
    npm run build

Playwright smoke tests are available through npm run test:e2e. Set PLAYWRIGHT_BASE_URL to test an already-running deployment.

## QR security

Official venue QR enforcement defaults to off. An administrator can enable it from Event QR Code. Once enabled, missing or rotated tokens cannot self check-in; authenticated admin/volunteer desk actions continue to work. Copy the tokenized kiosk link from the same screen when preparing a public door tablet.

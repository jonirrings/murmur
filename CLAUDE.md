# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Murmur is a note-taking system on Cloudflare Workers with Markdown editing, real-time collaboration (Yjs), SSR with KV caching, and full-text search. Stack: Hono v4 + D1 + Drizzle ORM + React 19 + TanStack Router + better-auth.

## Commands

```bash
pnpm dev                  # Full dev server (Hono + Vite HMR) at localhost:8787
pnpm build                # Build client assets with Vite
pnpm build:worker         # Dry-run worker build
pnpm deploy               # Deploy to Cloudflare Workers
pnpm typecheck            # TypeScript check (tsc --noEmit)
pnpm lint                 # Lint with oxlint (vp lint src/)
pnpm lint:fix             # Lint and auto-fix
pnpm fmt                  # Format with oxfmt (vp fmt src/ --write)
pnpm fmt:check            # Check formatting
pnpm test                 # Run unit tests (vitest)
pnpm test:watch           # Tests in watch mode
pnpm db:generate          # Generate Drizzle migration from schema changes
pnpm db:migrate:local     # Apply migrations to local D1
pnpm db:migrate:remote    # Apply migrations to remote D1
pnpm db:studio            # Open Drizzle Studio
```

## Architecture

### Server (Hono on Cloudflare Workers)

- **Entry**: `src/index.ts` — exports Hono app + 3 Durable Objects (CollaborationRoomDO, RateLimiterDO, VisitorCounterDO) + scheduled handler
- **App**: `src/app.ts` — mounts all routes, injects DB middleware, better-auth handler at `/api/auth/**` with rate limiting on magic-link
- **Auth**: `src/auth/better-auth.config.ts` — factory `createAuth(db, env)`, plugins: magicLink, admin, passkey, twoFactor. Optional GitHub OAuth when `GITHUB_CLIENT_ID` is set. OAuth users auto-approved via `databaseHooks.user.create.after`
- **Auth middleware**: `src/auth/middleware.ts` — `requireAuth`, `requireAdmin`, `requireAuthor`, `requireApproved`. Uses `ROLE_HIERARCHY` from `src/shared/constants.ts`
- **DB**: `src/db/client.ts` — `createDb(d1)` factory, injects per-request. Schema in `src/db/schema.ts` (Drizzle + SQLite). Repos in `src/db/repositories/`
- **Services**: `src/services/` — business logic layer (note, comment, tag, setup, search, cache, render, email, view-tracker)
- **Routes**: `src/routes/api/` — Hono sub-routers mounted in `app.ts`. Pattern: `app.route("/api/me", meRoutes)`
- **SSR**: `src/routes/ssr.tsx` + `src/components/ssr/` — hono/jsx server-rendered public pages with KV cache. Routes: `/` (home), `/note/:slug`, `/tag/:tag`, `/category/:category`, `/hot` (trending notes), `/preview/:token`

### Client (React SPA)

- **Entry**: `src/client/main.tsx` — TanStack Router from auto-generated `routeTree.gen.ts`
- **Routes**: `src/client/routes/` — file-based routing. Routes auto-registered by `@tanstack/router-plugin/vite`. **Do not edit `routeTree.gen.ts`** — it regenerates on dev start
- **Pages**: `src/client/pages/` — page components referenced by route files
- **Auth client**: `src/client/lib/auth-client.ts` — `createAuthClient` with magicLink, passkey, twoFactor plugins. Exports `signIn`, `signOut`, `signUp`, `useSession`
- **State**: TanStack Query 5 (`src/client/queries/`) for server state, Zustand 5 (`src/client/stores/ui-store.ts`) for UI state (theme, locale, sidebar)
- **i18n**: `src/client/i18n/` — i18next with 5 namespaces (common, admin, auth, editor, comments). Fallback language: zh-CN. Locale persisted in Zustand + localStorage key `murmur-lng`
- **API client**: `src/client/lib/api.ts` — `fetchApi<T>(path, options)` with `ApiError` class

### Key Patterns

- **better-auth dynamic proxy**: Client methods like `authClient.passkey.deletePasskey()`, `authClient.twoFactor.verifyTotp()` work via better-auth's dynamic proxy — no manual API routes needed for these
- **Custom API routes**: For operations better-auth doesn't cover (linked accounts, admin 2FA reset), add Hono routes in `src/routes/api/` and mount in `app.ts`
- **Auth session**: `useSession()` returns `{ data, isPending }` where `data` has `{ user, session }`. User includes `twoFactorEnabled` from better-auth's cookie cache
- **2FA redirect**: `twoFactorClient({ onTwoFactorRedirect })` dispatches `CustomEvent("auth:two-factor-required")` — login page listens for this event
- **Env vars**: Secrets in `.dev.vars` (local) or Cloudflare Dashboard (prod). Never in `wrangler.toml`. All env vars typed in `AuthEnv` in `better-auth.config.ts`
- **Migrations**: Drizzle migrations in `migrations/`. After schema changes: `pnpm db:generate` then `pnpm db:migrate:local`

### Role System

Roles: `admin` (3) > `author` (2) > `commenter` (1). New users default to `commenter` with `approvalStatus: "pending"`. OAuth users auto-approved. Defined in `src/shared/constants.ts`.

### i18n Convention

When adding new UI text, add keys to **both** `src/client/i18n/locales/en/` and `src/client/i18n/locales/zh-CN/`. Namespaces correspond to JSON files (e.g., `auth.json` → `useTranslation("auth")`). Keys use dot notation: `t("login.githubButton")` resolves to `{ "login": { "githubButton": "..." } }`.

### Path Alias

`@/` maps to `./src/` in both TypeScript and Vite configs.

## Linting Rules

- Linter: oxlint via `vp lint`. Formatter: oxfmt via `vp fmt`
- TypeScript strict mode enabled
- Pre-commit hook: `vp check --fix` (runs lint + format)
- CI: typecheck → lint → format check → unit tests → client build → worker dry-run

# Murmur

A note-taking system built on Cloudflare Workers, featuring Markdown editing with CodeMirror, real-time collaboration via Yjs, SSR with KV caching, and full-text search.

## Tech Stack

| Layer         | Technology                                                           |
| ------------- | -------------------------------------------------------------------- |
| Runtime       | Cloudflare Workers                                                   |
| Framework     | Hono v4                                                              |
| Database      | D1 (SQLite)                                                          |
| Cache         | KV                                                                   |
| Storage       | R2                                                                   |
| Realtime      | Durable Objects (Collaboration, Rate Limiting, Visitor Counter)      |
| ORM           | Drizzle ORM                                                          |
| Auth          | better-auth (magic link + passkey + 2FA + admin plugin)              |
| Frontend      | React 19 + Vite 8 + Tailwind CSS v4                                  |
| Routing       | TanStack Router (file-based)                                         |
| Editor        | CodeMirror 6                                                         |
| Collaboration | Yjs + y-websocket + y-webrtc                                         |
| Icons         | lucide-react                                                         |
| State         | TanStack Query 5 + Zustand 5 (theme, locale, sidebar, cookieConsent) |
| Testing       | Vitest                                                               |

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- Wrangler CLI (installed via dependencies)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy the example file and fill in values:

```bash
cp .env.example .dev.vars
```

Then edit `.dev.vars` — for local development the defaults work out of the box. The key variables:

| Variable               | Required | Dev Default             | Description                                            |
| ---------------------- | -------- | ----------------------- | ------------------------------------------------------ |
| `BETTER_AUTH_SECRET`   | Yes      | `dev-secret-...`        | Auth encryption key (`openssl rand -hex 32` for prod)  |
| `BETTER_AUTH_URL`      | Yes      | `http://localhost:8787` | Auth callback URL                                      |
| `RP_ID`                | Yes      | `localhost`             | WebAuthn Relying Party ID (your domain in prod)        |
| `ORIGIN`               | Yes      | `http://localhost:8787` | Full site URL (Passkey origin)                         |
| `TURNSTILE_SITE_KEY`   | No       | _(empty)_               | Cloudflare Turnstile frontend key                      |
| `TURNSTILE_SECRET_KEY` | No       | _(empty)_               | Cloudflare Turnstile backend key                       |
| `RESEND_API_KEY`       | No       | _(empty)_               | Resend API key for magic link emails                   |
| `RESEND_FROM_EMAIL`    | No       | _(empty)_               | Verified sender email (e.g. `noreply@your-domain.com`) |
| `GITHUB_CLIENT_ID`     | No       | _(empty)_               | GitHub OAuth App Client ID                             |
| `GITHUB_CLIENT_SECRET` | No       | _(empty)_               | GitHub OAuth App Client Secret                         |

### 3. Configure Resend (optional, for Magic Link emails)

Magic Link login requires email delivery. Without Resend configured, magic links are printed to the server console (dev mode).

1. Sign up at [resend.com](https://resend.com) and create an API key
2. Verify your sending domain (or use `onboarding@resend.dev` for testing)
3. Set the variables:

```bash
# In .dev.vars (local) or via wrangler secret put (production)
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=noreply@your-domain.com
```

### 4. Apply database migrations

```bash
pnpm db:migrate:local
```

### 5. Start development server

```bash
pnpm dev
```

The server runs at http://localhost:8787

## Project Structure

```
src/
├── app.ts                    # Hono app — route mounting, middleware, ASSETS SPA serving
├── index.ts                  # Worker entry — exports app + Durable Objects
├── auth/                     # Authentication
│   ├── better-auth.config.ts # better-auth setup (magic link, passkey, 2FA, admin)
│   ├── middleware.ts         # requireAuth / requireAdmin / requireAuthor
│   └── turnstile.ts         # Cloudflare Turnstile verification
├── db/                       # Database
│   ├── client.ts             # Drizzle D1 client factory
│   └── schema.ts             # All table definitions (incl. banned, banReason, etc.)
├── do/                       # Durable Objects
│   ├── collaboration-room.do.ts  # Yjs real-time collaboration + WebRTC signaling
│   ├── rate-limiter.do.ts        # IP-based rate limiting
│   └── visitor-counter.do.ts     # WebSocket real-time visitor counting
├── services/                 # Business logic
│   ├── note.service.ts
│   ├── comment.service.ts
│   ├── tag.service.ts
│   ├── setup.service.ts
│   ├── search.service.ts
│   ├── cache.service.ts     # KV SSR cache + sitemap cache
│   ├── render.service.ts    # Markdown → HTML (unified + shiki)
│   └── view-tracker.service.ts # View count with bot filtering & CF Analytics calibration
├── components/
│   └── ssr/                 # hono/jsx SSR components
│       ├── layout.tsx        # HtmlDocument shell + nav + footer + cookie banner
│       ├── note-card.tsx     # Note card for list pages
│       ├── note-detail.tsx   # Note detail + list/tag/preview/error pages
│       ├── comment-item.tsx  # Comment item
│       ├── pagination.tsx    # Pagination navigation
│       ├── privacy-page.tsx  # Privacy policy SSR page
│       ├── about-page.tsx    # About SSR page
│       └── visitor-counter-script.tsx # WebSocket visitor counter script
├── routes/
│   ├── ssr.tsx              # Server-side rendered public pages (hono/jsx)
│   ├── api/                 # REST API endpoints
│   │   ├── setup.ts         # /api/setup — initial admin setup
│   │   ├── admin.ts         # /api/admin/* — user management
│   │   ├── notes.ts         # /api/notes — CRUD + publish
│   │   ├── comments.ts      # /api/comments — create + review
│   │   ├── tags.ts          # /api/tags
│   │   ├── attachments.ts   # /api/attachments — R2 upload
│   │   ├── search.ts        # /api/search — full-text search
│   │   ├── collab.ts        # /api/collab — collaboration rooms
│   │   ├── settings.ts      # /api/admin/settings
│   │   └── me.ts            # /api/me — current user profile
│   └── seo.ts               # /sitemap.xml, /robots.txt
├── client/                  # React SPA (TanStack Router)
│   ├── index.html
│   ├── main.tsx             # createRouter + RouterProvider + i18n init
│   ├── app.tsx              # LocaleSync component
│   ├── routeTree.gen.ts     # Auto-generated route tree
│   ├── routes/              # TanStack Router file-based routes
│   │   ├── __root.tsx       # Root layout (QueryClientProvider + ThemeProvider + LocaleSync + CookieConsent)
│   │   ├── setup.tsx
│   │   ├── login.tsx
│   │   ├── privacy.tsx      # Privacy policy (SPA)
│   │   ├── about.tsx        # About page (SPA)
│   │   ├── admin.tsx        # Admin layout (sidebar + auth guard + locale dropdown)
│   │   ├── admin/dashboard.tsx
│   │   ├── admin/notes.tsx
│   │   ├── admin/notes/new.tsx
│   │   ├── admin/notes/$id.edit.tsx
│   │   ├── admin/users.tsx
│   │   ├── admin/comments.tsx
│   │   ├── admin/settings.tsx
│   │   └── admin/security.tsx
│   ├── i18n/                # i18next configuration
│   │   ├── index.ts         # i18next.init()
│   │   └── locales/         # Per-language namespace JSON files
│   │       ├── zh-CN/       # common, admin, auth, editor, comments
│   │       ├── en/          # common, admin, auth, editor, comments
│   │       └── ja/          # common, admin, auth, editor, comments
│   ├── pages/               # Page components (referenced by routes/)
│   ├── hooks/               # Custom hooks (useAutoSave, useCollabEditor)
│   ├── components/
│   │   ├── editor/          # MarkdownEditor, Toolbar, ImageUploader, CollabPresence
│   │   ├── cookie-consent.tsx # Cookie consent banner (SPA)
│   │   ├── theme-toggle.tsx
│   │   └── theme-provider.tsx
│   ├── stores/
│   │   └── ui-store.ts      # Zustand — theme, sidebar, locale, cookieConsent
│   ├── queries/             # TanStack Query hooks
│   │   ├── admin.ts
│   │   ├── comments.ts
│   │   ├── search.ts
│   │   ├── collab.ts
│   │   ├── me.ts
│   │   └── setup.ts
│   └── lib/
│       ├── auth-client.ts   # better-auth client
│       ├── notes.ts         # Note API hooks
│       ├── markdown.ts      # Client-side markdown rendering
│       ├── zod-i18n.ts      # Zod error map with i18n
│       ├── api-error.ts     # Localized API error mapping
│       ├── relative-time.ts # i18n-aware relative time formatting
│       └── utils.ts         # cn() helper
└── shared/
    ├── constants.ts         # Role hierarchy, categories, pagination
    ├── i18n/                # Server-side i18n
    │   ├── server.ts        # detectLocale() + t()
    │   └── locales/         # zh-CN.json, en.json, ja.json (SSR-only)
    └── schemas/             # Zod validation schemas
```

## Scripts

| Command                  | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `pnpm dev`               | Start local development server                 |
| `pnpm build`             | Build client assets with Vite                  |
| `pnpm build:worker`      | Dry-run worker build                           |
| `pnpm deploy`            | Deploy to Cloudflare Workers                   |
| `pnpm db:generate`       | Generate Drizzle migration from schema changes |
| `pnpm db:migrate:local`  | Apply migrations to local D1                   |
| `pnpm db:migrate:remote` | Apply migrations to remote D1                  |
| `pnpm db:studio`         | Open Drizzle Studio (DB browser)               |
| `pnpm typecheck`         | TypeScript type checking                       |
| `pnpm lint`              | Lint with oxlint (`vp lint`)                   |
| `pnpm lint:fix`          | Lint and auto-fix with oxlint                  |
| `pnpm fmt`               | Format code with oxfmt (`vp fmt`)              |
| `pnpm fmt:check`         | Check formatting without writing               |
| `pnpm test`              | Run unit tests                                 |
| `pnpm test:watch`        | Run tests in watch mode                        |

## API Overview

### Auth

| Method   | Path           | Description                                               |
| -------- | -------------- | --------------------------------------------------------- |
| GET/POST | `/api/auth/**` | better-auth endpoints (magic link, passkey, 2FA, session) |

### Setup

| Method | Path                | Auth | Description                |
| ------ | ------------------- | ---- | -------------------------- |
| POST   | `/api/setup/init`   | None | Create first admin account |
| GET    | `/api/setup/status` | None | Check if setup is needed   |

### Notes

| Method | Path                       | Auth   | Description        |
| ------ | -------------------------- | ------ | ------------------ |
| GET    | `/api/notes`               | Author | List own notes     |
| POST   | `/api/notes`               | Author | Create note        |
| GET    | `/api/notes/:id`           | Author | Get note detail    |
| PUT    | `/api/notes/:id`           | Author | Update note        |
| DELETE | `/api/notes/:id`           | Author | Delete note        |
| POST   | `/api/notes/:id/publish`   | Author | Publish note       |
| POST   | `/api/notes/:id/unpublish` | Author | Unpublish note     |
| GET    | `/api/notes/hot`           | None   | Hot/trending notes |

### Comments

| Method | Path                          | Auth   | Description            |
| ------ | ----------------------------- | ------ | ---------------------- |
| GET    | `/api/notes/:noteId/comments` | None   | List approved comments |
| POST   | `/api/notes/:noteId/comments` | User   | Create comment         |
| PUT    | `/api/comments/:id/approve`   | Author | Approve comment        |
| PUT    | `/api/comments/:id/hide`      | Admin  | Hide comment           |

### Search

| Method | Path                                         | Auth | Description      |
| ------ | -------------------------------------------- | ---- | ---------------- |
| GET    | `/api/search?q=&category=&tag=&page=&limit=` | None | Full-text search |

### Collaboration

| Method | Path                                     | Auth   | Description                  |
| ------ | ---------------------------------------- | ------ | ---------------------------- |
| POST   | `/api/collab/rooms/:noteId`              | Author | Join collaboration room      |
| GET    | `/api/collab/rooms/:noteId/info`         | Author | Room info                    |
| GET    | `/api/collab/rooms/:noteId/sessions`     | Author | List active sessions         |
| DELETE | `/api/collab/rooms/:noteId/sessions/:id` | Author | Deactivate session           |
| DELETE | `/api/collab/rooms/:noteId`              | Author | Leave room                   |
| POST   | `/api/collab/cleanup`                    | Admin  | Clean up expired sessions    |
| GET    | `/api/collab/ws`                         | Author | WebSocket + WebRTC signaling |

### Visitor Counter

| Method | Path                                  | Auth | Description               |
| ------ | ------------------------------------- | ---- | ------------------------- |
| WS     | `/api/visitor-counter/ws?pageKey=`    | None | WebSocket for live counts |
| GET    | `/api/visitor-counter/counts`         | None | All page visitor counts   |
| GET    | `/api/visitor-counter/count?pageKey=` | None | Single page visitor count |

### View Stats (Admin)

| Method | Path                         | Auth  | Description                         |
| ------ | ---------------------------- | ----- | ----------------------------------- |
| POST   | `/api/admin/view-stats/sync` | Admin | Sync view counts from CF Analytics  |
| GET    | `/api/admin/view-stats`      | Admin | Get view counts for published notes |

### Admin

| Method | Path                            | Auth  | Description         |
| ------ | ------------------------------- | ----- | ------------------- |
| GET    | `/api/admin/users`              | Admin | List all users      |
| PUT    | `/api/admin/users/:id/role`     | Admin | Change user role    |
| PUT    | `/api/admin/users/:id/approval` | Admin | Approve/reject user |

### SEO

| Method | Path           | Description                      |
| ------ | -------------- | -------------------------------- |
| GET    | `/sitemap.xml` | XML sitemap (KV cached, 1hr TTL) |
| GET    | `/robots.txt`  | Robots file                      |

## User Roles

| Role      | Level | Capabilities                                              |
| --------- | ----- | --------------------------------------------------------- |
| admin     | 3     | User management, site settings, all author privileges     |
| author    | 2     | Create/edit/publish notes, moderate comments, collaborate |
| commenter | 1     | Post comments on published notes                          |

New users default to `commenter` with `pending` approval status. Admins approve users via the admin panel.

## Key Features

### Markdown Editor

CodeMirror 6 with markdown language support, formatting toolbar, image paste/drag-drop upload, and live preview with shiki syntax highlighting.

### Real-time Collaboration

Yjs-powered collaborative editing via Durable Objects with WebSocket and WebRTC support. Multiple users can edit the same note simultaneously with cursor presence indicators. When 2+ users are in a room, the system automatically upgrades to WebRTC P2P for lower latency, falling back to WebSocket if P2P fails.

### SSR + KV Cache

Public pages are server-side rendered using hono/jsx components with KV caching (5min for home/tag/category/hot, 10min for note detail). Cache keys include locale suffix for i18n support. Cache is automatically invalidated on note publish/update.

### Hot Notes

Time-windowed trending notes based on view counts from the `note_views` table. Supports 1 hour, 1 day, 1 week, and 1 month periods. Public API at `GET /api/notes/hot?period=1d&limit=20` and SSR page at `/hot`. View events are deduplicated by IP per day. A cron job cleans up records older than 90 days.

### Full-text Search

D1 LIKE-based search across note titles and content, with category and tag filters.

### Real-time Visitor Counter

WebSocket-based visitor counting via VisitorCounterDO (Durable Object with Hibernation API). Per-page tracking with "N 人正在阅读" display on note detail pages. Admin dashboard shows site-wide online visitor count.

### View Tracking

Per-note view count with bot filtering (Cloudflare Bot Management score + user-agent patterns). Incremented non-blocking via `c.executionCtx.waitUntil`. Admin endpoint for Cloudflare Analytics calibration sync.

### Dark Mode

System-aware theme toggle (light/dark/system) with persistent preference.

### Passkey & 2FA

WebAuthn passkey authentication via `@better-auth/passkey` for passwordless login. TOTP two-factor authentication via `better-auth/plugins/two-factor` with backup codes. Security management page at `/admin/security`.

### Internationalization (i18n)

Trilingual support (Chinese/English/Japanese) powered by i18next. Client-side uses react-i18next with 5 namespaces (common, admin, auth, editor, comments). Server-side SSR uses `detectLocale()` from `Accept-Language` header with locale-suffixed KV cache keys. Language preference persisted in Zustand store. Admin header includes a locale dropdown selector.

### Cookie Consent & Privacy

GDPR/compliance-ready cookie consent banner on both SSR and SPA pages. SSR uses an inline HTML/CSS/JS banner that reads/writes `murmur-cookie-consent` cookie. SPA uses a React `CookieConsent` component backed by Zustand store synced with the same cookie. Privacy policy at `/privacy` and About page at `/about` are available as both SSR and client-side routes.

## Deployment

### Prerequisites

- A [Cloudflare](https://dash.cloudflare.com/) account
- `wrangler` CLI authenticated (`wrangler login`)

### 1. Create Cloudflare resources

```bash
# D1 database
wrangler d1 create murmur-db
# → Copy the returned database_id into wrangler.toml [[d1_databases]]

# KV namespace
wrangler kv namespace create KV
# → Copy the returned id into wrangler.toml [[kv_namespaces]]

# R2 bucket (skip if already exists)
wrangler r2 bucket create murmur-assets
```

### 2. Set production secrets

Use `wrangler secret put` for sensitive values — these are encrypted and never appear in code:

```bash
wrangler secret put BETTER_AUTH_SECRET   # openssl rand -hex 32
wrangler secret put BETTER_AUTH_URL      # https://your-domain.com
wrangler secret put RP_ID                # your-domain.com
wrangler secret put ORIGIN               # https://your-domain.com
wrangler secret put TURNSTILE_SECRET_KEY # from Cloudflare Dashboard → Turnstile
wrangler secret put RESEND_API_KEY       # from resend.com dashboard
wrangler secret put RESEND_FROM_EMAIL    # verified sender address (e.g. noreply@your-domain.com)
```

Non-secret vars (like `TURNSTILE_SITE_KEY`) can be set via the Cloudflare Dashboard under **Workers → murmur → Settings → Variables** or added to `wrangler.toml` `[vars]`.

### 3. Apply remote migrations

```bash
pnpm db:migrate:remote
```

### 4. Deploy

```bash
pnpm deploy
```

Or push to `main` — the CI pipeline (`.github/workflows/ci.yml`) automatically runs typecheck, lint, test, build, migrations, and deploy.

### 5. Configure custom domain (optional)

In Cloudflare Dashboard: **Workers & Pages → murmur → Settings → Domains & Routes → Add → Custom Domain**

Or via CLI:

```bash
wrangler domains add your-domain.com
```

Make sure `RP_ID` and `ORIGIN` secrets match your custom domain.

### 6. Post-deploy setup

Visit `https://your-domain.com/setup` to create the first admin account. This route is only available when no admin user exists.

### Environment Variables Reference

| Variable               | Type    | Set Via               | Description                            |
| ---------------------- | ------- | --------------------- | -------------------------------------- |
| `BETTER_AUTH_SECRET`   | secret  | `wrangler secret put` | Auth encryption key (min 32 chars)     |
| `BETTER_AUTH_URL`      | secret  | `wrangler secret put` | Auth callback base URL                 |
| `RP_ID`                | secret  | `wrangler secret put` | WebAuthn Relying Party ID (domain)     |
| `ORIGIN`               | secret  | `wrangler secret put` | Full site origin URL                   |
| `TURNSTILE_SECRET_KEY` | secret  | `wrangler secret put` | Turnstile server-side key              |
| `TURNSTILE_SITE_KEY`   | var     | Dashboard or `[vars]` | Turnstile client-side key (non-secret) |
| `RESEND_API_KEY`       | secret  | `wrangler secret put` | Resend API key for email delivery      |
| `RESEND_FROM_EMAIL`    | secret  | `wrangler secret put` | Verified sender email address          |
| `GITHUB_CLIENT_ID`     | secret  | `wrangler secret put` | GitHub OAuth App Client ID             |
| `GITHUB_CLIENT_SECRET` | secret  | `wrangler secret put` | GitHub OAuth App Client Secret         |
| `DB`                   | binding | `wrangler.toml`       | D1 database binding                    |
| `KV`                   | binding | `wrangler.toml`       | KV namespace binding                   |
| `R2`                   | binding | `wrangler.toml`       | R2 bucket binding                      |
| `ASSETS`               | binding | `wrangler.toml`       | Workers Assets binding                 |
| `COLLAB_DO`            | binding | `wrangler.toml`       | CollaborationRoom Durable Object       |
| `RATE_LIMITER_DO`      | binding | `wrangler.toml`       | RateLimiter Durable Object             |
| `VISITOR_COUNTER_DO`   | binding | `wrangler.toml`       | VisitorCounter Durable Object          |

### Cron Triggers

| Schedule       | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| `*/30 * * * *` | Cleanup: deactivate expired collab sessions, delete old inactive sessions |

## License

Private

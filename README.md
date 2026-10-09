# ecom-nextjs-demo

A small e-commerce prototype on Next.js 16 (App Router) over the [DummyJSON](https://dummyjson.com)
API. You log in, land on a dashboard that is rendered on the server, page through products and
add them to a cart. JWT access tokens are refreshed on the Next.js server without the user
noticing, and the browser never talks to DummyJSON.

**Live:** https://ecom-nextjs-demo.vercel.app

**Test account:** `emilys` / `emilyspass`. Any user from DummyJSON's user list works.

The access token lives for one minute on purpose, so the refresh can be seen: leave the dashboard
idle for a minute, then reload or click "Load more", and the session cookies change.

## Stack

- Next.js 16.4 (App Router, Cache Components, `proxy.ts`), React 19.3, TypeScript 5
- Tailwind CSS 4, `sonner` for toasts, `zustand` for client state, `zod` for input validation
- Vitest 5, ESLint 9 with `eslint-plugin-boundaries`, Prettier 3
- pnpm 10, Node 22

## Running locally

```bash
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:3000. No environment variables are needed: the project has no secrets, and
non-secret config (the API base URL, the token TTL) lives in `shared/config`.

The `Makefile` is the contract that CI and the Claude Code harness use:

| Target                   | What it runs                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `make check`             | `prettier --check`, `next typegen` + `tsc --noEmit`, `eslint .` |
| `make test`              | `vitest run`                                                    |
| `make build`             | `next build`                                                    |
| `make fmt`               | `prettier --write .`                                            |
| `make check-file FILE=…` | ESLint on one file (run by the harness after every edit)        |

CI runs `check`, `test` and `build` on every push and pull request.

## Architecture

The full specification is in [`docs/spec.md`](docs/spec.md). The decisions behind it are recorded
in [`docs/adr/`](docs/adr).

```
Browser (Client Components)
  │  fetch('/api/...') through one BFF client: never DummyJSON
  ▼
proxy.ts                 route access + proactive token refresh, page routes only
app/**/page.tsx (RSC)    server rendering: calls the data access layer directly
app/api/**/route.ts      BFF endpoints: validate → call → map the error
  ▼
features / entities      server functions that receive an authenticated client, DTO mapping
  ▼
shared/api               upstream client, session store + adapters, single-flight refresh,
                         error catalog, BFF response helpers, BFF client
  ▼
DummyJSON
```

- **One BFF on Route Handlers, no Server Actions:**
  - the browser calls only `/api/*` on its own origin;
  - Server Components read the data access layer directly, without an HTTP hop to their own app;
  - adding an endpoint means one entity function plus one thin handler.

  See [ADR 00001](docs/adr/00001-single-bff-on-route-handlers-without-server-actions.md).

- **Tokens only in httpOnly cookies, refreshed on two paths through one mechanism:**
  - `proxy.ts` refreshes before a page renders, because Server Components cannot set cookies;
  - the authenticated client retries once after a `401` from any upstream call;
  - refreshes are deduplicated by an in-flight map keyed by refresh token, so concurrent requests
    of one session share a single refresh and different sessions never do.

  See [ADR 00002](docs/adr/00002-cookie-session-with-two-path-single-flight-token-refresh.md).

- **Feature-Sliced Design at the repo root:**
  - layers `widgets` → `features` → `entities` → `shared`, with Next's `app/` acting as the app
    and pages layers;
  - imports point only downward and go through a slice's `index.ts` or `index.server.ts`;
    `eslint-plugin-boundaries` enforces this on every edit.

  See [ADR 00003](docs/adr/00003-fsd-layers-at-the-repo-root-with-next-app-as-app-and-pages-layers.md).

- **A streamed dashboard under Cache Components:**
  - a prerendered static shell, then one authenticated `<Suspense>` boundary with nested
    boundaries for carts and products;
  - `/auth/me` and `/auth/products` run in parallel;
  - a failing section shows an inline alert while the others still render.

  See [ADR 00004](docs/adr/00004-cache-components-with-a-streamed-dashboard.md).

- **Added carts live in `sessionStorage`:**
  - one store per mount, keyed by user id, hydrated after mount;
  - cleared on every way out (logout, forced logout, opening `/login`).

  See [ADR 00005](docs/adr/00005-session-scoped-cart-store-in-sessionstorage.md).

- **Users see only messages from the error catalog** in `shared/api`. Raw upstream and exception
  text goes to the server log only. Route handler conventions are written down in
  [`.claude/rules/api.md`](.claude/rules/api.md).

### DummyJSON behaviour, verified by hand

| Case                                  | Response                                      | What the app does                       |
| ------------------------------------- | --------------------------------------------- | --------------------------------------- |
| Expired, missing or malformed token   | `401`                                         | Refreshes, then retries once            |
| JWT-shaped token with a bad signature | `500` (`invalid token` / `invalid signature`) | Plain upstream error, no refresh        |
| Invalid refresh token                 | `403 Invalid refresh token`                   | Ends the session, goes to `/login`      |
| Wrong credentials                     | `400 Invalid credentials`                     | `401 INVALID_CREDENTIALS`, shown inline |
| A refresh token used a second time    | `200`: refresh tokens are not rotated         | Every refresh still stores the new pair |
| `POST /auth/carts/add`                | `201`, but nothing is stored                  | The cart is kept in the tab             |

Because DummyJSON accepts duplicate refreshes, a broken single-refresh implementation would still
look correct against the live API. The guarantee is proven by unit tests instead. See
[spec §2.3](docs/spec.md#23-observed-behaviour-verified-manually-2026-10-08).

## Tests

There are 190 Vitest tests in 29 files, in the node environment. They cover logic and flows, not
markup:

- JWT helpers and cookie attributes.
- The four session store adapters.
- Single-flight refresh, proven with deferred upstream responses and mutation checks:
  - N concurrent callers → one upstream call;
  - different refresh tokens → independent calls.
- The authenticated client:
  - retry after refresh;
  - a newer token already in the store;
  - a second `401`;
  - a rejected refresh vs a transient refresh failure.
- `proxy.ts`: the matcher, the access matrix and proactive refresh.
- Every route handler:
  - validation;
  - auth;
  - tokens never in the body;
  - the user id from the session, never from the body;
  - upstream text never leaked.
- The BFF client, the pagination store and the cart store.

## Known limitations

- **No refresh deduplication across server instances.** On serverless hosting, each instance
  dedupes only its own refreshes. This is harmless against DummyJSON, which does not rotate refresh
  tokens; a rotating backend would need a shared lock.
- **A refresh inside a Server Component is not persisted.** It lives for the rest of that render,
  and the next page request is refreshed by the proxy.
- **Added carts are per tab.** They live in `sessionStorage`, so a new tab starts without them, and
  DummyJSON gives every added cart the same id.
- **No rate limiting**, a declared non-goal. `POST /api/auth/login` would need it first.
- **`/login?session=expired` logs the user out.** Anyone can link a user to that URL. Server
  Components cannot clear cookies, so this is how a dead session leaves a render without a redirect
  loop; the impact is limited to logging in again.

## How it was built

The work was split into ten tasks in [`docs/tasks/`](docs/tasks/README.md). Each task was one
branch and one squash-merged pull request, implemented with Claude Code against the spec, the ADRs
and the boundary lint. Every pull request description records how its task was verified.

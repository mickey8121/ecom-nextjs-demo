# ecom-nextjs-demo — Specification

Status: accepted · Last updated: 2026-10-08

## 1. Overview

A Next.js 16 (App Router) web application over the [DummyJSON](https://dummyjson.com) API: a user
logs in, lands on a protected dashboard rendered on the server, pages through products and adds
them to a cart. JWT access tokens are refreshed automatically and invisibly on the Next.js server.

The project is a prototype for a technical assessment. **The architecture is what gets evaluated,
not the visuals.** Every decision below optimises for correctness of the auth flow, clear layering,
and the ability to add many more upstream endpoints without touching the core.

### Goals

- Login, protected dashboard, logout, with access control on every route.
- Dashboard data rendered on the server; product pagination and add-to-cart on demand.
- Transparent token refresh: a request that failed on an expired token is retried without the
  user noticing; refresh happens once for concurrent requests; sessions are isolated.
- The browser never talks to DummyJSON.
- A layered codebase where a new endpoint is one entity function plus one thin route handler.

### Non-goals

- Visual design beyond minimal Tailwind styling.
- Real cart persistence (DummyJSON does not persist writes, see §2.3).
- Refresh deduplication across server instances (would need a shared lock, see §4.6).
- Registration, product detail pages, search, i18n, end-to-end tests.
- Rate limiting. A per-instance in-memory limiter is unreliable on serverless; a real one needs a
  shared store (a new secret) or the host's firewall rules. `POST /api/auth/login` is the endpoint
  that would need it first.

## 2. Upstream API (DummyJSON)

Base URL `https://dummyjson.com`. Protected endpoints live under `/auth/` and require
`Authorization: Bearer <accessToken>`.

### 2.1 Endpoints used

| Endpoint                      | Method | Purpose                                                       |
| ----------------------------- | ------ | ------------------------------------------------------------- |
| `/auth/login`                 | POST   | `{ username, password, expiresInMins }` → user + token pair   |
| `/auth/refresh`               | POST   | `{ refreshToken, expiresInMins }` → new token pair            |
| `/auth/me`                    | GET    | Current user                                                  |
| `/auth/products?limit=&skip=` | GET    | Product page: `{ products, total, skip, limit }`              |
| `/auth/carts/user/{userId}`   | GET    | Carts of a user: `{ carts, total, skip, limit }`              |
| `/auth/carts/add`             | POST   | `{ userId, products: [{ id, quantity }] }` → the created cart |

Test credentials: `emilys` / `emilyspass` (any user from DummyJSON's user list works).

### 2.2 Token lifetimes

- Access token: requested with `expiresInMins: 1` so that refresh is observable in a demo.
- Refresh token: ~30 days (from its `exp` claim).
- Both are JWTs whose payload includes `id`, `username`, `iat`, `exp`. The app decodes them only
  to read `exp` and `id`; it never verifies signatures (it does not have the secret — DummyJSON
  verifies every request).

### 2.3 Observed behaviour (verified manually, 2026-10-08)

| Situation                                  | Response                                                   | Consequence for the app                             |
| ------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------- |
| Expired access token                       | `401 {"message":"Token Expired!"}`                         | Triggers refresh                                    |
| Missing / malformed token                  | `401`                                                      | Triggers refresh (or logout if there is no session) |
| JWT-shaped token with a bad signature      | `500 {"message":"invalid token"}` or `"invalid signature"` | **Not** a refresh trigger — plain upstream error    |
| Invalid refresh token                      | `403 {"message":"Invalid refresh token"}`                  | Session is over: clear cookies, go to `/login`      |
| Wrong credentials                          | `400 {"message":"Invalid credentials"}`                    | Mapped to `401 INVALID_CREDENTIALS`                 |
| Refresh with an already-used refresh token | `200`, works again                                         | No rotation — see below                             |
| `POST /auth/carts/add`                     | `201` with a new cart id                                   | Nothing is stored server-side                       |

**Refresh tokens are not rotated.** Refresh returns a new refresh token but the old one stays
valid. Consequences:

- Duplicate concurrent refreshes do not break a session against DummyJSON, so the
  single-refresh requirement **cannot be verified against the API**. It is proven by unit tests
  (§11).
- The code is written as if rotation existed: every refresh persists the new pair and never
  reuses the old refresh token.
- A stolen refresh token stays usable for ~30 days and there is no server-side logout. The only
  mitigation available to the app is keeping tokens in httpOnly cookies.

**Carts are not persisted.** A cart created via `/auth/carts/add` never shows up in
`/auth/carts/user/{id}`. Added carts are therefore kept client-side for the browser tab (§8).

## 3. Functional requirements

### 3.1 Routes and access

| Route        | No session        | Session               |
| ------------ | ----------------- | --------------------- |
| `/`          | redirect `/login` | redirect `/dashboard` |
| `/login`     | login page        | redirect `/dashboard` |
| `/dashboard` | redirect `/login` | dashboard             |

"Session" means a refresh-token cookie is present (§4.2). The access token may be expired; the
request boundary refreshes it (§4.4).

`/login?session=expired` is the one exception: the proxy clears the session cookies and shows the
login page instead of redirecting to `/dashboard` (§4.5).

### 3.2 Login (`/login`)

- Form with username and password, both required.
- A hint shows the DummyJSON test credentials.
- Success → full-page navigation to `/dashboard`.
- Invalid credentials → inline error message; the form keeps the username.
- Any other failure → inline error message from the error catalog (§3.4).
- `?session=expired` → a notice that the session has expired.
- On mount, the page clears every client-side session artefact (§8): all logout paths end here.

### 3.3 Dashboard (`/dashboard`)

On open, the following are rendered on the server (§9):

| Data             | Upstream                        |
| ---------------- | ------------------------------- |
| Current user     | `GET /auth/me`                  |
| The user's carts | `GET /auth/carts/user/{userId}` |
| First 5 products | `GET /auth/products?limit=5`    |

**Load more.** A "Load more" button fetches the next 5 products and appends them to the list. The
button shows a pending state, cannot be double-submitted, and disappears once all products are
loaded. On failure a toast shows the error and the list is unchanged.

**Add to cart.** Every product has an "Add to cart" button. A click sends the product with
quantity 1; the result (success with the created cart's id, or the error) is shown as a toast.
On success the created cart is appended to the carts block, marked as added in this session.

**Logout.** Clears the session cookies on the server, clears client-side session data, and
performs a full-page navigation to `/login`.

### 3.4 Errors

- **Users see only messages from the app's error catalog.** Raw upstream text (DummyJSON's
  `message`, status lines, bodies) and exception messages never reach the UI; they go to server
  logs only. The catalog is one client-safe module in `shared/api`, keyed by error code (§6), used
  by the server to build responses and by the client for errors it synthesises itself (§7).
  Reasons: upstream text leaks implementation details (CWE-209), ties UI wording to another
  system's phrasing, and is inconsistent in tone.
- Errors from client-initiated calls (load more, add to cart, login, logout) are shown as toasts
  or inline messages, using the catalog message carried in the BFF error body.
- Expected upstream errors during server rendering are rendered inline in the affected section
  (an alert with the catalog message for the error's code); the other sections still render.
- Unexpected errors fall back to an error boundary with a generic catalog message and a retry
  action; boundaries never render `error.message`. Next.js also hides server error messages in
  production, which is another reason expected errors are rendered as values rather than thrown.
- A session that cannot be refreshed ends on `/login` (§4.5), never as an error screen.

## 4. Authentication and session

### 4.1 Principles

- Tokens are obtained, stored and used only on the Next.js server.
- Tokens never reach client JavaScript, browser storage, or any response body.
- The request boundary (`proxy.ts`) is an optimistic layer: it redirects and refreshes, but it is
  not the authorisation gate. Every data access reads and validates the session itself (§5.3).

### 4.2 Cookies

| Cookie         | Value         | Lifetime                           |
| -------------- | ------------- | ---------------------------------- |
| `ecom_access`  | access token  | `maxAge` = until the token's `exp` |
| `ecom_refresh` | refresh token | `maxAge` = until the token's `exp` |

Attributes: `httpOnly`, `sameSite=lax`, `path=/`, `secure` in production. The access cookie
disappears from the browser when the token expires, so "access cookie missing" and "access token
expired" are handled the same way.

### 4.3 Session store

All token reads and writes go through one interface, so the refresh logic is identical — and
testable — in every execution context:

```ts
interface SessionStore {
  get(): SessionTokens | null;
  set(tokens: SessionTokens): void;
  clear(): void;
}
```

| Adapter          | Reads from      | `set` / `clear` write to                                                 |
| ---------------- | --------------- | ------------------------------------------------------------------------ |
| Proxy            | request cookies | response `Set-Cookie` **and** the forwarded request `Cookie` header      |
| Route handler    | `cookies()`     | `cookies()` → response `Set-Cookie`                                      |
| Server Component | `cookies()`     | an in-memory override for the rest of the render (cookies cannot be set) |
| Memory           | a plain object  | the same object (tests)                                                  |

One store instance per request (Server Components share it through React `cache`).

### 4.4 Refresh

Two paths, one mechanism (§4.6):

1. **Proactive, in `proxy.ts`, for page requests.** If the session exists and the access token is
   missing or expires within 10 seconds, the proxy refreshes before rendering. The new pair is set
   on the response and forwarded in the request's `Cookie` header, so the render that follows sees
   the fresh token. This path exists because HTTP cannot set cookies once a streamed response has
   started, and Server Components cannot set cookies at all.
2. **Reactive, in the authenticated fetch, for every upstream call.** On `401` from DummyJSON:
   - if the store already holds a newer access token than the one that failed (another request
     refreshed meanwhile), retry with it — "newer" means different: the store only ever receives
     fresh pairs;
   - otherwise refresh (single-flight), store the new pair, and retry the original request once;
   - a second `401` ends the session (§4.5).

   Route handlers persist the refreshed pair through cookies. In a Server Component the refreshed
   pair lives only for the rest of that render; the next page request is refreshed by the proxy.
   This fallback relies on DummyJSON not rotating refresh tokens — against a rotating backend it
   would have to redirect through the proxy instead (documented limitation).

The proxy does **not** run on `/api/*`: route handlers can persist cookies themselves, so the
reactive path covers them. With a 1-minute access token, a "Load more" after a minute of idling
exercises the reactive path naturally.

Only `401` triggers a refresh. Other statuses, including DummyJSON's `500 invalid token`, are
ordinary upstream errors.

### 4.5 Ending a session

| Cause                                                           | Result                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Refresh rejected (`401`/`403`)                                  | Proxy: clear cookies, redirect `/login`. BFF: clear cookies, `401 UNAUTHENTICATED`. RSC: `redirect('/login?session=expired')`. |
| `401` again after a successful refresh                          | Same as above.                                                                                                                 |
| Refresh failed for a transient reason (network, timeout, `5xx`) | **Keep the session.** Surface an upstream error; do not log out.                                                               |
| User clicks Logout                                              | `POST /api/auth/logout` clears cookies; client clears session data and navigates to `/login`.                                  |

DummyJSON has no logout endpoint, so logout only drops the cookies (§2.3).

A Server Component cannot clear cookies. If it simply redirected to `/login`, the proxy would see
the still-present refresh cookie and send the user back to `/dashboard` — a loop whenever the
access token is rejected before its `exp`. Redirecting to `/login?session=expired` makes the proxy
clear the cookies instead. The side effect — anyone can link a user to that URL and log them out —
is accepted: a forced logout has no impact beyond logging in again.

### 4.6 Single refresh and session isolation

- Refreshes are deduplicated with an in-flight map keyed by **refresh token**: concurrent callers
  holding the same refresh token await one shared promise; the entry is removed when it settles.
- The key is what isolates sessions: two sessions — including two logins of the same user — hold
  different refresh tokens and never share a refresh. Two tabs of one browser share cookies and
  are one session, so sharing their refresh is correct.
- This map is the **only** module-level state that touches a session, and it holds nothing once a
  refresh settles. There are no module-level "current token" or "current user" variables.
- Limitation: on serverless hosting, concurrent requests may land on different instances, and
  each instance dedupes only its own refreshes. Against DummyJSON this is harmless (no rotation);
  a rotating backend would need a shared lock or a reuse grace window. Out of scope (§1).

## 5. Architecture

### 5.1 Layers

```
Browser (Client Components)
  │  fetch('/api/...') via the BFF client — never DummyJSON
  ▼
proxy.ts                 route access + proactive refresh, page routes only
app/**/page.tsx (RSC)    server rendering — calls the data access layer directly
app/api/**/route.ts      BFF endpoints — thin: parse → call → map errors
  ▼
features / entities      server APIs (index.server.ts): domain calls and DTO mapping
  ▼
shared/api               upstream client, session store + adapters, refresh, authenticated fetch,
                         BFF error responses (server) and the BFF client (browser)
  ▼
DummyJSON
```

Server Components fetch from the data access layer directly, not through the app's own route
handlers (an extra HTTP round trip for nothing). Route handlers exist for the browser.

### 5.2 FSD layout

FSD layers live at the repo root. Next's `app/` stands in for FSD's `app` and `pages` layers and
holds composition only.

| Layer       | Contents                                                                              |
| ----------- | ------------------------------------------------------------------------------------- |
| `app/`      | routes, layouts, page composition, `api/**/route.ts`, `error.tsx`                     |
| `widgets/`  | `dashboard-header`, `cart-overview`, `product-feed`                                   |
| `features/` | `auth` (login form, logout, server login/logout), `product-pagination`, `add-to-cart` |
| `entities/` | `user`, `product`, `cart` (types, server API, mappers, UI, cart store)                |
| `shared/`   | `api`, `config`, `ui`, `lib`                                                          |

Rules (enforced by `eslint-plugin-boundaries`, added with the project skeleton):

- Imports go strictly downward: `app` → `widgets` → `features` → `entities` → `shared`.
- Slices of the same layer do not import each other. If entities ever need to reference each
  other, they use FSD's `@x` notation; by default the cart entity has its own line-item type.
- A slice is imported only through its public API: `index.ts` (client-safe) or
  `index.server.ts` (server-only, starts with `import 'server-only'`).
- No files outside known layers: no root `components/`, `hooks/`, `pages/` (a root `pages/` would
  turn on the Pages Router), no `src/`. Test support (stubs, test doubles) lives in a root `test/`
  folder.
- Providers live by their dependencies: business-free ones in `shared` or directly in a layout;
  domain ones in their slice; the tree is assembled in `app/`.

### 5.3 Data access layer

- Entity and feature server functions receive an **authenticated client** (built from a session
  store); they never read cookies themselves. This is dependency injection: the same function
  runs in a route handler, a Server Component or a test.
- `getCurrentUser` is wrapped in React `cache`, so all sections of one render share one `/auth/me`
  call. `cache` keys by argument identity, so a render passes one authenticated client instance to
  every section.
- The user id is always derived on the server — from the session's access token claims, or the
  refresh token's when the access cookie has expired — never taken from a request body. A session
  whose tokens carry no id is unauthenticated. The same token goes upstream, so forged claims are
  rejected there.
- Upstream responses are mapped to DTOs owned by the entities (`UserDto`, `ProductDto`,
  `CartDto`). The browser never sees raw DummyJSON payloads; this also guarantees tokens in the
  login response are dropped.
- Upstream requests: `cache: 'no-store'`, a 10-second timeout, JSON in and out. Session-derived
  data is never wrapped in `use cache`, `use cache: private` or `use cache: remote`.

### 5.4 Configuration

Non-secret constants live in `shared/config`: API base URL, access token TTL (1 minute), refresh
leeway (10 seconds), products page size (5), upstream timeout (10 seconds), cookie names, the
`sessionStorage` key prefix (`ecom:`).
Environment variables are reserved for secrets; the project has none, so there is no `.env`.

## 6. BFF API contract

Structured to match the sections of `.claude/rules/api.md`, which `/api-rules` will record.

**Placement.** `app/api/<resource>/route.ts` (nested for actions: `app/api/auth/login/route.ts`).
Handlers are thin: validate input → call a feature/entity server function → return JSON or map
the error. No business logic in `app/`.

**Config exports.** None. Handlers run on the default Node.js runtime; `dynamic`, `revalidate`
and `fetchCache` are not used (they error under Cache Components, §9).

**Auth gate.** Protected handlers build a route-handler session store from `cookies()` and an
authenticated client from it. No session → `401 UNAUTHENTICATED`. Refresh and retry happen inside
the client (§4.4); the handler does not see them.

**Ownership.** Resources are scoped to the session's user id (§5.3). Clients never send a user id.

**Input validation.** `zod` schemas for every body and query. Invalid input →
`400 VALIDATION_ERROR` with the catalog message; zod's own messages are never returned (they are
developer-facing). Bodies must be JSON.

**Error shape.** Every non-2xx response carries a code and a message **from the error catalog**.
The message is never copied from the upstream response or from an exception:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

| Code                  | Status | When                                                 | Catalog message                                           | Client behaviour     |
| --------------------- | ------ | ---------------------------------------------------- | --------------------------------------------------------- | -------------------- |
| `VALIDATION_ERROR`    | 400    | Body or query failed validation                      | Please check the entered data.                            | show message         |
| `INVALID_CREDENTIALS` | 401    | Login rejected by DummyJSON                          | Invalid username or password.                             | show message inline  |
| `UNAUTHENTICATED`     | 401    | No session, refresh rejected, or `401` after refresh | Your session has expired. Please log in again.            | navigate to `/login` |
| `NOT_FOUND`           | 404    | Upstream `404` (e.g. unknown product)                | The requested item was not found.                         | show message         |
| `UPSTREAM_ERROR`      | 502    | Upstream non-401 error, network failure or timeout   | The service is temporarily unavailable. Please try again. | show message         |
| `INTERNAL_ERROR`      | 500    | Unexpected exception                                 | Something went wrong. Please try again.                   | show message         |
| `NETWORK_ERROR`       | —      | Client-only: the BFF could not be reached            | Network error. Check your connection and try again.       | show message         |

The wording is illustrative; the catalog module is the source of truth. A message may be refined
with details the app itself owns — the name of a field in its own schema — never with upstream
text.

Only `UNAUTHENTICATED` redirects. `INVALID_CREDENTIALS` is also a `401` but must render inline on
the login form — the code, not the status, drives client behaviour.

**Endpoints.**

| Method | Path               | Auth    | Input                                                      | Success                                           |
| ------ | ------------------ | ------- | ---------------------------------------------------------- | ------------------------------------------------- |
| POST   | `/api/auth/login`  | none    | `{ username: string, password: string }`                   | `200 { user: UserDto }` + session cookies         |
| POST   | `/api/auth/logout` | none    | —                                                          | `204` + cleared cookies (idempotent)              |
| GET    | `/api/products`    | session | `?skip` int ≥ 0 (default 0), `?limit` int 1–30 (default 5) | `200 { items: ProductDto[], total, skip, limit }` |
| POST   | `/api/carts`       | session | `{ productId: int > 0, quantity: int 1–10 (default 1) }`   | `201 { cart: CartDto }`                           |

**Success envelopes.** A single resource is wrapped by its name (`{ user }`, `{ cart }`); a list
is `{ items, total, skip, limit }`; an action with nothing to return is `204` with no body.

**Logging.** Upstream failures are logged on the server with method, upstream path, status,
duration and the upstream message — the server log is the only place raw upstream text goes.
Tokens, passwords and cookie values are never logged.

**Legacy.** None — greenfield.

## 7. Client-side data flow

- One BFF client in `shared/api` (`index.ts`): `fetch` to `/api/*`, parses the error shape into a
  typed `AppError { code, status, message }`, and on `UNAUTHENTICATED` clears session data and
  performs a full-page navigation to `/login`. The message is taken from the catalog by code; the
  body's `message` is ignored, so refinements of a message stay on the server.
- Anything that is not the BFF error shape — a network failure, an HTML error page from the host,
  a body that is not JSON — becomes a synthesised `AppError` (`NETWORK_ERROR` or `UPSTREAM_ERROR`)
  with its catalog message. The message of a caught `TypeError` or `SyntaxError` is never shown.
- Features call the BFF client and report failures with `sonner` toasts.
- Auth transitions (login, logout, forced logout) use **full-page navigation**, not the client
  router. With Cache Components, Next keeps recently visited routes mounted in hidden `<Activity>`
  and caches per-session App Shells on the client; a full navigation guarantees nothing from the
  previous session survives in memory.

## 8. Client-side cart store

DummyJSON does not persist added carts (§2.3), so carts created in this tab are kept on the client
for display.

- `zustand` with `persist` to **`sessionStorage`** (not `localStorage`: data from behind the login
  must not outlive the browser session or sit on disk indefinitely).
- The store is created **per mount** through a provider (`createStore` inside the component),
  never at module level — a module-level store would be shared by every request during SSR and
  leak one user's data to another.
- Storage key includes the user id: `ecom:carts:<userId>`.
- The provider lives in the cart entity and is mounted inside the dashboard's authenticated
  Suspense boundary, once the user is known (§9) — not in a layout, which must not await the
  session.
- Hydration is client-only (`skipHydration` + `rehydrate()` after mount); locally added carts
  render after hydration.
- Cleared on every way out: the logout button, `UNAUTHENTICATED` in the BFF client, and on mount
  of `/login` (where all paths end, including the proxy's server-side redirect, which cannot touch
  `sessionStorage`).
- Display-only: never sent to the server, never treated as a source of truth.
- If `sessionStorage` is unavailable (blocked by the browser), the store works in memory for the
  page's lifetime; nothing breaks.
- Each tab has its own `sessionStorage`; a new tab starts without locally added carts.

## 9. Rendering

- `cacheComponents: true` and `partialPrefetching: true` (the create-next-app defaults for 16.4).
  Data is dynamic unless explicitly cached; nothing in this app is cached.
- With Cache Components, reading `cookies()` outside a `<Suspense>` boundary is a **build error**,
  and layouts must not await the session at the top level. CI runs `make build` to catch it.
- Dashboard structure:
  - a static shell (page frame, section headings) prerendered at build time;
  - one authenticated boundary that starts the products request, awaits the current user, then
    mounts the cart store provider and the header;
  - inside it, two nested boundaries: carts (needs the user id) and products (already in flight).
    `/auth/me` and `/auth/products` run in parallel; only carts waits for the user.
- This is still server-side rendering: the data arrives in the same HTTP response, streamed into
  the shell. Loading fallbacks are stream placeholders, not client fetches.
- Images use `next/image` with `remotePatterns` for `https://cdn.dummyjson.com/**` (product and cart
  thumbnails) and `https://dummyjson.com/icon/**` (user avatars), so the browser loads them from the
  app's `/_next/image`, not from DummyJSON.
- Development-time instant-navigation validation runs at its default (`warning`) level.

## 10. Security checklist

- Tokens only in httpOnly cookies; never in responses, client state or logs.
- Users see catalog messages only; raw upstream and exception text stays in server logs.
- The browser talks only to the app's own origin (pages, `/api/*`, `/_next/image`).
- Every protected handler and server render validates the session itself; the proxy is optimistic.
- The user id comes from the session, never from the client.
- All inputs are validated with `zod`; upstream calls have timeouts.
- No module-level per-user state except the refresh in-flight map (§4.6).
- Client-side data from behind the login lives in `sessionStorage`, keyed by user, cleared on exit.
- `SameSite=Lax` cookies plus JSON-only bodies protect the BFF's state-changing endpoints from
  cross-site form posts.
- Known gap: no rate limiting (§1).

## 11. Testing

Vitest, node environment. Unit tests cover logic and flows, not markup.

| Area                | What is proven                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT helpers         | `exp`/`id` decoding, expiry-with-leeway checks, malformed tokens                                                                                                                                                                                                                                                                                                                                                        |
| Session adapters    | cookie names and attributes, `maxAge` from `exp`, clear, request-header forwarding in the proxy adapter                                                                                                                                                                                                                                                                                                                 |
| Single-flight       | N concurrent refreshes with one refresh token → **one** upstream call, all callers get the result; different refresh tokens → independent calls; a failed refresh rejects all waiters and clears the entry                                                                                                                                                                                                              |
| Authenticated fetch | `401` → refresh → one retry with the new token; newer token already in the store → retry without refresh; second `401` → `UNAUTHENTICATED` + store cleared; `500`/other → no refresh; transient refresh failure keeps the session                                                                                                                                                                                       |
| Proxy               | the access matrix (§3.1); `/login?session=expired` clears cookies; proactive refresh sets response cookies and forwards the request header; rejected refresh → cleared cookies + redirect; transient refresh failure → request passes through; matcher excludes `/api` and static assets (`next/experimental/testing/server`)                                                                                           |
| Route handlers      | login sets cookies and **never returns tokens**; invalid credentials → `INVALID_CREDENTIALS`; logout clears cookies; products validates `skip`/`limit`; carts takes the user id from the session, not the body; error shape; **upstream text never leaks** — an upstream `{"message":"invalid token"}` yields the catalog message and the response body does not contain `invalid token`; zod messages are not returned |
| BFF client          | error parsing; `UNAUTHENTICATED` → navigation to `/login`; network failure → `NETWORK_ERROR`; non-JSON or HTML error body → `UPSTREAM_ERROR` with the catalog message, never the raw text                                                                                                                                                                                                                               |
| Cart store          | key per user id, append, clear, no module-level instance                                                                                                                                                                                                                                                                                                                                                                |

The single-refresh guarantee is provable only here: DummyJSON accepts duplicate refreshes (§2.3),
so a broken implementation would still look correct against the live API.

`import 'server-only'` is aliased to an empty module (`test/empty-module.ts`) in `vitest.config.mts`.

## 12. Tooling and delivery

- pnpm 10 with `minimumReleaseAge: 1440`; Node 22.
- `make check` (Prettier, `next typegen` + `tsc`, ESLint incl. boundaries), `make test`,
  `make build`; CI runs all three on every push and pull request.
- Work is split into tasks in `docs/tasks/`; one task = one branch = one squash-merged PR.
- Deployed to Vercel. No environment variables are required.

## 13. Decisions

Each decision is recorded as an ADR in `docs/adr/`; the ADRs carry the full reasoning.

| Decision | ADR                                                                          |
| -------- | ---------------------------------------------------------------------------- |
| D1       | `00001-single-bff-on-route-handlers-without-server-actions.md`               |
| D2       | `00002-cookie-session-with-two-path-single-flight-token-refresh.md`          |
| D3       | `00003-fsd-layers-at-the-repo-root-with-next-app-as-app-and-pages-layers.md` |
| D4       | `00004-cache-components-with-a-streamed-dashboard.md`                        |
| D5       | `00005-session-scoped-cart-store-in-sessionstorage.md`                       |

**D1. A single BFF on Route Handlers; no Server Actions.**
Context: the browser must not call DummyJSON; client-initiated calls need a server endpoint.
Options: (a) Route Handlers for everything; (b) Route Handlers for reads, Server Actions for
mutations; (c) Server Actions for everything. Decision: (a). Server Actions are queued and meant
for mutations, which rules out (c) for "Load more". In this app their real advantages — redirect
and cookie update in one round trip, revalidation in the same response — apply only to login and
logout, because added carts are not persisted and nothing needs revalidating. (b) would buy that
for two endpoints at the cost of two transports, two error contracts and two places that persist
refreshed cookies. Consequences: one error contract and one client; login costs one extra round
trip; the `web-next` harness (`/api-rules`, `/route-handler`) governs the whole BFF.

**D2. Session in httpOnly cookies; refresh proactive in the proxy and reactive in the data access
layer; single-flight keyed by refresh token.**
Context: tokens must survive navigations, refresh must be invisible, happen once for concurrent
requests, and be isolated per session; Server Components cannot set cookies and streamed
responses cannot set them late. Options considered for storage: client storage (exposed to XSS),
DummyJSON's own cookies (wrong domain), app cookies (chosen). For refresh: reactive only (fails
for page renders, which cannot persist new cookies), proactive only (misses invalid-but-unexpired
tokens and requests outside the proxy), both (chosen). For deduplication: a global lock (couples
sessions), per-request promise (misses concurrent requests of one session), a map keyed by
refresh token (chosen). Consequences: one `SessionStore` interface with four adapters; the only
module-level session state is the in-flight map; no cross-instance dedupe.

**D3. FSD at the repo root, Next's `app/` as the app and pages layers, boundaries enforced by
lint.**
Context: FSD wants `app` and `pages` layers, Next reserves both names. Options: `src/` with
renamed `_app`/`_pages` layers (the FSD guide's suggestion); root layout without those two layers
(chosen, consistent with the author's other projects). Consequences: `app/` is composition only;
`eslint-plugin-boundaries` enforces direction, slice isolation and public APIs.

**D4. Cache Components on, dashboard as a static shell with streamed sections.**
Context: create-next-app 16.4 enables `cacheComponents` and `partialPrefetching`; both become
the only mode in the next major. Options: keep them; turn them off for classic dynamic rendering.
Decision: keep. Data is uncached by default (no accidental cross-user caching), the dashboard's
three independent data needs map to parallel streamed sections. Consequences: session reads must
sit inside `<Suspense>` (a build error otherwise, caught by `make build` in CI); layouts never
await the session; auth transitions use full-page navigation (§7).

**D5. Added carts in a per-mount `zustand` store persisted to `sessionStorage`, keyed by user.**
Context: DummyJSON does not persist carts; the result of "Add to cart" must still be visible.
Options: memory only (lost on reload), `localStorage` (outlives the session, sits on disk),
`sessionStorage` (chosen). Consequences: per-mount store to avoid SSR leaks, client-only
hydration, cleanup on every exit path converging on `/login`.

## 14. Open questions

None.

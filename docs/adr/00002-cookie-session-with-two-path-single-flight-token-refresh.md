# 00002. Cookie session with two-path single-flight token refresh

Date: 2026-10-08

Status: accepted

## Context

The assignment requires: when the access token is expired or invalid, refresh it automatically;
retry a failed request without involving or informing the user; if refresh is impossible, log
out and redirect to `/login`; refresh only once for parallel requests; and isolate refresh
between sessions — one user's refresh must not affect other users or other sessions of the same
user.

Constraints that shaped the design:

- The browser never talks to DummyJSON, so tokens are used only on the Next.js server.
- Server Components cannot set cookies, and HTTP cannot set cookies once a streamed response has
  started (Next.js 16 docs).
- DummyJSON, checked by hand: an expired or malformed token gives `401`; a JWT-shaped token with
  a bad signature gives `500 invalid token`; an invalid refresh token gives `403`. Refresh returns
  a new pair but **does not rotate**: the old refresh token keeps working (~30 days).
- The access token TTL is set to 1 minute so refresh is observable in a demo.

## Options

Token storage:

- **Client storage.** Exposes tokens to any script on the page.
- **DummyJSON's own cookies.** Set on DummyJSON's domain; useless to our origin.
- **httpOnly cookies on the app's origin.**

Where refresh happens:

- **Reactive only** (on `401` in the authenticated fetch). Fails for page renders: a Server
  Component that refreshes cannot persist the new pair.
- **Proactive only** (in `proxy.ts`, by the token's `exp`). Misses tokens rejected before their
  `exp`, and requests the proxy does not cover.
- **Both.**

How refreshes are deduplicated:

- **A global lock.** Couples unrelated sessions.
- **A request-scoped promise** (React `cache`). Misses concurrent requests of the same session.
- **An in-flight map keyed by refresh token.**

## Decision

Tokens live in httpOnly, `SameSite=Lax` cookies on the app's origin. A session exists while the
refresh cookie exists.

Refresh runs on two paths through one mechanism:

1. **Proactive, in `proxy.ts`, for page requests:** if the access token is missing or expires
   within 10 seconds, refresh before rendering; set the new pair on the response and forward it
   in the request's `Cookie` header so the render sees it.
2. **Reactive, in the authenticated fetch, for every upstream call:** on `401`, retry with a newer
   token if the store already has one; otherwise refresh, store the pair, and retry once. Only
   `401` triggers refresh — DummyJSON's `500 invalid token` is an ordinary upstream error.

The proxy does not run on `/api/*`: route handlers persist cookies themselves, and with a
1-minute TTL their reactive path is exercised naturally.

All reads and writes of tokens go through one `SessionStore` interface with four adapters: proxy
(request cookies in, response cookies plus forwarded request header out), route handler
(`cookies()`), Server Component (`cookies()` in, an in-memory override out) and memory (tests).

Refreshes are deduplicated by an in-flight map keyed by refresh token: concurrent callers of one
session share one promise, and the entry is removed when it settles. The key is what isolates
sessions — two logins of the same user hold different refresh tokens; two tabs of one browser
share cookies and are rightly one session.

A rejected refresh (`401`/`403`) ends the session; a transient failure (network, timeout, `5xx`)
keeps it and surfaces an error. A Server Component that hits a dead session redirects to
`/login?session=expired`, where the proxy clears the cookies.

## Consequences

- Refresh logic is identical in every execution context and unit-testable with the memory
  adapter.
- The single-refresh guarantee is provable only by unit tests: DummyJSON accepts duplicate
  refreshes, so a broken implementation would still look correct against the live API.
- The in-flight map is the only module-level state that touches a session, and it is empty
  between refreshes.
- Accepted limitations:
  - no deduplication across serverless instances — harmless without rotation, would need a
    shared lock otherwise;
  - a refresh inside a Server Component is not persisted; that fallback relies on DummyJSON not
    rotating and would have to redirect through the proxy against a rotating backend;
  - anyone can link a user to `/login?session=expired` and log them out;
  - a stolen refresh token stays valid for ~30 days; httpOnly cookies are the only mitigation the
    app controls.
- Do not "simplify":
  - removing proxy refresh — page renders would lose persisted tokens;
  - removing reactive refresh — tokens rejected before `exp` and all BFF calls would fail;
  - keying the map by user id or making it global — that couples sessions;
  - refreshing on `500` or logging out on transient failures;
  - redirecting Server Components to bare `/login` — it loops while the refresh cookie exists.

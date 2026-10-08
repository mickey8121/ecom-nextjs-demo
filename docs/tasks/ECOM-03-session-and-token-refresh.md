---
id: ECOM-03
title: Session and token refresh
status: todo
depends_on: [ECOM-02]
branch: feat/ecom-03-session-and-token-refresh
---

## Context

The core of the assignment: automatic, invisible token refresh that runs once for concurrent
requests and is isolated between sessions. Everything else uses this layer. See `docs/spec.md`
§2.2, §2.3 and §4, ADR 00002.

## Scope

In `shared/api`, server-only:

- **JWT helpers:** decode the payload without verifying it, read `exp` and `id`, check expiry
  with the 10-second leeway; malformed tokens count as expired.
- **Cookies:** names from `shared/config`; `httpOnly`, `sameSite=lax`, `path=/`, `secure` in
  production; `maxAge` derived from each token's `exp`.
- **`SessionStore`** (`get`, `set`, `clear`) with four adapters:
  - route handler — reads and writes through `cookies()`;
  - Server Component — reads `cookies()`, keeps writes in an in-memory override for the rest of
    the render; one instance per request through React `cache`;
  - proxy — reads request cookies; writes go to the response's `Set-Cookie` and to the forwarded
    request `Cookie` header (wired into `proxy.ts` by ECOM-04);
  - memory — for tests.
- **Refresh:** `POST /auth/refresh` with the configured TTL; deduplicated by an in-flight map keyed
  by refresh token, entry removed when the promise settles. `401`/`403` → rejected; network,
  timeout or `5xx` → transient.
- **Authenticated client** built from a store: no session → `UNAUTHENTICATED`; on upstream `401`,
  retry with the store's token if it is newer than the one that failed, otherwise refresh, store
  the pair and retry once; a second `401` or a rejected refresh clears the store and fails with
  `UNAUTHENTICATED`; a transient refresh failure keeps the session and fails with
  `UPSTREAM_ERROR`. Only `401` triggers a refresh.
- **Session user id** read from the access token's claims, falling back to the refresh token's.
- A reusable test double for `next/headers` cookies, so later tasks can test route handlers.
- Public API through `index.server.ts`.

## Out of scope

- `proxy.ts` itself (ECOM-04).
- Login and logout (ECOM-06).

## Acceptance

- The in-flight map is the only module-level state that touches a session, and it is empty when
  no refresh is running.
- Upstream text never reaches a user-facing message (inherits ECOM-02).

## Tests

These are the only proof of the single-refresh requirement — DummyJSON accepts duplicate
refreshes, so a broken implementation would look correct against the live API.

- JWT helpers: `exp` and `id` decoding, leeway, malformed tokens.
- Cookie attributes and `maxAge` from `exp`; clear removes both cookies.
- Adapters: route handler writes cookies; Server Component override is visible to later reads in
  the same render and never writes cookies; proxy adapter sets response cookies and the forwarded
  `Cookie` header.
- Single-flight: N concurrent refreshes with one refresh token → one upstream call, every caller
  gets the same pair; two different refresh tokens → two independent calls; a failed refresh
  rejects every waiter and clears the entry; after settling, a new refresh calls upstream again.
- Authenticated client: `401` → refresh → one retry with the new token; newer token already in
  the store → retry without refreshing; second `401` → `UNAUTHENTICATED` and store cleared;
  rejected refresh → `UNAUTHENTICATED` and store cleared; transient refresh failure →
  `UPSTREAM_ERROR` and session kept; upstream `500` → no refresh; no session → no upstream call.

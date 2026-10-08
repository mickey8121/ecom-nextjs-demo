---
id: ECOM-06
title: Login and logout
status: done
depends_on: [ECOM-03, ECOM-05]
branch: feat/ecom-06-login-and-logout
---

## Context

The first route handlers in the BFF: they become the reference implementation of
`.claude/rules/api.md`. See `docs/spec.md` §3.2, §3.3 (logout), §4.5, §6 and §7, ADRs 00001 and 00002.

## Scope

- **`features/auth`, server:**
  - `login`: `POST /auth/login` with the configured TTL; upstream `400` →
    `INVALID_CREDENTIALS`; success writes the token pair to the session store and returns a
    `UserDto`;
  - `logout`: clears the session store.
- **Route handlers** per `.claude/rules/api.md` (`maxDuration = 30`, `zod` body, catalog errors):
  - `POST /api/auth/login` → `200 { user }` plus session cookies;
  - `POST /api/auth/logout` → `204` plus cleared cookies, idempotent.
- **Login form** (client):
  - username and password, both required;
  - pending state;
  - errors shown inline by code; the username is kept after an error;
  - a hint with the DummyJSON test credentials;
  - a notice for `?session=expired`;
  - success → full-page navigation to `/dashboard`.
- **`/login` page:** composes the form behind the `<Suspense>` that `useSearchParams` needs, and
  clears session data (ECOM-02's helper) on mount.
- **Logout button** (client): calls the logout endpoint, clears session data, then makes a
  full-page navigation to `/login`; a failure is shown as a toast.
- If the first handlers make the log format concrete, close the "log format" gap in
  `.claude/rules/api.md` through `/api-rules`.

## Out of scope

- The dashboard (ECOM-07), which hosts the logout button.

## Acceptance

- Logging in with `emilys` / `emilyspass` sets both cookies and lands on `/dashboard` (an empty
  page is fine until ECOM-07).
- The login response body contains no token, in any field.

## Tests

- Login handler:
  - success sets both cookies with the right attributes and returns `{ user }` without
    `accessToken` or `refreshToken`;
  - upstream `400` → `401 INVALID_CREDENTIALS` with the catalog message;
  - missing fields and non-JSON body → `400 VALIDATION_ERROR` without zod text;
  - upstream `5xx` → `502 UPSTREAM_ERROR`, upstream text absent from the body.
- Logout handler: `204`, both cookies cleared, idempotent without a session.

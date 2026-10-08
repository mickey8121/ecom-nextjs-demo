---
id: ECOM-04
title: Request boundary (proxy.ts)
status: todo
depends_on: [ECOM-03]
branch: feat/ecom-04-request-boundary-proxy
---

## Context

Page routes need access control before rendering, and page renders need a fresh access token
before streaming starts, because Server Components cannot set cookies. See `docs/spec.md` §3.1,
§4.4 and §4.5, ADR 00002.

## Scope

- `proxy.ts` at the repo root, matcher `/`, `/login`, `/dashboard/:path*` — `/api/*`, `_next/*`
  and static assets are not matched.
- Access matrix (spec §3.1), where a session means the refresh cookie is present:
  - `/` → `/dashboard` with a session, `/login` without;
  - `/login` → `/dashboard` with a session;
  - `/login?session=expired` → clear the session cookies and show the login page;
  - `/dashboard` → `/login` without a session.
- Proactive refresh on `/dashboard` when the access token is missing or expires within the
  leeway, using ECOM-03's proxy adapter and single-flight refresh:
  - success → new cookies on the response and in the forwarded request `Cookie` header;
  - rejected → clear cookies, redirect to `/login`;
  - transient failure → let the request through unchanged.
- `app/page.tsx`: replace the placeholder with a server redirect to `/dashboard` as a fallback;
  the proxy normally answers `/` first.

## Out of scope

- The login and dashboard pages (ECOM-06, ECOM-07).

## Acceptance

- The proxy is an optimistic layer only: nothing downstream relies on it for authorisation.
- No upstream call is made when the access token is fresh.

## Tests

Using `next/experimental/testing/server` where it helps:

- Matcher: matches `/`, `/login`, `/dashboard`, `/dashboard/x`; does not match `/api/products`,
  `/_next/static/...`, `/_next/image`, `/favicon.ico`.
- Every row of the access matrix, including `/login?session=expired` clearing both cookies.
- Proactive refresh: expiring token → one refresh call, response cookies set, forwarded `Cookie`
  header carries the new access token; fresh token → no refresh call.
- Rejected refresh → cookies cleared and redirect to `/login`; transient failure → passes through
  with cookies untouched.

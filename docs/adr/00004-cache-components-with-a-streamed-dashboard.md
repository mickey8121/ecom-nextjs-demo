# 00004. Cache Components with a streamed dashboard

Date: 2026-10-08

Status: accepted

## Context

`create-next-app` for Next.js 16.4 enables `cacheComponents` and `partialPrefetching` by default,
and the Next.js docs say both become the only mode in the next major release. Under Cache
Components:

- data is dynamic unless explicitly cached with `use cache`;
- reading `cookies()` outside a `<Suspense>` boundary is a build error;
- a layout that awaits the session at its top level blocks everything under it;
- recently visited routes stay mounted in hidden `<Activity>`, and per-session App Shells are
  cached on the client.

The dashboard needs three pieces of session-derived data — the user, the user's carts and the
first page of products — and the assignment asks for them to be rendered on the server.

## Options

- **Keep Cache Components on.** Session reads must sit inside `<Suspense>`.
- **Turn it off** for classic dynamic rendering. Simpler rules, but it goes against the
  framework's default and its next major version.

## Decision

Keep `cacheComponents: true` and `partialPrefetching: true`. Data is uncached by default, so
nothing derived from a session can be cached across users by accident, and the dashboard's
independent data needs map to streamed sections:

- a static shell (page frame, section headings) prerendered at build time;
- one authenticated boundary that starts the products request, awaits the current user, then
  mounts the cart store provider and the header;
- inside it, a carts boundary (needs the user id) and a products boundary (already in flight), so
  `/auth/me` and `/auth/products` run in parallel and only carts waits for the user.

This is still server-side rendering: the data arrives in the same HTTP response, streamed into
the shell.

## Consequences

- CI must run `make build`: Suspense violations surface only in `next build`, not in `tsc` or
  ESLint.
- Layouts never await the session, so the cart store provider is mounted inside the
  authenticated boundary, not in `app/dashboard/layout.tsx`.
- Session-derived data is never wrapped in `use cache`, `use cache: private` or
  `use cache: remote`.
- Route segment configs `dynamic`, `revalidate` and `fetchCache` are unavailable.
- Auth transitions (login, logout, forced logout) use full-page navigation, so nothing from the
  previous session survives in hidden `<Activity>` routes or the client-side App Shell cache.
- Expected upstream errors are rendered as values inside the affected section; production builds
  hide thrown server error messages anyway.
- Do not silence a build error by moving a session read to a layout's top level, by adding
  `export const instant = false`, or by turning Cache Components off. Each of these reverses this
  decision and needs a superseding record.

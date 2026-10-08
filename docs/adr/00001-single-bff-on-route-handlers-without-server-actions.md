# 00001. Single BFF on Route Handlers without Server Actions

Date: 2026-10-08

Status: accepted

## Context

The assignment requires all API interaction to go through the Next.js server (Route Handlers,
Server Actions or Server Components); the browser must never call DummyJSON. It also states that
the number of API endpoints will grow significantly, so the solution must scale without rewriting
the core. Server-rendered data is fetched by Server Components directly from the data access
layer. The open question was the transport for calls the browser initiates: login, logout,
"Load more" (a read) and "Add to cart" (a mutation).

## Options

- **Everything through Server Actions.** The first proposal. Rejected for reads: Server Actions
  are designed for mutations and the client dispatches them one at a time, so "Load more" through
  an action is the kind of thing a reviewer flags.
- **Split: Route Handlers for reads, Server Actions for mutations.** The idiomatic Next.js split.
  The arguments made for Server Actions: form state and progressive enhancement via
  `useActionState`; setting cookies and redirecting in one round trip; revalidating server data
  (`refresh()`, `revalidatePath`) in the same response; typed calls without a client fetch layer;
  a built-in Origin check against CSRF.
- **A single BFF on Route Handlers.** All browser-initiated calls go to `app/api/**/route.ts`;
  Server Components keep reading the data access layer directly.
- **A catch-all proxy route (`/api/[...path]`).** Dismissed in one line: new endpoints would be
  free, but the contract would be untyped and would need a whitelist.

## Decision

A single BFF on Route Handlers; Server Actions are not used.

Applied to this app, the Server Action advantages shrink to login and logout. "Add to cart" gains
only the typed call, and "Load more" gains nothing. The main argument — revalidating server data
in the same response — does not apply, because DummyJSON does not persist added carts, so there
is nothing to revalidate. The CSRF argument is covered by `SameSite=Lax` cookies and JSON-only
bodies. Against that, the split would cost two transports, two error contracts, two places that
persist refreshed tokens and detect a dead session, and two mechanisms for a reviewer to follow.
The `web-next` harness (`/api-rules`, `/route-handler`) also supports Route Handlers only.

## Consequences

- One error contract (`{ error: { code, message } }` plus status) and one browser client that
  turns it into a typed error, shows toasts, and sends `UNAUTHENTICATED` to `/login`.
- One place in the browser path where refreshed tokens are persisted: route handlers, via
  `cookies()`.
- A new endpoint is one entity or feature server function plus one thin route handler, governed
  by `.claude/rules/api.md`.
- Login costs one extra round trip (the handler sets cookies, the client navigates) and a few
  lines of client-side form state.
- Do not add a Server Action "just for one form": it reintroduces a second transport, a second
  error contract and a second refresh-persistence path. Revisit this decision — by superseding
  it — if mutations start needing server revalidation in the same response (for example, carts
  that are actually persisted). In that world the split becomes the better trade.

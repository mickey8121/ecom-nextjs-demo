# 00005. Session-scoped cart store in sessionStorage

Date: 2026-10-08

Status: accepted

## Context

`POST /auth/carts/add` returns a cart with a new id but DummyJSON stores nothing: the cart never
appears in `/auth/carts/user/{id}`. The assignment still expects the result of "Add to cart" to be
visible, so added carts are kept on the client in a simple store. The data comes from behind the
login — products and carts are available to authenticated users only — which raised the question
of where it may live in the browser.

## Options

Where added carts live:

- **Memory only** (`zustand` without persistence). Lost on reload, which honestly mirrors the
  backend. The first recommendation.
- **`localStorage`.** Not a security hole on its own: an XSS on the origin could read the same
  data through the BFF with the user's cookies, and tokens are not stored there. But it breaks the
  login boundary:
  - data outlives the session and sits on disk indefinitely, visible on a shared machine;
  - it leaks to the next user of the browser unless every exit path clears it;
  - it is user-editable;
  - it needs hydration handling against SSR.
- **`sessionStorage`.** Survives a reload within the tab and dies with it.

How the store is created:

- **A module-level store.** During SSR one instance would serve every request — a direct leak of
  one user's carts to another.
- **A store created per mount** through a provider.

## Decision

`zustand` with `persist` to `sessionStorage`, created per mount by a provider in the cart entity
(`createStore` inside the component).

- The storage key includes the user id: `ecom:carts:<userId>`.
- Hydration is client-only (`skipHydration`, then `rehydrate()` after mount).
- The provider is mounted inside the dashboard's authenticated boundary, where the user id is
  known (see 00004).
- The store is cleared on every way out: the logout button, `UNAUTHENTICATED` in the BFF client,
  and on mount of `/login`. Every path ends on `/login`, including the proxy's server-side
  redirect, which cannot reach `sessionStorage`.
- Local carts are display-only: never sent to the server, never a source of truth.

## Consequences

- Added carts survive a reload in the same tab; a new tab starts without them (documented in the
  README).
- Clearing on `/login` mount is the safety net that makes cleanup independent of how the session
  ended.
- Do not switch to `localStorage`, create the store at module level, send local carts to the
  server as data, or remove the `/login` cleanup.

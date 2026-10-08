---
id: ECOM-07
title: Dashboard server rendering
status: done
depends_on: [ECOM-04, ECOM-05, ECOM-06]
branch: feat/ecom-07-dashboard-server-rendering
---

## Context

The dashboard shows the user, the user's carts and the first five products, rendered on the
server and streamed under Cache Components. See `docs/spec.md` §3.3, §3.4, §5.3 and §9, ADR 00004.

## Scope

- **`app/dashboard/page.tsx`:**
  - a static shell with the page frame and section headings;
  - one authenticated `<Suspense>` boundary. Inside it: get the per-request Server Component
    client, start the first products request, await `getCurrentUser`, then render the header and
    two nested boundaries;
  - the carts boundary needs the user id; the products boundary awaits the request already in
    flight, so `/auth/me` and `/auth/products` run in parallel;
  - no layout awaits the session.
- **Widgets:**
  - `dashboard-header`: user badge and the logout button;
  - `cart-overview`: server carts with an empty state; ECOM-09 adds the slot for local carts;
  - `product-feed`: the initial products; ECOM-08 adds "Load more", ECOM-09 adds "Add to cart".
- **Errors:**
  - an expected `ApiError` in a section renders an inline alert with the catalog message, and
    the other sections still render;
  - `UNAUTHENTICATED` → `redirect('/login?session=expired')`;
  - unexpected errors reach `app/dashboard/error.tsx`, which shows a generic catalog message and
    a retry action and never `error.message`.
- A loading fallback per section.

## Out of scope

- "Load more" (ECOM-08), "Add to cart" and the cart store (ECOM-09).

## Acceptance

- `make build` passes: no session read outside `<Suspense>`.
- The dashboard renders all three sections after logging in.
- Reloading after more than a minute refreshes the token in the proxy; the cookies change and
  the page renders without errors.
- A failing section shows its alert while the others render.

## Tests

- The mapping from an error to section UI, extracted as a function: expected `ApiError` → the
  catalog message for its code; `UNAUTHENTICATED` → redirect to `/login?session=expired`; any
  other error → rethrown to the boundary.

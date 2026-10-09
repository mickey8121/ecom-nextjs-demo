---
id: ECOM-09
title: Add to cart
status: done
depends_on: [ECOM-07]
branch: feat/ecom-09-add-to-cart
---

## Context

"Add to cart" sends the product to `POST /auth/carts/add`. DummyJSON does not persist the cart,
so the created cart is kept on the client for the tab and shown next to the server carts. See
`docs/spec.md` §2.3, §3.3, §6 and §8, ADR 00005.

## Scope

- **Route handler `POST /api/carts`**, protected:
  - body `{ productId: int > 0, quantity: int 1–10, default 1 }`, validated with `zod`;
  - the user id comes from the session, never from the body;
  - returns `201 { cart }` through `addCart`.
- **Cart store in `entities/cart/model`:**
  - a `zustand` store created per mount by a provider (never at module level);
  - persisted to `sessionStorage` under `ecom:carts:<userId>`;
  - `skipHydration`, then `rehydrate()` after mount;
  - actions to append a cart and to clear.
- **Provider mount:** inside the dashboard's authenticated boundary from ECOM-07, once the user
  id is known.
- **`features/add-to-cart`:**
  - an "Add to cart" button per product, with a per-item pending state;
  - success → the cart goes into the store and a toast shows its id;
  - failure → a toast with the catalog message.
- **`cart-overview`:** renders locally added carts after hydration, marked as added in this
  session.

## Out of scope

- Editing or removing carts.

## Acceptance

- An added cart appears in the carts block, survives a reload in the same tab, and is absent in a
  new tab.
- After logout, a forced logout, or opening `/login`, no `ecom:` keys remain in `sessionStorage`.

## Tests

- Handler:
  - valid body → `201 { cart }`;
  - a body that also carries `userId: 999` still sends the session's user id upstream;
  - invalid body → `400 VALIDATION_ERROR`;
  - no session → `401 UNAUTHENTICATED`.
- Store:
  - storage key per user id;
  - append, then clear;
  - two provider mounts get independent stores;
  - nothing is created at module level.

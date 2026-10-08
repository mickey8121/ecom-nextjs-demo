---
id: ECOM-08
title: Product pagination
status: done
depends_on: [ECOM-07]
branch: feat/ecom-08-product-pagination
---

## Context

"Load more" appends the next five products to the server-rendered list. It is the first protected
BFF endpoint and, with a one-minute access token, the natural demonstration of reactive refresh.
See `docs/spec.md` §3.3, §4.4 and §6, `.claude/rules/api.md`.

## Scope

- **Route handler `GET /api/products`**, protected:
  - query `skip` (int ≥ 0, default 0) and `limit` (int 1–30, default 5), validated with `zod`;
  - returns `200 { items, total, skip, limit }` through `getProducts`;
  - session handling through ECOM-03's route-handler store and authenticated client.
- **`features/product-pagination`:**
  - list state seeded with the server-rendered page;
  - appends the next page, deduplicating by id;
  - knows when everything is loaded;
  - a "Load more" button with a pending state that cannot be double-submitted;
  - failures shown as a toast, with the list unchanged.
- `product-feed` widget uses the feature; the button disappears once all products are loaded.

## Out of scope

- "Add to cart" (ECOM-09).

## Acceptance

- After more than a minute of inactivity, "Load more" succeeds: the handler gets `401` upstream,
  refreshes once, retries, and the response updates the cookies — visible in the browser's
  network panel.
- No request from the browser goes anywhere but the app's own origin.

## Tests

- Handler:
  - valid query → envelope;
  - invalid `skip`/`limit` → `400 VALIDATION_ERROR`;
  - no session → `401 UNAUTHENTICATED`;
  - upstream `401` then a successful refresh → `200` with refreshed cookies set;
  - upstream error text absent from the body.
- Pagination state: append, deduplication by id, end-of-list detection, the list unchanged on
  failure.

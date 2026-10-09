---
id: ECOM-11
title: Single local cart for added products
status: done
depends_on: [ECOM-09]
branch: fix/ecom-11-single-local-cart
---

## Context

Every "Add to cart" click currently appends a new `CartDto` to the local store, so the carts block
shows one card per click, all titled `Cart #209`: DummyJSON gives every created cart the same id
and persists none of them. Found during the manual pass of ECOM-10. The user expects one local
cart that accumulates the products added in this tab. See `docs/spec.md` §2.3, §3.3 and §8,
ADR 00005.

The merge happens on the client: local carts are display-only and are never sent back to the
server as data (ADR 00005), and the cart DummyJSON returns is never stored on its side, so there is
nothing to merge against upstream.

## Scope

- **`entities/cart/model`:**
  - the store holds one `cart: CartDto | null` per user instead of `carts: CartDto[]`;
  - `addToCart(cart)` merges the returned cart into the local one: the first add stores it as is;
    later adds append its items, and an item whose product id is already present has its
    `quantity` and `total` added up instead of a second line;
  - `total`, `discountedTotal` and `totalQuantity` of the local cart are recomputed from its items,
    so `CartItemDto` gains the per-item discounted total that DummyJSON returns for each product.
    Verify the field name against the live API and record it in spec §2.3;
  - the local cart keeps the id DummyJSON returned;
  - the persisted shape changes, so `persist` gets a `version` bump that drops the old
    `{ carts: [] }` state instead of migrating it;
  - `clear()` stays.
- **`widgets/cart-overview`:** renders the single local cart first, marked "Added in this
  session", then the server carts. The positional key and its comment go away.
- **`features/add-to-cart`:** calls the new store action; the toast still shows the cart id.
- **Docs:** spec §3.3 and §8 describe one accumulating local cart; the README limitation about
  added carts says the tab holds one local cart rather than "every added cart has the same id".

## Out of scope

- Changing `POST /api/carts` or sending the accumulated items upstream.
- Removing items or changing quantities from the UI.
- Merging the local cart with the server carts.

## Acceptance

- Adding three different products shows one "Added in this session" card with three lines; the
  footer counts three items and its totals are the sums of the lines.
- Adding the same product twice shows one line with `× 2`, not two lines.
- The local cart survives a reload in the same tab and is absent in a new tab (unchanged from
  ECOM-09).
- A tab that still holds the ECOM-09 `{ carts: [] }` state starts with an empty local cart and no
  error.

## Tests

- Store:
  - first add stores the cart as returned;
  - a second cart with a new product appends a line and recomputes the three totals;
  - a second cart with an already present product adds up `quantity` and `total` on the existing
    line;
  - the stored id is the id DummyJSON returned;
  - `clear()` empties the cart and the storage entry;
  - an old-version persisted state is dropped on rehydrate;
  - the storage key per user id and the per-mount independence from ECOM-09 still hold.
- Mapper: the per-item discounted total is mapped, unknown fields are still dropped.

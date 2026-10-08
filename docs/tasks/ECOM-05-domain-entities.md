---
id: ECOM-05
title: Domain entities
status: todo
depends_on: [ECOM-03]
branch: feat/ecom-05-domain-entities
---

## Context

The user, product and cart entities own their DTOs, the mapping from DummyJSON payloads, the
server functions that fetch them and their display components. The browser never sees raw
DummyJSON payloads. See `docs/spec.md` §2.1, §5.2 and §5.3, `.claude/rules/api.md` (success
envelopes).

## Scope

- **`entities/user`:** `UserDto` (id, username, first and last name, email, image) and its
  mapper; server function `getCurrentUser(client)` for `GET /auth/me`, wrapped in React `cache`
  so all sections of one render share one call; a small user badge component.
- **`entities/product`:** `ProductDto` (id, title, price, thumbnail, category, rating) and its
  mapper; server function `getProducts(client, { skip, limit })` for `GET /auth/products`,
  returning the list envelope `{ items, total, skip, limit }` and requesting only the fields it
  maps; a product card with an actions slot, so features can add buttons without the entity
  importing them.
- **`entities/cart`:** `CartDto` with its own line-item type (no import from the product entity)
  and its mapper; server functions `getUserCarts(client, userId)` for
  `GET /auth/carts/user/{userId}` and `addCart(client, userId, items)` for `POST /auth/carts/add`;
  a cart card.
- `next.config.ts`: `images.remotePatterns` for `https://cdn.dummyjson.com`; images render through
  `next/image`.
- Each slice exposes `index.ts` (types, mappers, components) and `index.server.ts` (server
  functions).

## Out of scope

- Route handlers and pages (ECOM-06 onward).
- The client-side cart store (ECOM-09).

## Acceptance

- Server functions receive an authenticated client and never read cookies.
- Mappers drop every field the DTO does not declare; the user mapper drops `accessToken` and
  `refreshToken` when given a login-shaped payload.

## Tests

- Mappers: upstream payload → DTO; unknown fields dropped; user mapper on a login-shaped payload
  returns no token fields.
- Server functions call the right upstream path and method with the right parameters (mocked
  client) and return mapped DTOs and envelopes.

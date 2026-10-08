---
id: ECOM-02
title: Upstream client and error catalog
status: done
depends_on: [ECOM-01]
branch: feat/ecom-02-upstream-client-and-error-catalog
---

## Context

All server code talks to DummyJSON through one client, all errors reach users through one catalog,
and the browser talks to the BFF through one client. See `docs/spec.md` §3.4, §5.3, §6 and §7,
`.claude/rules/api.md`, ADR 00001.

## Scope

In `shared/api`:

- **Error catalog** (client-safe): every code from spec §6 with its status and user-facing
  message, including the client-only `NETWORK_ERROR`.
- **Upstream client** (server-only): JSON request to the configured base URL with
  `cache: 'no-store'`, a 10-second timeout and an optional bearer token. Failures keep the upstream
  status internally — ECOM-03 needs to recognise a `401` — and are mapped to catalog codes in one
  place: `404` → `NOT_FOUND`; any other non-2xx, network error, timeout or non-JSON body →
  `UPSTREAM_ERROR`. Each failure is logged with method, upstream path, status, duration and the
  upstream message; tokens, passwords and cookie values are never logged.
- **BFF response helpers** (server-only): the error body `{ error: { code, message } }` with the
  catalog message and status; unknown exceptions become `INTERNAL_ERROR` and are logged. Body and
  query parsing with a `zod` schema that fails with `VALIDATION_ERROR`, rejects non-JSON bodies,
  and never returns zod's messages.
- **BFF client** (client-safe): `fetch` to `/api/*`, success bodies parsed (`204` → no body),
  error bodies turned into a typed error with `code`, `status` and the catalog message. A network
  failure becomes `NETWORK_ERROR`; a response that is not the BFF error shape (an HTML error page,
  a non-JSON body) becomes `UPSTREAM_ERROR`. On `UNAUTHENTICATED` it clears session data and
  performs a full-page navigation to `/login`.
- `shared/lib`: a helper that removes every `sessionStorage` key with the `ecom:` prefix and does
  nothing when storage is unavailable.
- Public API: `index.ts` (catalog, client, error type) and `index.server.ts` (upstream client,
  response and parsing helpers).
- `package.json`: drop `--passWithNoTests` from `test`, and the matching gotcha in `CLAUDE.md`.

## Out of scope

- Tokens, sessions and refresh (ECOM-03).
- Any route handler (ECOM-06 onward).

## Acceptance

- No user-facing message anywhere in this layer comes from an upstream body or an exception.
- The browser client never shows the message of a caught `TypeError` or `SyntaxError`.

## Tests

- Catalog: every code has a status and a non-empty message.
- Upstream client: `404`, `5xx`, network failure, timeout and non-JSON body map to the expected
  codes; an upstream body `{"message":"invalid token"}` never appears in the mapped error's
  user-facing message; a `401` stays recognisable as a `401`.
- Response helpers: error body shape and status; unknown exception → `INTERNAL_ERROR`; invalid
  body and invalid query → `VALIDATION_ERROR` with the catalog message and no zod text.
- BFF client: success and `204` parsing; error-shape parsing; network failure → `NETWORK_ERROR`;
  HTML or non-JSON error → `UPSTREAM_ERROR`; `UNAUTHENTICATED` clears session data and navigates
  to `/login`.
- Session-data helper: removes only `ecom:` keys; tolerates missing storage.

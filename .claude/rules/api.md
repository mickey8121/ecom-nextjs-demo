---
paths:
  - 'app/api/**'
---

# API conventions — route handlers

Drafted by `/api-rules` in greenfield mode on 2026-10-08 from the decisions in `docs/spec.md` §6
and ADR 00001; checked against the tree in drift mode on 2026-10-09 (2 route files). The
reference handlers are `app/api/auth/login/route.ts` and `app/api/auth/logout/route.ts`.

## Placement

- One file per resource: `app/api/<resource>/route.ts`. Actions nest under their resource:
  `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`.
- Handlers are thin: validate input → call a feature or entity server function → return JSON or
  map the error. No business logic and no direct upstream calls in `app/`.
- Handlers import slices only through their `index.server.ts`, and server helpers only through
  `shared/api`'s `index.server.ts`.
- Each `route.ts` has a `route.test.ts` beside it. `next/headers` is mocked with
  `vi.mock('next/headers', () => ({ cookies: vi.fn() }))` plus `FakeCookies` and `mockCookies`
  from `@/test/next-headers`.

## Config exports

- Runtime: Node.js — the default, so handlers do not export `runtime`. Never `runtime = 'edge'`:
  Cache Components requires Node.js.
- Every route file exports `maxDuration = 30`.
- Never export `dynamic`, `revalidate` or `fetchCache`: they error under Cache Components.

## Auth gate

- Public handlers: `POST /api/auth/login`, `POST /api/auth/logout`. Every other handler is
  protected.
- A protected handler builds the route-handler session store from `cookies()` and an
  authenticated client from that store. No session → `401 UNAUTHENTICATED`.
- Refresh and the single retry happen inside the authenticated client; the handler never sees
  them. Refreshed tokens are persisted through `cookies()` by the store.
- Handlers and the functions they call never read the token cookies directly: data access
  functions receive the authenticated client.
- A handler that changes the session — the public ones included — passes the route-handler store
  to a feature function, which calls `set` or `clear`; the handler never touches cookies:

  ```ts
  const user = await login(await createRouteHandlerSessionStore(), credentials);
  ```

## Ownership

- Resources are scoped to the session's user id, derived on the server from the access token's
  claims.
- A user id is never taken from the body, query or path. The same token goes upstream, so forged
  claims are rejected there.

## Quota gate

Not applicable — see Gaps.

## Input validation

- Every body and query is parsed with a `zod` schema.
- Bodies must be JSON.
- Invalid input → `400 VALIDATION_ERROR` with the catalog message. zod's own messages are never
  returned.

## Error shape and status table

Every non-2xx response:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password."
  }
}
```

- `message` is always the catalog message for `code` (the error catalog in `shared/api`). It is
  never copied from the upstream response or from an exception, and never refined: the browser
  client reads only `code` and takes the message from the catalog.
- Every handler maps failures in one place:

  ```ts
  export async function POST() {
    try {
      logout(await createRouteHandlerSessionStore());
      return new Response(null, { status: 204 });
    } catch (error) {
      return toErrorResponse(error);
    }
  }
  ```

  `toErrorResponse` lets Next.js control flow through, maps an `AppError` to its code and turns
  anything else into a logged `INTERNAL_ERROR`.

| Code                  | Status | When                                                 | Client behaviour     |
| --------------------- | ------ | ---------------------------------------------------- | -------------------- |
| `VALIDATION_ERROR`    | 400    | Body or query failed validation                      | show message         |
| `INVALID_CREDENTIALS` | 401    | Login rejected by DummyJSON                          | show message inline  |
| `UNAUTHENTICATED`     | 401    | No session, refresh rejected, or `401` after refresh | navigate to `/login` |
| `NOT_FOUND`           | 404    | Upstream `404`                                       | show message         |
| `UPSTREAM_ERROR`      | 502    | Upstream non-401 error, network failure or timeout   | show message         |
| `INTERNAL_ERROR`      | 500    | Unexpected exception                                 | show message         |

- The code, not the status, drives client behaviour: only `UNAUTHENTICATED` redirects, while
  `INVALID_CREDENTIALS` is also a `401` and renders inline.
- `NETWORK_ERROR` exists only in the browser client; handlers never return it.
- Only `401` from upstream triggers refresh; DummyJSON's `500 invalid token` maps to
  `UPSTREAM_ERROR`.

## Success envelopes

- A single resource is wrapped by its name: `{ "user": UserDto }`, `{ "cart": CartDto }`.
- A list: `{ "items": [...], "total": n, "skip": n, "limit": n }`.
- Creation returns `201`; an action with nothing to return is `204` with no body.
- Bodies carry entity DTOs, never raw DummyJSON payloads — which also keeps tokens from the login
  response out of the browser.

## Logging

- Upstream failures are logged on the server with method, upstream path, status, duration and the
  upstream message. The server log is the only place raw upstream text goes.
- Tokens, passwords and cookie values are never logged.
- Format: `console.error('<fixed lowercase event>', <context>)`. The context is an object of named
  fields; only the unexpected-exception log passes the caught value whole. No logging library.

  ```ts
  console.error('upstream request failed', {
    method,
    path,
    status,
    durationMs: Math.round(performance.now() - startedAt),
    upstreamMessage: upstreamMessage.slice(0, UPSTREAM_MESSAGE_MAX_LENGTH),
  });
  ```

  The sites today: `upstream request failed` (`shared/api/upstream.ts`),
  `unexpected route handler error` (`shared/api/bff-response.ts`),
  `upstream response has no token pair` (`shared/api/session/token-pair.ts`).

## Legacy

None — both route files (`app/api/auth/login`, `app/api/auth/logout`) follow every rule.

## Gaps

- **quota** — dimension: quota and entitlement gate. 0 route files; the manifest has no quota or
  billing dependency, and the product has no usage limits. Rate limiting is a declared non-goal
  (`docs/spec.md` §1): an in-memory limiter is unreliable on serverless, and a real one needs a
  shared store or host firewall rules. Settled when a usage limit or a shared store is introduced.

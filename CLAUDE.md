# ecom-nextjs-demo

A small e-commerce prototype on Next.js 16 (App Router) over the DummyJSON API: login, a protected
dashboard rendered on the server, product pagination and add-to-cart, with automatic JWT refresh
handled entirely on the Next.js server.

@AGENTS.md

## Stack

- Next.js 16.4 (App Router), React 19.3
- TypeScript 5
- Tailwind CSS 4 (`@tailwindcss/turbopack`)
- Vitest 5, ESLint 9 (`eslint-config-next`), Prettier 3
- pnpm 10, Node 22

## Map

- `app/` — Next.js App Router: routing, layouts, page composition, `api/**/route.ts` (the BFF)
- `widgets/`, `features/`, `entities/`, `shared/` — FSD layers at the repo root
- `proxy.ts` — request boundary at the repo root: route access and proactive token refresh
- `test/` — Vitest support, outside the FSD layers: `FakeCookies` for `next/headers`, `makeJwt`,
  `deferred`, `MemoryStorage`
- `docs/spec.md` — product and architecture spec; `docs/adr/` — decisions via `/adr`;
  `docs/tasks/` — one file per task
- `.claude/` — harness settings; rules files go in `.claude/rules/`

## Commands

The `Makefile` is the contract the harness reads — target _names_ are the
interface, the recipes behind them are this project's business. The hooks and
skills never invoke a package manager directly.

| Target                   | What it runs                                                    | Who calls it                           |
| ------------------------ | --------------------------------------------------------------- | -------------------------------------- |
| `check-file FILE=<path>` | ESLint on one file, zero warnings, ignored files skipped        | the `post-edit` hook, after every edit |
| `check`                  | `prettier --check`, `next typegen` + `tsc --noEmit`, `eslint .` | `/ship` and CI                         |
| `test`                   | `vitest run`                                                    | `/ship` and CI                         |
| `build`                  | `next build`                                                    | CI                                     |
| `fmt`                    | `prettier --write .`                                            | humans and skills, never automatically |

Day-to-day commands that are not part of the contract:

- `pnpm dev` — `next dev`
- `pnpm start` — `next start` (serves a prior build)

## Conventions

How this project _writes_ things is decided once and written down under
`.claude/rules/`, read at a declared path and authoritative where it applies.
A rules file that exists governs alone: the skill reading it does not fall back
to imitating neighbouring code, and where the file and the tree disagree the
file wins and the disagreement is reported rather than reconciled.

- `.claude/rules/api.md` — route handler conventions; drafted by `/api-rules`

These files are owned by a human. A skill may draft one and must show the whole
draft first; nothing lands without an explicit yes.

## Hard conventions

Everything in the repo is English: code, comments, docs, commits, pull requests.

Architecture — the reasons are in `docs/spec.md` and `docs/adr/`:

- The browser never calls DummyJSON. All client calls go through Route Handlers under
  `app/api/**`, a single BFF. Server Actions are deliberately not used.
- FSD layers live at the repo root, no `src/`. Next's `app/` stands in for the FSD `app` and
  `pages` layers and holds composition only — no business logic, no direct upstream fetches.
- Imports go strictly downward: `app` → `widgets` → `features` → `entities` → `shared`.
  Slices of one layer never import each other. Enforced by `eslint-plugin-boundaries`.
- A slice exposes `index.ts` (client-safe) and `index.server.ts` (`import 'server-only'`).
  Never import a slice's internals.
- No root `components/`, `hooks/` or `pages/`. A root `pages/` would switch on the Pages Router.
- Tokens live only in httpOnly cookies. They never reach client JS, storage or a response body.
- Users see only messages from the error catalog in `shared/api`. Raw upstream or exception text
  goes to server logs only — never into a response body, a toast or an error boundary.
- Session-derived data is never wrapped in `use cache` (any variant); upstream calls use
  `cache: 'no-store'`. No module-level per-user state — the refresh in-flight map is the only exception.
- Data access functions receive an authenticated client; they never read cookies themselves.
- Auth transitions (login, logout, forced logout) use full-page navigation, not the client router.
- Environment variables are for secrets only, and this project has none. Non-secret config
  (the API base URL, the token TTL) lives in `shared/config`.

Process:

- Tasks live in `docs/tasks/ECOM-NN-<slug>.md`, done in numeric order. One task = one branch
  (`<type>/ecom-NN-<slug>`, the task's `branch` field) = one PR titled `ECOM-NN: <title>`,
  squash-merged into `main`. The PR's last commit sets the task's `status` to `done` in the task
  file and in `docs/tasks/README.md`.
- Run `make fmt` before `/ship`: `check` fails on unformatted files.
- Commits are SSH-signed. Never pass a flag that disables signing.

## Gotchas

- `pnpm typecheck` runs `next typegen` before `tsc --noEmit`. Running bare `tsc`
  skips the generated route types and can report errors that aren't real.
- Some errors (e.g. `cacheComponents` violations) appear only in `next build`,
  not in `check`. CI runs `make build` for that reason.
- `AGENTS.md` is rewritten by `next dev`. Don't edit it; it is excluded from Prettier.
- `import 'server-only'` throws outside Next. `vitest.config.mts` aliases it to
  `test/empty-module.ts`.
- `next/experimental/testing/server` in 16.4 exports `unstable_doesMiddlewareMatch`; the
  `unstable_doesProxyMatch` named in the proxy docs does not exist yet.
- Next's lint rule `no-location-assign-relative-destination` rejects `location.assign('/…')`.
  Auth transitions navigate through `navigateFullPage` from `shared/lib`.
- A new top-level folder or root file fails `boundaries/no-unknown-files`. Register it in
  `eslint.config.mjs` (`boundaries/elements` or `boundaries/files`) only if the layers allow it.
- `.env*` is git-ignored and unreadable by Claude (`permissions.deny`). That is intended:
  there are no secrets, so there is no `.env`.

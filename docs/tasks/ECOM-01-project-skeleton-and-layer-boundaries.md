---
id: ECOM-01
title: Project skeleton and layer boundaries
status: todo
depends_on: []
branch: chore/ecom-01-project-skeleton-and-layer-boundaries
---

## Context

Every later task writes into the FSD layers and relies on lint to keep imports pointing downward.
The layers, their rules and the shared building blocks have to exist first. See `docs/spec.md`
§5.2 and §5.4, ADR 00003.

## Scope

- Runtime dependencies: `zod`, `sonner`, `zustand`. Dev dependency: `eslint-plugin-boundaries`
  (plus an import resolver for the `@/*` alias if the plugin needs one). Installed with the
  repository's `minimumReleaseAge` in force.
- `eslint-plugin-boundaries` configured in `eslint.config.mjs`:
  - elements: `app` (`app/**` and `proxy.ts`), `widgets`, `features`, `entities` (each captures
    its slice), `shared` (segments);
  - imports only downward: `app` → `widgets` → `features` → `entities` → `shared`;
    `shared` imports only `shared`;
  - no imports between slices of the same layer;
  - a slice is entered only through `index.ts` or `index.server.ts`;
  - files outside known elements are reported, except root config files and test files.
- `shared/config`: the constants from spec §5.4 — API base URL, access token TTL (1 minute),
  refresh leeway (10 seconds), products page size (5), upstream timeout (10 seconds), session
  cookie names, and the `sessionStorage` key prefix (`ecom:`).
- `shared/ui`: minimal Tailwind primitives the later tasks need — a button with a pending state,
  an alert (error and info variants), a spinner.
- Root layout: page metadata and `sonner`'s `<Toaster />`.
- `vitest.config.ts`: alias `server-only` to an empty module so server code is testable.
- `CLAUDE.md`: drop the "created in ECOM-01" / "from ECOM-01" notes.

## Out of scope

- Any route, page or API code (ECOM-04 onward).
- `next/image` remote patterns (ECOM-05).
- Removing `--passWithNoTests` (ECOM-02 adds the first tests).

## Acceptance

- A file in `entities/` importing from `features/`, a feature importing another feature, and an
  import of a slice's internal file are each reported by `make check-file` — shown in the pull
  request description with throwaway files that are not committed.
- `shared/config` values match spec §5.4.
- The root layout renders the toaster.

## Tests

None required — the task adds configuration and constants only.

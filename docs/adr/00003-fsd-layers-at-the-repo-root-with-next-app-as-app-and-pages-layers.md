# 00003. FSD layers at the repo root with Next app as the app and pages layers

Date: 2026-10-08

Status: accepted

## Context

The project uses Feature-Sliced Design where it fits. FSD's top layers are `app` and `pages`;
Next.js reserves both names: `app/` is the App Router, and a `pages/` directory — looked up at the
root and then under `src/`, per name — switches on the Pages Router. The author's other projects
(resume-checker) keep FSD layers at the repo root without `src/`.

## Options

- **`src/` with renamed `_app` and `_pages` layers**, the Next.js recipe in the official FSD
  guide: Next's `app/` at the root holds thin re-exports; FSD code lives in `src/`. The first
  proposal. Questioned on two points: once the clashing layers are renamed, `src/` only separates
  code from config files cosmetically; and the two renamed layers would hold little — providers
  and global styles (already the job of `app/layout.tsx` and `app/globals.css`) and page
  composition (already the job of `app/**/page.tsx`).
- **Layers at the repo root, no FSD `app` and `pages` layers**: Next's `app/` stands in for both
  and holds composition only. Consistent with the author's other projects.

Enforcement:

- **Steiger**, the official FSD linter. Mentioned as an option only.
- **`eslint-plugin-boundaries`.**

## Decision

FSD layers `widgets`, `features`, `entities` and `shared` live at the repo root, with no `src/`.
Next's `app/` is the app and pages layer: routes, layouts, providers assembly, page composition
and `api/**/route.ts`. Route handler logic calls `features` and `entities` directly instead of
going through an `_app/api-routes` segment.

Rules:

- Imports go strictly downward: `app` → `widgets` → `features` → `entities` → `shared`.
- Slices of one layer do not import each other; entities that ever need to reference each other
  use FSD's `@x` notation.
- A slice is imported only through `index.ts` (client-safe) or `index.server.ts` (server-only).
- No files outside the known layers.

Providers are placed by their dependencies: business-free ones may live in `shared` (resume-
checker's `shared/providers` was checked and is correct FSD for that reason), domain ones in
their slice, and the provider tree is assembled in `app/`.

The rules are enforced by `eslint-plugin-boundaries`, which runs in `make check-file` — after
every edit, through the harness's post-edit hook — and in `make check`.

## Consequences

- `app/` is composition only: no business logic and no direct upstream calls. This is the one
  deliberate deviation from canonical FSD.
- A layer violation fails the edit that introduced it, not a later review.
- Page composition is not reusable outside its route, which is acceptable at this size.
- Do not reintroduce `src/` or `_app`/`_pages` without superseding this record.
- Do not add root `components/` or `hooks/` folders. In resume-checker, a root `components/`
  with domain folders sits outside the layers and is imported by features, so the direction
  rules cannot see it; `components/ui` and `hooks/` exist only because of shadcn's default
  aliases. A root `pages/` would switch on the Pages Router.

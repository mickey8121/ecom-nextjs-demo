# Tasks

The implementation of `docs/spec.md`, split into tasks. One task = one branch = one pull request,
squash-merged into `main`.

| ID                                                          | Title                                 | Depends on | Status |
| ----------------------------------------------------------- | ------------------------------------- | ---------- | ------ |
| [ECOM-01](ECOM-01-project-skeleton-and-layer-boundaries.md) | Project skeleton and layer boundaries | —          | done   |
| [ECOM-02](ECOM-02-upstream-client-and-error-catalog.md)     | Upstream client and error catalog     | 01         | todo   |
| [ECOM-03](ECOM-03-session-and-token-refresh.md)             | Session and token refresh             | 02         | todo   |
| [ECOM-04](ECOM-04-request-boundary-proxy.md)                | Request boundary (`proxy.ts`)         | 03         | todo   |
| [ECOM-05](ECOM-05-domain-entities.md)                       | Domain entities                       | 03         | todo   |
| [ECOM-06](ECOM-06-login-and-logout.md)                      | Login and logout                      | 03, 05     | todo   |
| [ECOM-07](ECOM-07-dashboard-server-rendering.md)            | Dashboard server rendering            | 04, 05, 06 | todo   |
| [ECOM-08](ECOM-08-product-pagination.md)                    | Product pagination                    | 07         | todo   |
| [ECOM-09](ECOM-09-add-to-cart.md)                           | Add to cart                           | 07         | todo   |
| [ECOM-10](ECOM-10-deployment-and-readme.md)                 | Deployment and README                 | 08, 09     | todo   |

Tasks are done in numeric order.

## Workflow

- **Branch:** the `branch` field of the task file, `<type>/ecom-NN-<slug>`.
- **Pull request title:** `ECOM-NN: <title>`.
- **Status:** `todo` until the work is merged. An open pull request means the task is in progress.
  The pull request's last commit sets `status: done` in the task file and in the table above.
- **Before `/ship`:** `make fmt`, then `make check`, `make test` and `make build` must be green.
- **Merge:** squash, then delete the branch locally and on the remote.

## Task file format

```markdown
---
id: ECOM-NN
title: <title>
status: todo | done
depends_on: [ECOM-NN, ...]
branch: <type>/ecom-NN-<slug>
---

## Context — why the task exists, with links to the spec and ADRs

## Scope — what the task delivers

## Out of scope — what belongs to other tasks

## Acceptance — observable conditions for done

## Tests — what must be proven in Vitest
```

Definition of done for every task, in addition to its own acceptance criteria:

- `make check`, `make test`, `make build` are green locally and in CI.
- The code follows `CLAUDE.md` and `.claude/rules/api.md`; boundary lint passes.
- Anything the task changed in the decided design is reflected in `docs/spec.md` or a new ADR.

---
id: ECOM-10
title: Deployment and README
status: todo
depends_on: [ECOM-08, ECOM-09]
branch: docs/ecom-10-deployment-and-readme
---

## Context

The assignment is delivered as a GitHub repository and a deployed URL. The README is the
reviewer's entry point and has to show the decisions and the upstream behaviour that was verified,
not just how to run the project. See `docs/spec.md` §2.3, §12 and §13.

## Scope

- **Vercel:**
  - the project is linked to the GitHub repository (done by the repository owner, since it needs
    their Vercel account);
  - Node 22, no environment variables;
  - production deploys from `main`.
- **Manual pass on the production URL:**
  - login;
  - dashboard;
  - reload after a minute (proactive refresh);
  - "Load more" after a minute (reactive refresh);
  - add to cart;
  - logout;
  - `/login?session=expired`.
- **README:**
  - what the app does, with the deployed URL and the test credentials;
  - how to run it locally;
  - architecture in brief, linking `docs/spec.md` and the ADRs;
  - the DummyJSON behaviour verified by hand (spec §2.3);
  - known limitations:
    - no refresh deduplication across instances;
    - Server Component refresh is not persisted;
    - added carts are per tab;
    - no rate limiting;
    - `/login?session=expired` can be linked to log someone out.

## Out of scope

- New features or refactoring.

## Acceptance

- Every step of the manual pass works on the production URL.
- The README links resolve, and the deployed URL is in the README and the repository description.

## Tests

None beyond the existing suite.

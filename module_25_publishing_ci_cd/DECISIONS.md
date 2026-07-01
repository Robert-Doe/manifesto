# Module 25 — DECISIONS.md: Publishing & CI/CD

## Decision 1: CWS Publish API Requires OAuth2 Client Credentials, Not User Credentials

The CI/CD workflow in `.github/workflows/ci.yml` uses `CWS_ACCESS_TOKEN` to publish. This token comes from OAuth2 client credentials flow against Google's OAuth endpoint — not a user's access token. The setup: create a Google Cloud project, enable the Chrome Web Store API, create OAuth2 credentials, store the refresh token as a GitHub secret, and exchange it for an access token in the CI job. This is a one-time setup that enables fully automated publishing.

## Decision 2: Zip Exclusions Are as Important as Inclusions

The CI job excludes `node_modules`, `src/`, `.git`, `*.map`, `*.test.*`, `__tests__/`, `*.md`, `*.sh`, and `.github/` from the submission zip. CWS rejects submissions containing: `node_modules` (too large), source maps (exposes source), test files (non-extension code), and `.git` directories (metadata). The exclusion list is intentionally conservative.

## Decision 3: Lint-then-Build Dependency Prevents Broken Publishes

The CI workflow has three jobs: `lint-and-validate` → `build` → `publish-to-cws` (on main only). The `needs:` dependency chain means a lint failure blocks the build, and a build failure blocks publishing. This prevents a broken extension from being submitted to the store, which triggers review delays and potential trust penalty with Google's review queue.

## Decision 4: manifest.json Version Validation in CI

The manifest validation step checks that version matches `\d+\.\d+\.\d+`. This catches common mistakes: missing the version field, wrong format, not incrementing from the previous publish. The check runs before the build — fast feedback. A more complete check would compare against the currently published version via the CWS API.

## Decision 5: Publish to CWS Does Not Immediately Make It Live

The `items.publish` API call submits the extension for review, not instant publication. New extensions and those with significant changes go to manual review. The API response indicates `ITEM_PENDING_REVIEW` or `PUBLISHED`. Build your CI to report the status, not assume immediate publication. Set expectations: routine updates ship in 1-2 days; permission changes take 1-3 weeks.

## Decision 6: The Submission Checklist Is the Human Gate Before Automation

The `submission_checklist.html` in this module is the human checklist that runs before you tag a release and trigger CI. Automation catches missing files and bad manifests; the checklist catches UX regressions, missing screenshots, and policy landmines that automated tools can't detect. A 15-minute manual checklist before publishing prevents a 2-week review cycle restart.

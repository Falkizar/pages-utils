/**
 * @falkizar/pages-utils
 *
 * Cloudflare Pages Functions utilities for Falkizar apps. Generic, non-
 * auth-specific helpers extracted out of kids-library after the second
 * consumer (web-hub) needed them. Sibling package to
 * @falkizar/access-middleware (which owns the auth chain).
 *
 * Three surfaces:
 *
 * 1. HTTP helpers — `json` / `jsonError` / `readJson` / `HttpError` /
 *    `handler`. Every `/api/*` route in a Falkizar app should be
 *    wrapped with `handler()`.
 *
 * 2. Preview-branch write guard — `guardPreviewWrites(ctx)`. Call early
 *    in any mutating endpoint to refuse writes on non-main branches.
 *
 * 3. Build-time version metadata — `AppVersion`, `DependencyVersion`,
 *    `relativeTime`, `commitUrl`, `dependencyUrl`. Standardizes the
 *    "what version is deployed?" display every Falkizar app shows to
 *    admins.
 *
 * See web-hub/docs/app-baseline.md for the canonical usage write-up
 * and web-hub/docs/adding-a-new-app.md for the recipe.
 */

export {
  json,
  jsonError,
  readJson,
  HttpError,
  handler,
} from './http';
export type { AnyContext } from './http';

export { guardPreviewWrites } from './branch-guard';
export type { BranchGuardEnv, BranchGuardCtx } from './branch-guard';

export {
  relativeTime,
  commitUrl,
  dependencyUrl,
} from './version';
export type { AppVersion, DependencyVersion } from './version';

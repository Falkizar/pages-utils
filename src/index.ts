/**
 * @falkizar/pages-utils
 *
 * Cloudflare Pages Functions utilities for Falkizar apps. Generic, non-
 * auth-specific helpers extracted out of kids-library after the second
 * consumer (web-hub) needed them. Sibling package to
 * @falkizar/access-middleware (which owns the auth chain).
 *
 * Surfaces:
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
 *    "what version is deployed?" display every Falkizar app shows.
 *
 * 4. Version-footer renderer — `renderVersionFooterHtml(version)`.
 *    Canonical cross-app version-display block (server-rendered,
 *    progressively-upgraded admin links).
 *
 * 5. Hub back-link renderer — `renderHubBackLinkHtml()`. The
 *    "← Falkizar" anchor every non-hub app surfaces top-of-body.
 *
 * Browser-only client helpers (`upgradeAdminFromMe`) live behind the
 * `/client` subpath so they can never leak into a Worker bundle.
 * Build-time generators (`generateVersionModule`) live behind `/build`.
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

export {
  renderVersionFooterHtml,
  VERSION_FOOTER_CSS,
} from './version-footer';
export type { RenderVersionFooterOptions } from './version-footer';

export {
  renderHubBackLinkHtml,
  HUB_BACK_LINK_CSS,
  isSafeHubUrl,
} from './hub-back';
export type { RenderHubBackLinkOptions } from './hub-back';

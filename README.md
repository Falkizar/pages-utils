# @falkizar/pages-utils

Generic Cloudflare Pages Functions utilities for Falkizar apps. Sibling package to [`@falkizar/access-middleware`](https://github.com/Falkizar/access-middleware) — that package owns the auth chain; this one owns everything else that's reusable across apps.

## Why this exists

Multiple Falkizar apps (private to the org) needed the same handful of helpers:

- A `handler()` wrapper for `/api/*` endpoints that turns thrown HttpErrors into JSON responses and surfaces real error messages to the family (the hub is private behind Access; opaque "internal error" toasts cost debug time without buying anyone security).
- HTTP convenience: `json`, `jsonError`, `readJson`, `HttpError`.
- A preview-branch write guard so a buggy non-main preview can't corrupt prod data.
- A standardized "what version is running?" data structure for the admin-visible version display every Falkizar app ships per [app-baseline.md](https://github.com/Falkizar/web-hub/blob/main/docs/app-baseline.md).
- A `renderVersionFooterHtml(version)` server-side renderer + a `renderHubBackLinkHtml()` for the "← Falkizar" affordance every non-hub app surfaces.
- A `/client` subpath with `upgradeAdminFromMe()` for progressive admin-view toggling via `/api/me`.

Rather than copy these between repos (and drift), they live here.

The consumer apps are private (`web-hub`, `kids-library`, `budget-categorizer` all live under the Falkizar GitHub org), so README links to their source 404 for non-org viewers — that's expected. Apps the org operates are intentionally internal; this package is public only so Cloudflare Pages build runners can `npm install` it without GitHub PAT plumbing.

## Install

```bash
npm install github:Falkizar/pages-utils#v1.2.2
```

Pin to a tag, never to `main`. See [CHANGELOG.md](./CHANGELOG.md) for what's in each tag.

## Surfaces

### HTTP helpers

```ts
import { handler, json, jsonError, readJson, HttpError } from '@falkizar/pages-utils';

interface Body { name: string }

export const onRequestPost = handler(async (ctx) => {
  const body = await readJson<Body>(ctx.request);
  if (!body.name) throw new HttpError('name required', 400);
  // ... do work
  return json({ ok: true });
});
```

`handler()` catches:
- `HttpError` → JSON response with that status + message
- Any other throw → JSON 500 with the actual (truncated to 300 chars) error message, plus a `console.error` for `wrangler pages deployment tail`

### Branch guard

```ts
import { handler, guardPreviewWrites, type AnyContext } from '@falkizar/pages-utils';

export const onRequestPost = handler(async (ctx) => {
  guardPreviewWrites(ctx);   // 403s on non-main preview deploys
  // ... mutate D1/R2/KV
});
```

The guard is method-aware: GETs/HEAD/OPTIONS pass through on any branch.

### Version metadata

The canonical admin-visible "what's deployed?" display uses these types + helpers. The build-time generator (next section) writes a typed payload to `_version-generated.ts` at build time; the runtime side then imports it and renders it with these pure helpers.

```ts
import {
  type AppVersion,
  relativeTime,
  commitUrl,
  dependencyUrl,
} from '@falkizar/pages-utils';
import { APP_VERSION } from './_version-generated';

const builtAt = relativeTime(APP_VERSION.commitTime);
const url = commitUrl(APP_VERSION, isAdmin);  // null for non-admins; admins get a GitHub link
const access = APP_VERSION.dependencies.find((d) => d.name === '@falkizar/access-middleware');
const accessUrl = access ? dependencyUrl(access, isAdmin) : null;
```

`AppVersion.dependencies` is intentionally part of the standard payload — every Falkizar app surfaces both its own SHA AND the SHAs of the `@falkizar/*` packages it depends on. The admin gets a one-click supply-chain audit from any Settings tab.

### Build-time generator (Node-only)

Called from each app's `astro.config.ts`. Generates `_version-generated.ts` with the app's commit SHA + tracked `@falkizar/*` package versions.

```ts
// astro.config.ts
import { defineConfig } from 'astro/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVersionModule } from '@falkizar/pages-utils/build';

const __dirname = dirname(fileURLToPath(import.meta.url));

generateVersionModule({
  repoUrl: 'https://github.com/Falkizar/my-app',
  outPath: resolve(__dirname, 'src/_version-generated.ts'),
  packageLockPath: resolve(__dirname, 'package-lock.json'),
});

export default defineConfig({ site: 'https://my-app.falkizar.com' });
```

The `/build` subpath is intentionally separate so the Node-only helper can never leak into runtime bundles. Add `src/_version-generated.ts` to `.gitignore` — every build regenerates it.

### Version footer + hub back-link (v1.2.x)

`renderVersionFooterHtml(version, opts?)` is the canonical "what's deployed?" footer every Falkizar app renders. Default mode emits a dual-span layout that a `body.is-admin` CSS toggle (set via `upgradeAdminFromMe` from `/client`) flips between non-admin plain text and admin clickable GitHub commit links. Pages-Function callers that already know `isAdmin` pass `{ isAdmin: true | false }` to skip the dual-render.

`renderHubBackLinkHtml(opts?)` emits the "← Falkizar" anchor that every non-hub app surfaces top-of-body, plus the spacer that reserves vertical space. Both elements come back in one HTML fragment.

```astro
---
import {
  renderVersionFooterHtml, VERSION_FOOTER_CSS,
  renderHubBackLinkHtml, HUB_BACK_LINK_CSS,
} from '@falkizar/pages-utils';
import { APP_VERSION } from '../scripts/_version-generated';

const versionFooterHtml = renderVersionFooterHtml(APP_VERSION);
const hubBackHtml = renderHubBackLinkHtml();
---
<html>
  <head>
    <style set:html={HUB_BACK_LINK_CSS + VERSION_FOOTER_CSS}></style>
    {/* other head stuff */}
  </head>
  <body>
    <Fragment set:html={hubBackHtml} />   {/* chip + spacer; spacer pushes content down */}
    <slot />
    <Fragment set:html={versionFooterHtml} />
    <script>
      import { upgradeAdminFromMe } from '@falkizar/pages-utils/client';
      upgradeAdminFromMe();
    </script>
  </body>
</html>
```

### Client-side admin upgrade (`/client` subpath)

```ts
import { upgradeAdminFromMe } from '@falkizar/pages-utils/client';

upgradeAdminFromMe();                                    // default: GET /api/me, set body.is-admin
upgradeAdminFromMe({ endpoint: '/api/whoami' });         // custom endpoint
upgradeAdminFromMe({ isAdmin: (j) => j.role === 'owner' }); // custom predicate
```

Fire-and-forget. Failures (no `/api/me`, network down, malformed JSON) are silently swallowed; the page keeps the non-admin view as the safe fallback.

## Type extension pattern

For apps using both packages:

```ts
import type { AccessEnv } from '@falkizar/access-middleware';
import type { BranchGuardEnv } from '@falkizar/pages-utils';

interface Env extends AccessEnv, BranchGuardEnv {
  DB: D1Database;
  // ... app-specific
}
```

`BranchGuardEnv` is intentionally narrow (just `CF_PAGES_BRANCH?: string`) so it composes cleanly.

## Releasing

This repo follows the org-wide [repo-norms](https://github.com/Falkizar/web-hub/blob/main/docs/repo-norms.md) workflow. Releases are PR-then-tag:

1. Open the release PR from a worktree on `release/vX.Y.Z`:
   - Bump `version` in `package.json`
   - Update `CHANGELOG.md` with the new section
   - Update README install snippet if pinning
2. CI (`.github/workflows/ci.yml`) must go green. The main-branch ruleset blocks merge until the `test` check passes on the synced HEAD.
3. Merge via squash.
4. **From your main checkout**, tag the merged commit and push:
   ```bash
   git fetch origin
   git checkout main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z — <one-line summary>"
   git push origin vX.Y.Z
   ```
5. The tag ruleset (`refs/tags/v*`, ruleset id `17407830`) blocks deletion and force-update. Once pushed, that SHA is permanent. Consumer pins can trust it.
6. Update consumer apps via follow-on PRs.

Semver:
- **Patch** (`1.2.0 → 1.2.1`): bug fix, no API change
- **Minor** (`1.2.0 → 1.3.0`): additive API change, no breaks
- **Major** (`1.2.0 → 2.0.0`): breaking change. Bump consumers ahead of time and have a migration note in the PR body.

## See also

- [`@falkizar/access-middleware`](https://github.com/Falkizar/access-middleware) — JWT-verifying Pages middleware + per-group authorization helpers
- [`Falkizar/web-hub/docs/app-baseline.md`](https://github.com/Falkizar/web-hub/blob/main/docs/app-baseline.md) — the mandatory baselines this package supports
- [`CHANGELOG.md`](./CHANGELOG.md) — what's in each tagged release
- [`Falkizar/web-hub/docs/repo-norms.md`](https://github.com/Falkizar/web-hub/blob/main/docs/repo-norms.md) — branch protection, CI, release flow this repo follows

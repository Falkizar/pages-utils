# @falkizar/pages-utils

Generic Cloudflare Pages Functions utilities for Falkizar apps. Sibling package to [`@falkizar/access-middleware`](https://github.com/Falkizar/access-middleware) — that package owns the auth chain; this one owns everything else that's reusable across apps.

## Why this exists

Two Falkizar apps (`kids-library` and `web-hub`) both needed the same handful of helpers:

- A `handler()` wrapper for `/api/*` endpoints that turns thrown HttpErrors into JSON responses and surfaces real error messages to the family (the hub is private behind Access; opaque "internal error" toasts cost debug time without buying anyone security).
- HTTP convenience: `json`, `jsonError`, `readJson`, `HttpError`.
- A preview-branch write guard so a buggy non-main preview can't corrupt prod data.
- A standardized "what version is running?" data structure for the admin-visible version display every Falkizar app ships per [app-baseline.md](https://github.com/Falkizar/web-hub/blob/main/docs/app-baseline.md).

Rather than copy these between repos (and drift), they live here.

## Install

```bash
npm install github:Falkizar/pages-utils#v1.0.0
```

Pin to a tag, never to `main`.

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

```bash
npm test
git commit -am "..."
npm version <major|minor|patch>
git push --follow-tags
```

Consumers update their `package.json` to the new tag explicitly.

## See also

- [`@falkizar/access-middleware`](https://github.com/Falkizar/access-middleware) — JWT-verifying Pages middleware + per-group authorization helpers
- [`Falkizar/web-hub/docs/app-baseline.md`](https://github.com/Falkizar/web-hub/blob/main/docs/app-baseline.md) — the mandatory baselines this package supports

/**
 * Preview-branch write guard.
 *
 * Cloudflare Pages auto-deploys preview branches at
 * <branch>.<project>.pages.dev. They bind to the same D1/R2/KV as
 * production by default (see web-hub/docs/data-storage.md), so a
 * mutating endpoint hit on a preview deploy would write to prod data.
 * Every mutating endpoint should call `guardPreviewWrites(ctx)` early,
 * before any state change.
 *
 * Apps that want a specific non-main branch to be treated as "live"
 * (e.g., active migration branch) can extend the allowlist in their
 * own wrapper or override CF_PAGES_BRANCH in TF for that branch.
 */

import { HttpError } from './http';

/** Minimum Env shape this needs: just CF_PAGES_BRANCH. Cloudflare auto-injects. */
export interface BranchGuardEnv {
  CF_PAGES_BRANCH?: string;
}

export interface BranchGuardCtx {
  request: Request;
  env: BranchGuardEnv;
}

/**
 * Throws HttpError(403) if the request is a write method on a branch
 * other than `main`. Safe to call on every handler entry — does
 * nothing on read methods (GET/HEAD/OPTIONS).
 */
export function guardPreviewWrites(ctx: BranchGuardCtx): void {
  const method = ctx.request.method.toUpperCase();
  const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  if (!isWrite) return;
  const branch = ctx.env.CF_PAGES_BRANCH;
  if (branch && branch !== 'main') {
    throw new HttpError('preview branch: writes disabled', 403);
  }
}

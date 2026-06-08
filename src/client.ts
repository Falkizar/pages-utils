/**
 * Browser-runtime helpers. Use the `/client` subpath so this never gets
 * pulled into a Pages Function bundle:
 *
 *   import { upgradeAdminFromMe } from '@falkizar/pages-utils/client';
 *
 * These rely on `document` / `fetch` / `window` and would crash in a
 * Worker context.
 */

export interface UpgradeAdminOptions {
  /**
   * Endpoint to fetch. Must return JSON `{ admin: boolean }` (or
   * anything where `.admin` is truthy). Defaults to `/api/me`, which
   * matches the canonical Falkizar `/api/me` shape.
   */
  endpoint?: string;
  /**
   * Class name added to `<body>` when the caller is admin. Defaults to
   * `is-admin`. The `version-footer.css` rules key off this name.
   */
  className?: string;
  /**
   * Custom predicate. By default, treat the response as admin if the
   * parsed JSON has a truthy `admin` field.
   */
  isAdmin?: (json: unknown) => boolean;
  /**
   * AbortSignal for cancellation (e.g. SPA navigation away from the
   * page while the fetch is in flight).
   */
  signal?: AbortSignal;
}

/**
 * Hit `/api/me`, and if the caller is admin, add `is-admin` to `<body>`.
 *
 * Safe to call multiple times — the class is set, not toggled. Safe to
 * call on pages without an /api/me endpoint — failures are swallowed
 * (admin upgrade is a progressive enhancement; non-admin view is fine).
 *
 * Returns the final admin status (true/false), useful for callers that
 * want to chain other progressive-enhancement steps.
 */
export async function upgradeAdminFromMe(
  opts: UpgradeAdminOptions = {},
): Promise<boolean> {
  const endpoint = opts.endpoint ?? '/api/me';
  const className = opts.className ?? 'is-admin';
  const predicate = opts.isAdmin ?? defaultPredicate;

  try {
    const res = await fetch(endpoint, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal: opts.signal,
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (predicate(json)) {
      document.body.classList.add(className);
      return true;
    }
    return false;
  } catch {
    // /api/me missing, network down, JSON malformed — non-admin path is
    // the safe fallback. Don't surface anything to the user.
    return false;
  }
}

function defaultPredicate(json: unknown): boolean {
  return !!(json && typeof json === 'object' && (json as Record<string, unknown>).admin);
}

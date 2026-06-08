/**
 * HTTP response + error helpers for Pages Functions.
 *
 * Every `/api/*` handler in a Falkizar app should be wrapped with
 * `handler()` so thrown HttpErrors become structured JSON 4xx/5xx
 * responses and uncaught errors become JSON 500s with the actual
 * (truncated) error message — diagnostic value at family scale
 * outweighs the info-disclosure concern. If a specific endpoint
 * needs sensitive-error scrubbing, throw HttpError(sanitized, 500)
 * before the wrapper sees it.
 */

/** EventContext shape this module needs. Pages Functions
 *  `EventContext<Env, ...>` satisfies it structurally. */
export interface AnyContext {
  request: Request;
}

/**
 * Build a JSON response with sensible defaults: content-type set,
 * caching disabled (per-user data should never be cached at the
 * intermediary layer).
 */
export function json<T>(body: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

/** Shorthand for `json({ error: message }, { status })`. */
export function jsonError(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

/**
 * Parse a JSON request body or throw HttpError(415) if the content-type
 * isn't JSON, HttpError(400) if the body is malformed.
 */
export async function readJson<T>(request: Request): Promise<T> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new HttpError('expected application/json', 415);
  }
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError('invalid json body', 400);
  }
}

/**
 * Throw to short-circuit a handler with a specific HTTP status.
 * `handler()` catches and converts to jsonError.
 */
export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Wrap a handler so thrown HttpErrors become jsonErrors and uncaught
 * errors become JSON 500s with the actual (truncated) error message.
 *
 * Falkizar policy: surface real error text in 500 bodies. The whole
 * hub is private-family-only behind Cloudflare Access, so info-
 * disclosure to anonymous attackers isn't a concern, but having
 * "OpenLibrary timeout" instead of "internal error" in the toast is
 * the difference between debugging from a phone and not.
 *
 * If a specific endpoint genuinely needs sensitive-error scrubbing,
 * catch + rethrow as HttpError(sanitized, 500) BEFORE this wrapper
 * sees it.
 */
export function handler<Ctx extends AnyContext>(
  fn: (ctx: Ctx) => Promise<Response>,
): (ctx: Ctx) => Promise<Response> {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError) return jsonError(e.message, e.status);
      const raw = e instanceof Error ? e.message : String(e);
      // Truncate so a runaway stack doesn't blow up the response body.
      const msg = raw.length > 300 ? raw.slice(0, 300) + '…' : raw;
      // Log to Cloudflare's per-request log so it's visible in
      // `wrangler pages deployment tail`.
      console.error('api handler error:', msg, e);
      return jsonError(msg || 'internal error', 500);
    }
  };
}

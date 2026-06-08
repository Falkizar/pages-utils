/**
 * "← Falkizar" back-to-hub link.
 *
 * Every Falkizar app (other than the hub itself) renders this anchor
 * top-left of the body so a family member who landed deep in an app
 * can always get home in one click. Centralized here so the hub URL
 * change is a one-line edit when (if ever) it moves.
 *
 * Drop into `body` at the top of the layout, then style via the CSS
 * snippet `HUB_BACK_LINK_CSS` (or copy/customize per app).
 */

const HUB_URL = 'https://falkizar.com';

export interface RenderHubBackLinkOptions {
  /**
   * Override the hub URL. Useful for previews. Defaults to
   * https://falkizar.com.
   */
  hubUrl?: string;
  /**
   * Display label. Defaults to "← Falkizar". Override if an app wants a
   * different brand voice ("← Home", "↑ Hub"), but consistency across
   * apps beats per-app cleverness — change only with a good reason.
   */
  label?: string;
  /**
   * If true, render a `rel="noopener"` and no `target="_blank"`. Default
   * is to navigate in the same tab — the hub IS the rest of the site, so
   * opening a new tab adds friction without value.
   */
  newTab?: boolean;
}

/**
 * Render the back-to-hub anchor PLUS a sibling `<div class="hub-back-spacer">`
 * that reserves vertical space for the fixed-positioned chip.
 *
 * The spacer is a normal-flow element. Whatever comes after it in the
 * body gets naturally pushed down by its height. That side-steps the
 * fragility of body-level padding rules: consumer stylesheets that
 * reset body padding (e.g. `html, body { padding: 0; }`) can't undo
 * the spacer's height because there's no padding to reset.
 *
 * Place the rendered fragment as the FIRST child of body so the spacer
 * pushes the rest of the page down rather than something else.
 *
 * URL safety: `opts.hubUrl` is run through `isSafeHubUrl()` before it
 * lands in the rendered `href`. Unsafe schemes (`javascript:`, `data:`,
 * `vbscript:`, anything not `http:` / `https:` / a relative path) are
 * silently replaced with the default `https://falkizar.com`. That
 * defense is hypothetical today — every current caller passes the
 * literal default — but the option is part of the public API of a
 * shared package, and any future caller that ever wires this to
 * dynamic input gets a free guardrail. Flagged in the 2026-06-08
 * security review as Info I1; closed in v1.2.3.
 */
export function renderHubBackLinkHtml(opts: RenderHubBackLinkOptions = {}): string {
  const requested = opts.hubUrl ?? HUB_URL;
  const url = isSafeHubUrl(requested) ? requested : HUB_URL;
  const label = opts.label ?? '← Falkizar';
  const target = opts.newTab ? ' target="_blank" rel="noopener"' : '';
  return `<a class="hub-back" href="${escapeAttr(url)}"${target}>${escapeHtml(label)}</a><div class="hub-back-spacer" aria-hidden="true"></div>`;
}

/**
 * Accept only schemes that can't trigger script execution from an anchor click.
 *
 * Returns true for:
 *   - Absolute `https://...` URLs
 *   - Absolute `http://...` URLs (mostly for local dev / tests)
 *   - Relative URLs starting with `/` or `#` or `./` or `../`
 *
 * Returns false for everything else, including:
 *   - `javascript:` / `vbscript:` (XSS via clickable link)
 *   - `data:` (can be SVG with script, or text/html)
 *   - `file:` / `chrome:` / unknown schemes (no use case + defense in depth)
 *   - Inputs that fail to parse as a URL
 *
 * Exported for tests; consumers normally don't call this directly.
 */
export function isSafeHubUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  // Relative URLs (same-document anchor, root path, etc.) are always fine —
  // they can't carry a scheme.
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#') ||
      trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true;
  }
  try {
    // Parse against a dummy base so URL accepts protocol-relative URLs too
    // (`//host/path` — still safe; scheme inherits from page, which is https
    // in our deployment).
    const parsed = new URL(trimmed, 'https://falkizar.com');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * The minimum CSS the back-link needs. The chip is fixed top-left so it
 * stays accessible from anywhere in the app — including deep in a
 * scrolled view. A sibling spacer (`.hub-back-spacer`) in normal flow
 * reserves vertical space so the chip never overlays app content.
 *
 * Why the spacer approach instead of `body { padding-top: ... }`:
 * v1.2.1 set body padding-top inside this constant. That worked on apps
 * whose styles didn't otherwise touch body padding (web-hub, budget),
 * but kids-library has `html, body { padding: 0; }` in its app.css —
 * a shorthand reset that zeros all four sides. Because Astro emits the
 * linked stylesheet AFTER the inline <style set:html={...}> block,
 * the consumer's reset always won the cascade and the chip overlaid
 * the app title.
 *
 * Using a sibling element in flow eliminates the cascade dependency
 * entirely: there's no body padding to reset. The chip floats fixed
 * on top; the spacer takes height in flow. Both are owned by this
 * constant + this renderer, so consumer CSS can't accidentally
 * defeat them.
 *
 * Mobile uses env(safe-area-inset-top) so the chip clears the iPhone
 * notch / dynamic island when the app is launched as an installed PWA.
 */
export const HUB_BACK_LINK_CSS = `.hub-back-spacer {
  display: block;
  width: 100%;
  height: calc(2.75rem + env(safe-area-inset-top, 0px));
  pointer-events: none;
}
.hub-back {
  position: fixed;
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  z-index: 100;
  display: inline-block;
  padding: 0.25rem 0.625rem;
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  color: inherit;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  opacity: 0.85;
  transition: opacity 0.15s;
}
.hub-back:hover { opacity: 1; }
@media (prefers-color-scheme: dark) {
  .hub-back {
    background: rgba(24, 24, 27, 0.85);
    border-color: rgba(255, 255, 255, 0.12);
  }
}
@media (max-width: 600px) {
  .hub-back-spacer { height: calc(2.5rem + env(safe-area-inset-top, 0px)); }
}
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

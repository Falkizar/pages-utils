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
 * Render the back-to-hub anchor. Top-of-body placement assumed.
 */
export function renderHubBackLinkHtml(opts: RenderHubBackLinkOptions = {}): string {
  const url = opts.hubUrl ?? HUB_URL;
  const label = opts.label ?? '← Falkizar';
  const target = opts.newTab ? ' target="_blank" rel="noopener"' : '';
  return `<a class="hub-back" href="${escapeAttr(url)}"${target}>${escapeHtml(label)}</a>`;
}

/**
 * The minimum CSS the back-link needs. Floats top-left, small, low-
 * contrast. Apps that want a different look can override these rules
 * (later cascade wins) or drop this entirely.
 */
export const HUB_BACK_LINK_CSS = `.hub-back {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 100;
  display: inline-block;
  padding: 0.25rem 0.625rem;
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  color: inherit;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.hub-back:hover { opacity: 1; }
@media (prefers-color-scheme: dark) {
  .hub-back {
    background: rgba(24, 24, 27, 0.7);
    border-color: rgba(255, 255, 255, 0.12);
  }
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

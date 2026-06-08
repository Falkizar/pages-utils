/**
 * Canonical version-footer renderer.
 *
 * This is the cross-app standard for the deployed-version display every
 * Falkizar app shows. It supersedes the per-app patterns three apps had
 * before v1.2.0:
 *
 *   - kids-library: client-side imperative DOM render, /api/me round-trip,
 *     visible flicker before paint.
 *   - web-hub: server-side render inside the Pages Function, no client
 *     upgrade (worked only because web-hub IS one big Pages Function).
 *   - budget: server-side render at Astro build time, no admin link
 *     affordance (no identity context at build).
 *
 * The unified pattern, picking the strengths of all three:
 *
 *   1. **Render at build time** (Astro static build, no flicker). The
 *      HTML contains BOTH the plain-text SHA (visible to non-admins)
 *      AND a GitHub commit link (admin-only). Hidden via CSS based on
 *      a `body.is-admin` class.
 *   2. **Upgrade to admin progressively** on the client by calling
 *      `upgradeAdminFromMe()` (from `@falkizar/pages-utils/client`).
 *      One /api/me round-trip, runs after first paint, no blocking.
 *   3. **For Pages Functions that render the page themselves**
 *      (web-hub), pass `isAdmin: true|false` directly so the body class
 *      is in the HTML from byte 0. No upgrade step needed.
 *
 * Why both spans in the HTML rather than one or the other: the
 * commit URL itself isn't sensitive — even if a non-admin finds it via
 * devtools, clicking it just lands on a private-repo GitHub 404. That's
 * the same UX hit the admin-gate is designed to prevent at click time.
 * Two spans + one CSS rule beats a /api/me round-trip that blocks the
 * footer paint.
 */

import {
  relativeTime,
  commitUrl,
  dependencyUrl,
  type AppVersion,
} from './version';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface RenderVersionFooterOptions {
  /**
   * If known at render time, set the admin flag directly. Use for Pages
   * Functions that have the verified JWT groups in hand. When unset, the
   * server-rendered HTML defaults to non-admin and the client-side
   * `upgradeAdminFromMe` helper flips the body class after first paint.
   */
  isAdmin?: boolean;
}

/**
 * Render the deployed-version `<footer>`.
 *
 * Output structure:
 *
 *   <footer class="version">
 *     <span class="version__commit">
 *       <span class="non-admin-only">abc1234</span>
 *       <a class="admin-only" href="https://github.com/.../commit/abc..." target="_blank" rel="noopener">abc1234</a>
 *     </span>
 *     · <span title="..">committed 3h ago</span>
 *     · <span title="..">deployed just now</span>
 *     [optional branch suffix]
 *     <div class="version__deps">deps: ...</div>
 *   </footer>
 *
 * Pair with the `version-footer.css` snippet (or copy its rules — see
 * docs/app-baseline.md). The body needs a `.is-admin` class to surface
 * the admin links. Set it server-side from the JWT, or client-side via
 * `upgradeAdminFromMe()`.
 */
export function renderVersionFooterHtml(
  v: AppVersion,
  opts: RenderVersionFooterOptions = {},
): string {
  const knownAdmin = opts.isAdmin === true;
  const knownNonAdmin = opts.isAdmin === false;

  // Default render: both spans present, CSS controls visibility. If the
  // caller passed isAdmin explicitly, we suppress the unused span so the
  // HTML reads cleanly (and there's no admin URL in the response body
  // for known non-admins, addressing the "URL leak via devtools" nit).
  const url = commitUrl(v, true);   // build the URL once; gate below
  const commitInner = buildCommitInner(v, url, knownAdmin, knownNonAdmin);

  const commitRel = relativeTime(v.commitTime);
  const buildRel = relativeTime(v.buildTime);
  const commitTitle = v.commitTime ? `commit ${v.commitFull}\n${v.commitTime}` : `commit ${v.commitFull}`;
  const buildTitle = `built ${v.buildTime}`;
  const branchSuffix = v.branch && v.branch !== 'main' && v.branch !== 'unknown'
    ? ` <span class="version__branch">(${escapeHtml(v.branch)})</span>`
    : '';

  const depsLine = v.dependencies.length === 0 ? '' : renderDepsLine(v.dependencies, knownAdmin, knownNonAdmin);

  return `<footer class="version">
      <span class="version__commit" title="${escapeAttr(commitTitle)}">${commitInner}</span>
      · <span title="${escapeAttr(commitTitle)}">committed ${escapeHtml(commitRel)}</span>
      · <span title="${escapeAttr(buildTitle)}">deployed ${escapeHtml(buildRel)}</span>${branchSuffix}
      ${depsLine}
    </footer>`;
}

function buildCommitInner(
  v: AppVersion,
  url: string | null,
  knownAdmin: boolean,
  knownNonAdmin: boolean,
): string {
  const sha = escapeHtml(v.commit);
  const linkAvailable = url != null;
  if (knownAdmin && linkAvailable) {
    return `<a href="${escapeAttr(url!)}" target="_blank" rel="noopener">${sha}</a>`;
  }
  if (knownNonAdmin || !linkAvailable) {
    return sha;
  }
  // Unknown admin state at render time → emit BOTH spans, CSS toggles.
  return `<span class="non-admin-only">${sha}</span><a class="admin-only" href="${escapeAttr(url!)}" target="_blank" rel="noopener">${sha}</a>`;
}

function renderDepsLine(
  deps: AppVersion['dependencies'],
  knownAdmin: boolean,
  knownNonAdmin: boolean,
): string {
  const items = deps.map((d) => {
    const dUrl = dependencyUrl(d, true);
    const label = `${d.name.replace(/^@falkizar\//, '')} ${d.version}${d.commit ? ` @ ${d.commit}` : ''}`;
    const title = d.commitFull ? `${d.name} ${d.version}\n${d.commitFull}` : `${d.name} ${d.version}`;
    const plain = escapeHtml(label);
    const linkAvailable = dUrl != null;
    let content: string;
    if (knownAdmin && linkAvailable) {
      content = `<a href="${escapeAttr(dUrl!)}" target="_blank" rel="noopener">${plain}</a>`;
    } else if (knownNonAdmin || !linkAvailable) {
      content = plain;
    } else {
      content = `<span class="non-admin-only">${plain}</span><a class="admin-only" href="${escapeAttr(dUrl!)}" target="_blank" rel="noopener">${plain}</a>`;
    }
    return `<span title="${escapeAttr(title)}">${content}</span>`;
  });
  return `<div class="version__deps">deps: ${items.join(' · ')}</div>`;
}

/**
 * The minimum CSS the version footer needs. Apps can drop this verbatim
 * into their stylesheet or use it as a starting point to skin further.
 * Importing this constant from `@falkizar/pages-utils` keeps the rules
 * versioned alongside the renderer they support.
 */
export const VERSION_FOOTER_CSS = `.version {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 0 1.5rem 1rem;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem;
  opacity: 0.7;
  line-height: 1.6;
}
.version a { color: inherit; text-decoration: underline; }
.version__branch { opacity: 0.7; }
.version__deps { margin-top: 0.25rem; opacity: 0.9; }
.version .admin-only { display: none; }
body.is-admin .version .admin-only { display: inline; }
body.is-admin .version .non-admin-only { display: none; }
`;

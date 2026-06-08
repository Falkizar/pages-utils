/**
 * Build-time version metadata for Falkizar Pages apps.
 *
 * Every app surfaces its own commit SHA, commit time, and a GitHub
 * commit link to admins (per docs/app-baseline.md). Apps that pin
 * `@falkizar/access-middleware` or `@falkizar/pages-utils` also
 * surface those package versions + commits so a deploy-time supply-
 * chain audit is one Settings-tab click away.
 *
 * The data structures + pure helpers live here. Apps generate the
 * runtime payload at build time in `astro.config.ts` (see the doc
 * for the canonical implementation) and render it through a small
 * Astro component / Pages-Function template — pure HTML, no client
 * framework required.
 */

/** Per-package supply-chain entry. Resolved at build time from
 *  package-lock.json's `resolved` URL for github: deps. */
export interface DependencyVersion {
  /** e.g. "@falkizar/access-middleware" */
  name: string;
  /** semver from the package's package.json */
  version: string;
  /**
   * 7-char SHA of the resolved git ref, if the dep came from a github
   * source. Empty for registry-only deps where we don't track per-commit
   * provenance.
   */
  commit?: string;
  /**
   * Full 40-char SHA. Used for the GitHub commit link.
   */
  commitFull?: string;
  /**
   * Repo URL — used to construct the GitHub commit link in
   * `dependencyUrl(...)`.
   */
  repoUrl?: string;
}

/** App-level version payload. Generated at build time by astro.config.ts. */
export interface AppVersion {
  /** 7-char SHA, or "dev" if the build ran without a SHA source. */
  commit: string;
  /** Full 40-char SHA, or "dev". */
  commitFull: string;
  /** ISO 8601 from `git show -s --format=%cI`, or null if unavailable. */
  commitTime: string | null;
  /** ISO 8601 stamped at build time. */
  buildTime: string;
  /** Branch name. "unknown" if not resolvable. */
  branch: string;
  /** Repo URL, e.g. "https://github.com/Falkizar/my-app". */
  repoUrl: string;
  /**
   * Pinned Falkizar packages this build depends on. Read from
   * package-lock.json at build time. Empty array if the app doesn't
   * use any @falkizar packages (rare — at minimum every app pins
   * @falkizar/access-middleware).
   */
  dependencies: DependencyVersion[];
}

/**
 * Renders an ISO timestamp as a short human-readable relative time.
 * Buckets: "just now" (<60s), "Nm ago" (<60m), "Nh ago" (<24h),
 * "Nd ago" (<30d), then absolute date.
 */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'unknown';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'unknown';
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Returns the GitHub commit URL for the app's own commit, or null.
 *
 * Null is the right answer when:
 *   - The caller isn't an admin. Repos are private; non-admin click → 404.
 *   - The build had no SHA (dev sentinel).
 *
 * Rendering rule: if this returns a string, wrap the displayed SHA in
 * an anchor. If it returns null, render plain text.
 */
export function commitUrl(version: AppVersion, isAdmin: boolean): string | null {
  if (!isAdmin) return null;
  if (!version.commitFull || version.commitFull === 'dev') return null;
  return `${trimTrailingSlash(version.repoUrl)}/commit/${version.commitFull}`;
}

/**
 * Returns the GitHub commit URL for a specific dependency at its
 * pinned SHA, or null on the same conditions as `commitUrl`.
 */
export function dependencyUrl(dep: DependencyVersion, isAdmin: boolean): string | null {
  if (!isAdmin) return null;
  if (!dep.commitFull || !dep.repoUrl) return null;
  return `${trimTrailingSlash(dep.repoUrl)}/commit/${dep.commitFull}`;
}

function trimTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

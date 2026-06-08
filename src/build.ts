/**
 * Build-time version generation for Falkizar apps.
 *
 * Designed to be called from each app's `astro.config.ts` so the
 * deployed-version display shown to admins is fully resolved at
 * build time (no API round-trip, no runtime git calls).
 *
 * Imports node:* — DO NOT import this from runtime code (Pages
 * Functions, Astro client scripts). It's gated behind the `/build`
 * subpath to make accidental misuse obvious:
 *
 *   import { generateVersionModule } from '@falkizar/pages-utils/build';
 *
 * `astro.config.ts` calls `generateVersionModule({ repoUrl, outPath, packageLockPath })`
 * before the `defineConfig` call. The function:
 *
 *   1. Resolves the app's own commit SHA + branch + commit time
 *      (CF_PAGES_COMMIT_SHA / CF_PAGES_BRANCH first, git CLI fallback).
 *   2. Reads package-lock.json and finds every `@falkizar/*` dep,
 *      extracting its semver + resolved git commit SHA.
 *   3. Writes a typed `_version-generated.ts` module that imports
 *      `AppVersion` from `@falkizar/pages-utils`.
 *   4. Returns the AppVersion so the caller can log it.
 *
 * The generated module is .gitignore'd; consumers regenerate on every
 * build.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AppVersion, DependencyVersion } from './version';

export interface GenerateVersionOptions {
  /** e.g. "https://github.com/Falkizar/web-hub" — must not include trailing slash. */
  repoUrl: string;
  /** Absolute path. Where to write `_version-generated.ts`. */
  outPath: string;
  /**
   * Absolute path to the consumer's package-lock.json. If omitted or
   * missing, dependency tracking is skipped and `dependencies: []`.
   */
  packageLockPath?: string;
  /**
   * Dep-name prefix to track. Defaults to "@falkizar/". Any package
   * whose name starts with this gets pulled into `dependencies`.
   */
  trackPrefix?: string;
  /**
   * Override the now-clock for deterministic builds in tests. Production
   * use should omit.
   */
  now?: Date;
}

export function generateVersionModule(opts: GenerateVersionOptions): AppVersion {
  const trackPrefix = opts.trackPrefix ?? '@falkizar/';
  const repoUrl = trimTrailingSlash(opts.repoUrl);
  const own = resolveOwnVersion(opts.now);
  const dependencies = opts.packageLockPath && existsSync(opts.packageLockPath)
    ? resolveDependencies(opts.packageLockPath, trackPrefix)
    : [];

  const version: AppVersion = {
    commit: own.commit,
    commitFull: own.commitFull,
    commitTime: own.commitTime,
    buildTime: own.buildTime,
    branch: own.branch,
    repoUrl,
    dependencies,
  };

  mkdirSync(dirname(opts.outPath), { recursive: true });
  writeFileSync(
    opts.outPath,
    `// AUTO-GENERATED at build time by astro.config.ts. Do not edit.
// Regenerated on every \`astro build\` / \`astro dev\` invocation.
import type { AppVersion } from '@falkizar/pages-utils';
export const APP_VERSION: AppVersion = ${JSON.stringify(version, null, 2)};
`,
  );

  return version;
}

interface OwnVersion {
  commit: string;
  commitFull: string;
  commitTime: string | null;
  buildTime: string;
  branch: string;
}

function resolveOwnVersion(now?: Date): OwnVersion {
  const fromEnv = process.env.CF_PAGES_COMMIT_SHA || '';
  let commitFull = fromEnv;
  let commitTime: string | null = null;
  let branch = process.env.CF_PAGES_BRANCH || '';

  try {
    if (!commitFull) commitFull = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const t = execSync(`git show -s --format=%cI ${commitFull}`, { encoding: 'utf8' }).trim();
    commitTime = t || null;
    if (!branch) branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // Cloudflare Pages may strip .git after some build types. Env-var
    // path still gives us the SHA; we lose commit time. Don't crash.
  }

  return {
    commit: commitFull ? commitFull.slice(0, 7) : 'dev',
    commitFull: commitFull || 'dev',
    commitTime,
    buildTime: (now ?? new Date()).toISOString(),
    branch: branch || 'unknown',
  };
}

function resolveDependencies(
  packageLockPath: string,
  trackPrefix: string,
): DependencyVersion[] {
  let lock: any;
  try {
    lock = JSON.parse(readFileSync(packageLockPath, 'utf8'));
  } catch {
    return [];
  }

  const packages = lock.packages ?? {};
  const out: DependencyVersion[] = [];
  const seen = new Set<string>();

  for (const [key, entry] of Object.entries<any>(packages)) {
    if (!entry || typeof entry !== 'object') continue;
    // package-lock v3 keys are paths like "node_modules/@falkizar/xxx".
    // Extract the actual package name from `entry.name` if present, else parse the key.
    const name: string | undefined = entry.name ?? (key.startsWith('node_modules/')
      ? key.slice('node_modules/'.length).replace(/^.*\/(@[^/]+\/[^/]+|[^/]+)$/, '$1')
      : undefined);
    if (!name || !name.startsWith(trackPrefix)) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    const version: string = entry.version ?? 'unknown';
    const commitFull = extractCommitFromResolved(entry.resolved);
    const repoUrl = extractRepoUrl(entry.resolved);

    out.push({
      name,
      version,
      ...(commitFull ? { commit: commitFull.slice(0, 7), commitFull } : {}),
      ...(repoUrl ? { repoUrl } : {}),
    });
  }

  // Stable ordering across builds: alphabetical by name.
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Parse the trailing #<sha> off a package-lock `resolved` URL.
 * Returns null for any URL we don't recognize as a github commit ref.
 *
 * Examples we handle:
 *   git+ssh://git@github.com/Falkizar/access-middleware.git#2478d08...
 *   git+https://github.com/Falkizar/x.git#abc1234...
 *   https://github.com/.../tarball/...   (registry / tarball — returns null)
 */
function extractCommitFromResolved(resolved: unknown): string | null {
  if (typeof resolved !== 'string') return null;
  const m = resolved.match(/#([0-9a-f]{40})$/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Reconstruct an https://github.com/owner/repo URL from a package-lock
 * `resolved` git URL. Handles git+ssh and git+https forms. Returns null
 * for non-github sources.
 */
function extractRepoUrl(resolved: unknown): string | null {
  if (typeof resolved !== 'string') return null;
  // git+ssh://git@github.com/owner/repo.git#sha
  // git+https://github.com/owner/repo.git#sha
  // ssh://git@github.com/owner/repo.git#sha
  const m = resolved.match(/github\.com[/:]([^/]+)\/([^/.#]+)(?:\.git)?(?:#|$)/i);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

function trimTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

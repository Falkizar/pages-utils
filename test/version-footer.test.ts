/**
 * Tests for the canonical version-footer renderer.
 *
 * Three render modes to cover:
 *   - default (isAdmin unset): both spans present, CSS toggles
 *   - opts.isAdmin: true: admin span/anchor only, plain span suppressed
 *   - opts.isAdmin: false: plain text only, no URL in output (the
 *     "URL leak via devtools" mitigation when admin status is known)
 *
 * Plus: dep rendering, branch suffix, dev sentinel, HTML escaping.
 */

import { describe, it, expect } from 'vitest';
import {
  renderVersionFooterHtml,
  VERSION_FOOTER_CSS,
} from '../src/version-footer';
import type { AppVersion, DependencyVersion } from '../src/version';

function mkVersion(overrides: Partial<AppVersion> = {}): AppVersion {
  return {
    commit: 'abc1234',
    commitFull: 'abc1234567890abc1234567890abc1234567890a',
    commitTime: '2026-06-01T12:00:00Z',
    buildTime: '2026-06-01T12:05:00Z',
    branch: 'main',
    repoUrl: 'https://github.com/Falkizar/example',
    dependencies: [],
    ...overrides,
  };
}

function mkDep(overrides: Partial<DependencyVersion> = {}): DependencyVersion {
  return {
    name: '@falkizar/access-middleware',
    version: '1.0.0',
    commit: '2478d08',
    commitFull: '2478d08f6b397c709860d91215ce228641016f3e',
    repoUrl: 'https://github.com/Falkizar/access-middleware',
    ...overrides,
  };
}

describe('renderVersionFooterHtml — default mode (CSS-toggled)', () => {
  it('emits BOTH non-admin span AND admin anchor', () => {
    const html = renderVersionFooterHtml(mkVersion());
    expect(html).toContain('class="non-admin-only"');
    expect(html).toContain('class="admin-only"');
    expect(html).toContain('https://github.com/Falkizar/example/commit/abc1234567890abc1234567890abc1234567890a');
  });

  it('wraps each in the version__commit container with title attr', () => {
    const html = renderVersionFooterHtml(mkVersion());
    expect(html).toContain('class="version__commit"');
    expect(html).toMatch(/title="commit abc[0-9a-f]+/);
  });

  it('uses the dual-span pattern for each dep too', () => {
    const html = renderVersionFooterHtml(mkVersion({ dependencies: [mkDep()] }));
    // The dep label should appear under BOTH visibility classes:
    const nonAdminMatches = (html.match(/<span class="non-admin-only">access-middleware/g) ?? []);
    const adminMatches = (html.match(/<a class="admin-only"[^>]*>access-middleware/g) ?? []);
    expect(nonAdminMatches.length).toBe(1);
    expect(adminMatches.length).toBe(1);
  });
});

describe('renderVersionFooterHtml — isAdmin: true', () => {
  it('emits only the admin anchor for the commit', () => {
    const html = renderVersionFooterHtml(mkVersion(), { isAdmin: true });
    expect(html).not.toContain('class="non-admin-only"');
    expect(html).not.toContain('class="admin-only"');
    expect(html).toMatch(/<a [^>]*href="https:\/\/github\.com\/Falkizar\/example\/commit\/[a-f0-9]+/);
  });

  it('emits only the admin anchor for each dep', () => {
    const html = renderVersionFooterHtml(
      mkVersion({ dependencies: [mkDep()] }),
      { isAdmin: true },
    );
    expect(html).not.toContain('class="non-admin-only"');
    expect(html).not.toContain('class="admin-only"');
    expect(html).toMatch(/<a [^>]*href="[^"]*access-middleware\/commit/);
  });
});

describe('renderVersionFooterHtml — isAdmin: false', () => {
  it('emits NO commit URL anywhere (URL not in response body)', () => {
    const html = renderVersionFooterHtml(mkVersion(), { isAdmin: false });
    expect(html).not.toContain('/commit/');
    expect(html).not.toContain('class="admin-only"');
    expect(html).not.toContain('class="non-admin-only"');
    expect(html).toContain('abc1234');
  });

  it('emits NO dep URLs either', () => {
    const html = renderVersionFooterHtml(
      mkVersion({ dependencies: [mkDep()] }),
      { isAdmin: false },
    );
    expect(html).not.toContain('access-middleware/commit/');
    expect(html).toContain('access-middleware 1.0.0 @ 2478d08');
  });
});

describe('renderVersionFooterHtml — branch + dev sentinel', () => {
  it('shows (branch) suffix only for non-main, non-unknown branches', () => {
    expect(renderVersionFooterHtml(mkVersion({ branch: 'main' })))
      .not.toContain('version__branch');
    expect(renderVersionFooterHtml(mkVersion({ branch: 'unknown' })))
      .not.toContain('version__branch');
    const wip = renderVersionFooterHtml(mkVersion({ branch: 'feature/x' }));
    expect(wip).toContain('version__branch');
    expect(wip).toContain('feature/x');
  });

  it('treats dev sentinel as known non-admin: no URL emitted', () => {
    const html = renderVersionFooterHtml(
      mkVersion({ commit: 'dev', commitFull: 'dev', commitTime: null }),
    );
    expect(html).toContain('dev');
    expect(html).not.toContain('/commit/');
    expect(html).not.toContain('class="admin-only"');
  });

  it('treats dev sentinel as known non-admin even when isAdmin: true', () => {
    const html = renderVersionFooterHtml(
      mkVersion({ commit: 'dev', commitFull: 'dev', commitTime: null }),
      { isAdmin: true },
    );
    expect(html).not.toContain('/commit/');
    expect(html).toContain('dev');
  });
});

describe('renderVersionFooterHtml — deps shape', () => {
  it('omits deps line when no deps', () => {
    const html = renderVersionFooterHtml(mkVersion({ dependencies: [] }));
    expect(html).not.toContain('version__deps');
  });

  it('strips the @falkizar/ scope in display labels (kept in title tooltip)', () => {
    const html = renderVersionFooterHtml(mkVersion({ dependencies: [mkDep()] }));
    // Displayed label inside spans/anchors strips the scope.
    expect(html).toMatch(/>access-middleware 1\.0\.0/);
    // But the title attr keeps the full name for hover discoverability.
    expect(html).toMatch(/title="@falkizar\/access-middleware/);
  });

  it('handles a registry-tarball dep (no commit, no repoUrl)', () => {
    const html = renderVersionFooterHtml(
      mkVersion({ dependencies: [{ name: '@falkizar/tarball', version: '2.0.0' }] }),
      { isAdmin: true },
    );
    expect(html).toContain('tarball 2.0.0');
    expect(html).not.toMatch(/tarball 2\.0\.0 @/);
    expect(html).not.toMatch(/href="[^"]*tarball\/commit/);
  });
});

describe('renderVersionFooterHtml — escaping', () => {
  it('escapes HTML in branch name', () => {
    const html = renderVersionFooterHtml(
      mkVersion({ branch: 'feature/<script>alert(1)</script>' }),
    );
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('VERSION_FOOTER_CSS', () => {
  it('defines the body.is-admin toggle rule that the renderer expects', () => {
    expect(VERSION_FOOTER_CSS).toContain('body.is-admin .version .admin-only');
    expect(VERSION_FOOTER_CSS).toContain('body.is-admin .version .non-admin-only');
    expect(VERSION_FOOTER_CSS).toContain('.version .admin-only { display: none; }');
  });
});

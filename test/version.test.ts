import { describe, it, expect } from 'vitest';
import {
  relativeTime,
  commitUrl,
  dependencyUrl,
  type AppVersion,
  type DependencyVersion,
} from '../src/version';

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

describe('relativeTime', () => {
  const now = new Date('2026-06-07T12:00:00Z');

  it('returns "unknown" for null', () => {
    expect(relativeTime(null, now)).toBe('unknown');
  });

  it('returns "unknown" for malformed ISO', () => {
    expect(relativeTime('not a date', now)).toBe('unknown');
  });

  it('returns "just now" for under a minute', () => {
    expect(relativeTime('2026-06-07T11:59:30Z', now)).toBe('just now');
  });

  it('returns "just now" for tiny future drift', () => {
    expect(relativeTime('2026-06-07T12:00:30Z', now)).toBe('just now');
  });

  it('returns Nm ago for under an hour', () => {
    expect(relativeTime('2026-06-07T11:35:00Z', now)).toBe('25m ago');
  });

  it('returns Nh ago for under a day', () => {
    expect(relativeTime('2026-06-07T05:00:00Z', now)).toBe('7h ago');
  });

  it('returns Nd ago for under a month', () => {
    expect(relativeTime('2026-06-02T12:00:00Z', now)).toBe('5d ago');
  });

  it('returns an absolute date for older than 30 days', () => {
    const got = relativeTime('2026-04-01T12:00:00Z', now);
    expect(got).not.toMatch(/ago/);
    expect(got).toMatch(/2026/);
  });
});

describe('commitUrl', () => {
  it('returns null for non-admins', () => {
    expect(commitUrl(mkVersion(), false)).toBeNull();
  });

  it('returns null when commitFull is the dev sentinel', () => {
    expect(commitUrl(mkVersion({ commitFull: 'dev' }), true)).toBeNull();
  });

  it('returns null when commitFull is empty', () => {
    expect(commitUrl(mkVersion({ commitFull: '' }), true)).toBeNull();
  });

  it('builds a GitHub commit URL for admins on a real SHA', () => {
    expect(commitUrl(mkVersion(), true)).toBe(
      'https://github.com/Falkizar/example/commit/abc1234567890abc1234567890abc1234567890a',
    );
  });

  it('strips a trailing slash from repoUrl', () => {
    expect(commitUrl(mkVersion({ repoUrl: 'https://github.com/x/' }), true))
      .toBe('https://github.com/x/commit/abc1234567890abc1234567890abc1234567890a');
  });
});

describe('dependencyUrl', () => {
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

  it('returns null for non-admins', () => {
    expect(dependencyUrl(mkDep(), false)).toBeNull();
  });

  it('returns null when commitFull is missing', () => {
    expect(dependencyUrl(mkDep({ commitFull: undefined }), true)).toBeNull();
  });

  it('returns null when repoUrl is missing', () => {
    expect(dependencyUrl(mkDep({ repoUrl: undefined }), true)).toBeNull();
  });

  it('builds a GitHub commit URL for admins with complete data', () => {
    expect(dependencyUrl(mkDep(), true)).toBe(
      'https://github.com/Falkizar/access-middleware/commit/2478d08f6b397c709860d91215ce228641016f3e',
    );
  });
});

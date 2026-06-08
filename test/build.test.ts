import { describe, it, expect, beforeEach } from 'vitest';
import { generateVersionModule } from '../src/build';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function mkTmp(): string {
  return mkdtempSync(join(tmpdir(), 'pages-utils-test-'));
}

describe('generateVersionModule', () => {
  beforeEach(() => {
    delete process.env.CF_PAGES_COMMIT_SHA;
    delete process.env.CF_PAGES_BRANCH;
  });

  it('writes a _version-generated.ts file importing from the package', () => {
    const dir = mkTmp();
    const out = join(dir, 'src/_version-generated.ts');
    generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/example',
      outPath: out,
      now: new Date('2026-06-07T00:00:00Z'),
    });
    const txt = readFileSync(out, 'utf8');
    expect(txt).toContain("from '@falkizar/pages-utils'");
    expect(txt).toContain('AppVersion');
    expect(txt).toContain('https://github.com/Falkizar/example');
  });

  it('strips a trailing slash from repoUrl', () => {
    const dir = mkTmp();
    const out = join(dir, 'v.ts');
    const v = generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/example/',
      outPath: out,
      now: new Date('2026-06-07T00:00:00Z'),
    });
    expect(v.repoUrl).toBe('https://github.com/Falkizar/example');
  });

  it('uses CF_PAGES_COMMIT_SHA / CF_PAGES_BRANCH when set', () => {
    process.env.CF_PAGES_COMMIT_SHA = 'a'.repeat(40);
    process.env.CF_PAGES_BRANCH = 'main';
    const dir = mkTmp();
    const out = join(dir, 'v.ts');
    const v = generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/x',
      outPath: out,
      now: new Date('2026-06-07T00:00:00Z'),
    });
    expect(v.commitFull).toBe('a'.repeat(40));
    expect(v.commit).toBe('a'.repeat(7));
    expect(v.branch).toBe('main');
  });

  it('produces "dev" sentinels when no env + no git context', () => {
    // Run from /tmp where there is no git repo. The git CLI will exit nonzero;
    // the function should fall back to "dev"/"unknown".
    const dir = mkTmp();
    const cwd = process.cwd();
    try {
      process.chdir(dir);
      const out = join(dir, 'v.ts');
      const v = generateVersionModule({
        repoUrl: 'https://github.com/Falkizar/x',
        outPath: out,
        now: new Date('2026-06-07T00:00:00Z'),
      });
      expect(v.commit).toBe('dev');
      expect(v.commitFull).toBe('dev');
      expect(v.branch).toBe('unknown');
      expect(v.commitTime).toBeNull();
    } finally {
      process.chdir(cwd);
    }
  });

  it('skips dependency tracking when package-lock.json is absent', () => {
    const dir = mkTmp();
    const out = join(dir, 'v.ts');
    const v = generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/x',
      outPath: out,
      packageLockPath: join(dir, 'does-not-exist.json'),
      now: new Date('2026-06-07T00:00:00Z'),
    });
    expect(v.dependencies).toEqual([]);
  });

  it('extracts @falkizar/* deps with commit + repoUrl from package-lock', () => {
    const dir = mkTmp();
    const lockPath = join(dir, 'package-lock.json');
    writeFileSync(lockPath, JSON.stringify({
      name: 'consumer',
      lockfileVersion: 3,
      packages: {
        '': { name: 'consumer', version: '0.1.0' },
        'node_modules/@falkizar/access-middleware': {
          name: '@falkizar/access-middleware',
          version: '1.0.0',
          resolved: 'git+ssh://git@github.com/Falkizar/access-middleware.git#2478d08f6b397c709860d91215ce228641016f3e',
        },
        'node_modules/@falkizar/pages-utils': {
          name: '@falkizar/pages-utils',
          version: '1.0.0',
          resolved: 'git+https://github.com/Falkizar/pages-utils.git#abc1234567890abc1234567890abc1234567890a',
        },
        'node_modules/jose': {
          name: 'jose',
          version: '6.2.3',
          resolved: 'https://registry.npmjs.org/jose/-/jose-6.2.3.tgz',
        },
      },
    }));
    const out = join(dir, 'v.ts');
    const v = generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/consumer',
      outPath: out,
      packageLockPath: lockPath,
      now: new Date('2026-06-07T00:00:00Z'),
    });
    expect(v.dependencies).toHaveLength(2);
    const [am, pu] = v.dependencies;
    expect(am.name).toBe('@falkizar/access-middleware');
    expect(am.version).toBe('1.0.0');
    expect(am.commit).toBe('2478d08');
    expect(am.commitFull).toBe('2478d08f6b397c709860d91215ce228641016f3e');
    expect(am.repoUrl).toBe('https://github.com/Falkizar/access-middleware');
    expect(pu.name).toBe('@falkizar/pages-utils');
    expect(pu.repoUrl).toBe('https://github.com/Falkizar/pages-utils');
  });

  it('handles a registry tarball resolved URL by omitting commit/repoUrl', () => {
    const dir = mkTmp();
    const lockPath = join(dir, 'package-lock.json');
    writeFileSync(lockPath, JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'c', version: '0.0.1' },
        'node_modules/@falkizar/tarball-published': {
          name: '@falkizar/tarball-published',
          version: '2.0.0',
          resolved: 'https://registry.npmjs.org/@falkizar/tarball-published/-/tarball-published-2.0.0.tgz',
        },
      },
    }));
    const out = join(dir, 'v.ts');
    const v = generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/c',
      outPath: out,
      packageLockPath: lockPath,
      now: new Date('2026-06-07T00:00:00Z'),
    });
    expect(v.dependencies).toHaveLength(1);
    expect(v.dependencies[0].commit).toBeUndefined();
    expect(v.dependencies[0].repoUrl).toBeUndefined();
    expect(v.dependencies[0].version).toBe('2.0.0');
  });

  it('honors a custom trackPrefix', () => {
    const dir = mkTmp();
    const lockPath = join(dir, 'package-lock.json');
    writeFileSync(lockPath, JSON.stringify({
      lockfileVersion: 3,
      packages: {
        'node_modules/@falkizar/foo': {
          name: '@falkizar/foo', version: '1.0.0',
          resolved: 'git+ssh://git@github.com/Falkizar/foo.git#' + 'a'.repeat(40),
        },
        'node_modules/@otherorg/bar': {
          name: '@otherorg/bar', version: '2.0.0',
          resolved: 'git+ssh://git@github.com/otherorg/bar.git#' + 'b'.repeat(40),
        },
      },
    }));
    const out = join(dir, 'v.ts');
    const v = generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/c',
      outPath: out,
      packageLockPath: lockPath,
      trackPrefix: '@otherorg/',
      now: new Date(),
    });
    expect(v.dependencies).toHaveLength(1);
    expect(v.dependencies[0].name).toBe('@otherorg/bar');
  });

  it('sorts dependencies alphabetically for stable build output', () => {
    const dir = mkTmp();
    const lockPath = join(dir, 'package-lock.json');
    writeFileSync(lockPath, JSON.stringify({
      lockfileVersion: 3,
      packages: {
        'node_modules/@falkizar/zeta': {
          name: '@falkizar/zeta', version: '1.0.0',
          resolved: 'git+ssh://git@github.com/Falkizar/zeta.git#' + 'a'.repeat(40),
        },
        'node_modules/@falkizar/alpha': {
          name: '@falkizar/alpha', version: '1.0.0',
          resolved: 'git+ssh://git@github.com/Falkizar/alpha.git#' + 'b'.repeat(40),
        },
      },
    }));
    const out = join(dir, 'v.ts');
    const v = generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/c',
      outPath: out,
      packageLockPath: lockPath,
      now: new Date(),
    });
    expect(v.dependencies.map((d) => d.name)).toEqual([
      '@falkizar/alpha',
      '@falkizar/zeta',
    ]);
  });

  it('output file always re-imports AppVersion from the package (not relative)', () => {
    const dir = mkTmp();
    const out = join(dir, 'src/_version-generated.ts');
    generateVersionModule({
      repoUrl: 'https://github.com/Falkizar/x',
      outPath: out,
      now: new Date(),
    });
    const txt = readFileSync(out, 'utf8');
    expect(txt).not.toContain('./version-utils');
    expect(txt).toContain("import type { AppVersion } from '@falkizar/pages-utils'");
    expect(existsSync(out)).toBe(true);
  });
});

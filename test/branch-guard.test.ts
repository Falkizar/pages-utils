import { describe, it, expect } from 'vitest';
import { guardPreviewWrites } from '../src/branch-guard';
import { HttpError } from '../src/http';

function mkCtx(method: string, branch?: string) {
  return {
    request: new Request('https://x/', { method }),
    env: { CF_PAGES_BRANCH: branch },
  };
}

describe('guardPreviewWrites', () => {
  it('allows writes on main', () => {
    expect(() => guardPreviewWrites(mkCtx('POST', 'main'))).not.toThrow();
  });

  it('allows writes when CF_PAGES_BRANCH is absent (local dev)', () => {
    expect(() => guardPreviewWrites(mkCtx('POST', undefined))).not.toThrow();
  });

  it('throws HttpError(403) for POST on a preview branch', () => {
    expect(() => guardPreviewWrites(mkCtx('POST', 'feature/x')))
      .toThrow(HttpError);
  });

  it('throws HttpError(403) for PUT on a preview branch', () => {
    try {
      guardPreviewWrites(mkCtx('PUT', 'preview-x'));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(403);
    }
  });

  it('throws HttpError(403) for DELETE on a preview branch', () => {
    expect(() => guardPreviewWrites(mkCtx('DELETE', 'feature/x')))
      .toThrow(HttpError);
  });

  it('allows GET on a preview branch (read-only)', () => {
    expect(() => guardPreviewWrites(mkCtx('GET', 'feature/x'))).not.toThrow();
  });

  it('allows HEAD on a preview branch', () => {
    expect(() => guardPreviewWrites(mkCtx('HEAD', 'feature/x'))).not.toThrow();
  });

  it('allows OPTIONS on a preview branch', () => {
    expect(() => guardPreviewWrites(mkCtx('OPTIONS', 'feature/x'))).not.toThrow();
  });

  it('is case-insensitive on method', () => {
    expect(() => guardPreviewWrites(mkCtx('post', 'feature/x')))
      .toThrow(HttpError);
  });
});

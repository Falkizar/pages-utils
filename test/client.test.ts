/**
 * Tests for the browser-runtime admin upgrade helper.
 *
 * Vitest runs in Node, so we mock global `fetch` and `document` rather
 * than spin up jsdom. The helper is tiny — fetch + parse + class toggle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upgradeAdminFromMe } from '../src/client';

// Minimal stand-ins. Each test resets them via beforeEach.
type ClassListStub = {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
};

let classListStub: ClassListStub;

beforeEach(() => {
  classListStub = {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
  (globalThis as any).document = { body: { classList: classListStub } };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as any).document;
});

function mockFetch(body: unknown, ok = true): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    json: async () => body,
  } as unknown as Response);
}

describe('upgradeAdminFromMe', () => {
  it('adds is-admin to body when /api/me responds {admin: true}', async () => {
    mockFetch({ admin: true });
    const result = await upgradeAdminFromMe();
    expect(result).toBe(true);
    expect(classListStub.add).toHaveBeenCalledWith('is-admin');
  });

  it('does not add the class when /api/me responds {admin: false}', async () => {
    mockFetch({ admin: false });
    const result = await upgradeAdminFromMe();
    expect(result).toBe(false);
    expect(classListStub.add).not.toHaveBeenCalled();
  });

  it('does not add the class when /api/me returns non-2xx', async () => {
    mockFetch({}, false);
    const result = await upgradeAdminFromMe();
    expect(result).toBe(false);
    expect(classListStub.add).not.toHaveBeenCalled();
  });

  it('swallows fetch errors and returns false (progressive enhancement)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const result = await upgradeAdminFromMe();
    expect(result).toBe(false);
    expect(classListStub.add).not.toHaveBeenCalled();
  });

  it('uses a custom endpoint when provided', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ admin: true }),
    } as unknown as Response);
    await upgradeAdminFromMe({ endpoint: '/api/whoami' });
    expect(spy).toHaveBeenCalledWith('/api/whoami', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('uses a custom class name when provided', async () => {
    mockFetch({ admin: true });
    await upgradeAdminFromMe({ className: 'has-admin-view' });
    expect(classListStub.add).toHaveBeenCalledWith('has-admin-view');
  });

  it('uses a custom predicate when provided', async () => {
    mockFetch({ role: 'owner' });
    const result = await upgradeAdminFromMe({
      isAdmin: (j: any) => j?.role === 'owner',
    });
    expect(result).toBe(true);
    expect(classListStub.add).toHaveBeenCalledWith('is-admin');
  });

  it('sends credentials: same-origin (required for Access cookie)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ admin: false }),
    } as unknown as Response);
    await upgradeAdminFromMe();
    expect(spy).toHaveBeenCalledWith('/api/me', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('passes the AbortSignal through to fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ admin: false }),
    } as unknown as Response);
    const controller = new AbortController();
    await upgradeAdminFromMe({ signal: controller.signal });
    expect(spy).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

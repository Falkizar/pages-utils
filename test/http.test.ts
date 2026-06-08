import { describe, it, expect } from 'vitest';
import { json, jsonError, readJson, HttpError, handler } from '../src/http';

describe('json', () => {
  it('sets content-type and cache-control', async () => {
    const res = json({ ok: true });
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('lets caller override status', () => {
    expect(json({}, { status: 201 }).status).toBe(201);
  });

  it('lets caller add headers', () => {
    const res = json({}, { headers: { 'x-custom': 'v' } });
    expect(res.headers.get('x-custom')).toBe('v');
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('jsonError', () => {
  it('returns {error} body with given status', async () => {
    const res = jsonError('bad', 400);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad' });
  });

  it('defaults to 400', () => {
    expect(jsonError('x').status).toBe(400);
  });
});

describe('readJson', () => {
  it('parses JSON when content-type is application/json', async () => {
    const r = new Request('https://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await readJson<{ a: number }>(r)).toEqual({ a: 1 });
  });

  it('accepts charset suffix', async () => {
    const r = new Request('https://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{"a":1}',
    });
    expect(await readJson<{ a: number }>(r)).toEqual({ a: 1 });
  });

  it('throws HttpError(415) on non-JSON content-type', async () => {
    const r = new Request('https://x/', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hi',
    });
    await expect(readJson(r)).rejects.toMatchObject({ status: 415 });
  });

  it('throws HttpError(400) on malformed JSON', async () => {
    const r = new Request('https://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    await expect(readJson(r)).rejects.toMatchObject({ status: 400 });
  });
});

describe('handler', () => {
  function mkCtx() {
    return { request: new Request('https://x/') };
  }

  it('passes through successful responses', async () => {
    const wrapped = handler(async () => json({ ok: true }));
    const res = await wrapped(mkCtx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('converts HttpError to jsonError with matching status', async () => {
    const wrapped = handler(async () => { throw new HttpError('bad input', 422); });
    const res = await wrapped(mkCtx());
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'bad input' });
  });

  it('converts uncaught Error to 500 with the actual message', async () => {
    const wrapped = handler(async () => { throw new Error('OpenLibrary timeout'); });
    const res = await wrapped(mkCtx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'OpenLibrary timeout' });
  });

  it('truncates very long error messages', async () => {
    const long = 'x'.repeat(500);
    const wrapped = handler(async () => { throw new Error(long); });
    const res = await wrapped(mkCtx());
    const body = await res.json() as { error: string };
    expect(body.error.length).toBeLessThan(400);
    expect(body.error.endsWith('…')).toBe(true);
  });

  it('falls back to "internal error" when error message is empty', async () => {
    const wrapped = handler(async () => { throw new Error(''); });
    const res = await wrapped(mkCtx());
    expect(await res.json()).toEqual({ error: 'internal error' });
  });

  it('converts non-Error throws (string, etc.) to a sensible 500', async () => {
    const wrapped = handler(async () => { throw 'a bare string'; });
    const res = await wrapped(mkCtx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'a bare string' });
  });
});

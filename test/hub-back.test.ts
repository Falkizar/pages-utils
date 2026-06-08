import { describe, it, expect } from 'vitest';
import { renderHubBackLinkHtml, HUB_BACK_LINK_CSS, isSafeHubUrl } from '../src/hub-back';

describe('renderHubBackLinkHtml', () => {
  it('emits a same-tab link to falkizar.com by default', () => {
    const html = renderHubBackLinkHtml();
    expect(html).toContain('href="https://falkizar.com"');
    expect(html).not.toContain('target="_blank"');
    expect(html).toContain('class="hub-back"');
    expect(html).toContain('← Falkizar');
  });

  it('respects a custom hubUrl', () => {
    expect(renderHubBackLinkHtml({ hubUrl: 'https://staging.falkizar.com' }))
      .toContain('href="https://staging.falkizar.com"');
  });

  it('respects a custom label', () => {
    expect(renderHubBackLinkHtml({ label: '↑ Home' }))
      .toContain('↑ Home');
  });

  it('opens in a new tab when newTab: true', () => {
    const html = renderHubBackLinkHtml({ newTab: true });
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
  });

  it('HTML-escapes a label that contains injection-y characters', () => {
    const html = renderHubBackLinkHtml({ label: '<script>x</script>' });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  // v1.2.2 changed the output to include a sibling spacer in normal
  // flow. v1.2.1 relied on body { padding-top: ... } which a consumer's
  // shorthand `padding: 0` reset (in kids-library's app.css line 20)
  // overrode via the cascade. The spacer is owned by THIS renderer +
  // THIS CSS constant, so consumer CSS can't accidentally defeat it.
  it('emits a sibling spacer element so the chip never overlays content', () => {
    const html = renderHubBackLinkHtml();
    expect(html).toContain('<div class="hub-back-spacer"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('emits the chip BEFORE the spacer so DOM order matches flow expectations', () => {
    const html = renderHubBackLinkHtml();
    const chipAt = html.indexOf('class="hub-back"');
    const spacerAt = html.indexOf('class="hub-back-spacer"');
    expect(chipAt).toBeGreaterThan(-1);
    expect(spacerAt).toBeGreaterThan(chipAt);
  });

  // v1.2.3 URL-scheme validation (closes 2026-06-08 security review I1).
  it('replaces unsafe javascript: hubUrl with the default', () => {
    const html = renderHubBackLinkHtml({ hubUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://falkizar.com"');
  });

  it('replaces unsafe data: hubUrl with the default', () => {
    const html = renderHubBackLinkHtml({ hubUrl: 'data:text/html,<script>x</script>' });
    expect(html).not.toContain('data:');
    expect(html).not.toContain('<script>x');
    expect(html).toContain('href="https://falkizar.com"');
  });

  it('replaces unsafe vbscript: hubUrl with the default', () => {
    const html = renderHubBackLinkHtml({ hubUrl: 'vbscript:msgbox(1)' });
    expect(html).not.toContain('vbscript:');
    expect(html).toContain('href="https://falkizar.com"');
  });

  it('accepts a relative path hubUrl (rare but legal)', () => {
    const html = renderHubBackLinkHtml({ hubUrl: '/home' });
    expect(html).toContain('href="/home"');
  });

  it('accepts a fragment-only hubUrl', () => {
    const html = renderHubBackLinkHtml({ hubUrl: '#top' });
    expect(html).toContain('href="#top"');
  });

  it('accepts http:// for local dev', () => {
    const html = renderHubBackLinkHtml({ hubUrl: 'http://localhost:4321' });
    expect(html).toContain('href="http://localhost:4321"');
  });

  it('replaces an empty hubUrl with the default', () => {
    const html = renderHubBackLinkHtml({ hubUrl: '' });
    expect(html).toContain('href="https://falkizar.com"');
  });

  it('handles a hubUrl with leading whitespace + scheme injection attempt', () => {
    // Browsers happily strip leading whitespace and treat ` javascript:...`
    // as `javascript:...`. The validator trims before parsing.
    const html = renderHubBackLinkHtml({ hubUrl: '  javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://falkizar.com"');
  });
});

describe('isSafeHubUrl', () => {
  it('accepts canonical https:// URLs', () => {
    expect(isSafeHubUrl('https://falkizar.com')).toBe(true);
    expect(isSafeHubUrl('https://staging.falkizar.com/path?q=1')).toBe(true);
  });

  it('accepts http:// URLs (for local dev / tests)', () => {
    expect(isSafeHubUrl('http://localhost:4321')).toBe(true);
  });

  it('accepts relative paths (/, ./, ../, #)', () => {
    expect(isSafeHubUrl('/')).toBe(true);
    expect(isSafeHubUrl('/home')).toBe(true);
    expect(isSafeHubUrl('./sibling')).toBe(true);
    expect(isSafeHubUrl('../parent')).toBe(true);
    expect(isSafeHubUrl('#anchor')).toBe(true);
  });

  it('rejects javascript: URLs (XSS via clickable link)', () => {
    expect(isSafeHubUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHubUrl('JAVASCRIPT:alert(1)')).toBe(false);   // case-insensitive
  });

  it('rejects data: URLs (can carry script in SVG / text/html)', () => {
    expect(isSafeHubUrl('data:text/html,<script>x</script>')).toBe(false);
    expect(isSafeHubUrl('data:image/svg+xml,<svg onload="x">')).toBe(false);
  });

  it('rejects vbscript:, file:, and other non-web schemes', () => {
    expect(isSafeHubUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeHubUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeHubUrl('chrome://settings')).toBe(false);
    expect(isSafeHubUrl('mailto:a@b.c')).toBe(false);
  });

  it('rejects empty string + null-ish input', () => {
    expect(isSafeHubUrl('')).toBe(false);
    expect(isSafeHubUrl(null as unknown as string)).toBe(false);
    expect(isSafeHubUrl(undefined as unknown as string)).toBe(false);
  });

  it('trims leading whitespace before parsing (browsers do)', () => {
    expect(isSafeHubUrl('  javascript:x')).toBe(false);
    expect(isSafeHubUrl('  https://falkizar.com')).toBe(true);
  });

  // "not a url at all" actually parses successfully against the dummy base
  // as a relative path → https://falkizar.com/not%20a%20url%20at%20all.
  // That's safe (same-origin path) and matches what a browser would do with
  // <a href="not a url"> on https://falkizar.com. So we don't test for
  // rejection of garbage that happens to be a legal relative path.

  it('accepts protocol-relative URLs (inherits page scheme)', () => {
    // //host/path inherits the page protocol; on falkizar.com that's
    // always https. Treating these as safe matches browser behavior.
    expect(isSafeHubUrl('//falkizar.com/path')).toBe(true);
  });
});

describe('HUB_BACK_LINK_CSS', () => {
  it('keys off the .hub-back class the renderer emits', () => {
    expect(HUB_BACK_LINK_CSS).toContain('.hub-back');
  });
  it('positions the link top-left + fixed', () => {
    expect(HUB_BACK_LINK_CSS).toMatch(/position:\s*fixed/);
    expect(HUB_BACK_LINK_CSS).toContain('top:');
    expect(HUB_BACK_LINK_CSS).toContain('left:');
  });
  it('includes a dark-mode variant', () => {
    expect(HUB_BACK_LINK_CSS).toContain('prefers-color-scheme: dark');
  });

  // v1.2.2 layout-reservation regression suite.
  it('reserves vertical space via .hub-back-spacer, NOT body padding', () => {
    // The spacer rule must exist with an explicit height.
    expect(HUB_BACK_LINK_CSS).toMatch(/\.hub-back-spacer\s*{[^}]*height:/);
    // And body padding-top must NOT be set — that was the v1.2.1 path
    // that lost the cascade fight to consumer body resets.
    expect(HUB_BACK_LINK_CSS).not.toMatch(/^\s*body\s*{/m);
    expect(HUB_BACK_LINK_CSS).not.toMatch(/body\s*{[^}]*padding-top/);
  });

  it('the spacer rule uses env(safe-area-inset-top) for iPhone notch', () => {
    expect(HUB_BACK_LINK_CSS).toMatch(
      /\.hub-back-spacer\s*{[^}]*height:\s*calc\([^)]*env\(safe-area-inset-top/,
    );
  });

  it('shrinks the spacer height on narrow viewports', () => {
    expect(HUB_BACK_LINK_CSS).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.hub-back-spacer[^}]*height/,
    );
  });

  it('declares pointer-events: none on the spacer so it never blocks clicks', () => {
    expect(HUB_BACK_LINK_CSS).toMatch(/\.hub-back-spacer\s*{[^}]*pointer-events:\s*none/);
  });
});

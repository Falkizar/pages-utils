import { describe, it, expect } from 'vitest';
import { renderHubBackLinkHtml, HUB_BACK_LINK_CSS } from '../src/hub-back';

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

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
});

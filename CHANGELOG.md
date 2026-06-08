# Changelog

All notable changes to `@falkizar/pages-utils`.

The format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with **Added / Changed / Fixed / Deprecated / Removed** sections per release. Versions match the git tags pushed to this repo; each tag is immutable per the org-wide [tag protection ruleset](https://github.com/Falkizar/web-hub/blob/main/docs/repo-norms.md#tag-rulesets).

## [Unreleased]

_Nothing in flight._

---

## [1.2.3] — 2026-06-08

### Added
- `isSafeHubUrl(url)` — exported URL-scheme validator. Returns `true` only for `http://`, `https://`, protocol-relative `//host/path`, or relative URLs (`/foo`, `./foo`, `../foo`, `#anchor`). Rejects `javascript:`, `data:`, `vbscript:`, `file:`, `mailto:`, anything else.

### Fixed
- Defense-in-depth: `renderHubBackLinkHtml({ hubUrl })` now runs the caller-supplied URL through `isSafeHubUrl()` and silently falls back to `https://falkizar.com` on rejection. Closes 2026-06-08 security review finding **I1** (the option is part of the package's public API; a future caller wiring user input to `hubUrl` would otherwise get a clickable XSS via `javascript:`). No current caller is affected.

---

## [1.2.2] — 2026-06-08

### Fixed
- `HUB_BACK_LINK_CSS` cascade fragility — v1.2.1 set `body { padding-top: ... }` to reserve space for the fixed-positioned back-link chip. That worked on `web-hub` + `budget` but lost the cascade to `kids-library`'s `app.css` line 20 (`html, body { padding: 0; ... }` shorthand reset, emitted by Astro AFTER the inline `<style>` block). Switched to a sibling `<div class="hub-back-spacer">` in normal flow. No body styling is touched anymore, so no consumer reset can defeat it. `renderHubBackLinkHtml()` now emits both the chip AND the spacer.

### Changed
- `renderHubBackLinkHtml()` return value now contains two elements (chip + spacer) instead of one. Consumers using `<Fragment set:html={hubBackHtml} />` continue to work; consumers wrapping the return value in a custom element should be aware.

---

## [1.2.1] — 2026-06-08

### Fixed
- Initial attempt at the chip-overlay fix: `HUB_BACK_LINK_CSS` reserves `body { padding-top: calc(2.75rem + env(safe-area-inset-top, 0px)); }`. Mobile uses `safe-area-inset-top` so the chip clears the iPhone notch / dynamic island when launched as an installed PWA. (Superseded by v1.2.2's spacer approach — kept for history.)
- Chip opacity / background opacity nudged 0.7 → 0.85 (more legible against non-overlapping content).

---

## [1.2.0] — 2026-06-08

### Added
- `renderVersionFooterHtml(version, opts?)` — canonical version-footer renderer used by every Falkizar app. Default mode emits dual spans (`<span class="non-admin-only">` + `<a class="admin-only">`) gated by `body.is-admin`. `opts.isAdmin: true | false` skips the dual-render when the caller already knows the identity.
- `VERSION_FOOTER_CSS` — the minimum CSS the footer needs. Inline via `<style set:html={...}>` in the layout head; consumers can override later in their own stylesheet.
- `renderHubBackLinkHtml(opts?)` — renders the "← Falkizar" anchor every non-hub app surfaces top-of-body. Centralizes the hub URL.
- `HUB_BACK_LINK_CSS` — paired CSS for the chip. (Body-padding approach in this version; switched to spacer in v1.2.2.)
- New `/client` subpath with `upgradeAdminFromMe(opts?)` — fetches `/api/me`, toggles `body.is-admin` on admin response. Progressive enhancement — silent on failure.

### Changed
- README + the [app-baseline](https://github.com/Falkizar/web-hub/blob/main/docs/app-baseline.md) recipe both rewritten to teach the canonical pattern.
- Subpath surface clarified:
  - `'.'` — runtime helpers, Worker-safe (no DOM, no `fs`)
  - `./build` — Node-only build-time helpers
  - `./client` — browser-only DOM helpers

---

## [1.1.1] — 2026-06-08

### Fixed
- `generateVersionModule({packageLockPath})` couldn't find `@falkizar/*` deps when npm omitted the `name` field on `node_modules/*` entries in `package-lock.json` (common for `github:` deps). The v1.1.0 key-fallback regex stripped the scope (`@falkizar/pages-utils` → `pages-utils`), so the prefix filter rejected every dep and `AppVersion.dependencies` came back empty. Replaced the regex with a deliberate parser that handles both scoped and unscoped names + nested `node_modules/` paths.

---

## [1.1.0] — 2026-06-08

### Added
- New `/build` subpath with `generateVersionModule({repoUrl, outPath, packageLockPath, trackPrefix?})` — build-time helper called from each app's `astro.config.ts`. Resolves the app's own commit SHA + branch + commit time (from `CF_PAGES_*` env vars or git CLI fallback), reads `package-lock.json` for every `@falkizar/*` dep, and writes a typed `_version-generated.ts` module exporting `APP_VERSION: AppVersion`. Apps now share one generator instead of each maintaining inline `astro.config.ts` resolvers.

---

## [1.0.0] — 2026-06-08

### Added
- Initial extraction from `kids-library` after the second consumer (`web-hub`) needed the same helpers. Surface:
  - `json(body, init?)`, `jsonError(message, status?)`, `readJson<T>(request)` — HTTP response convenience.
  - `HttpError extends Error` — throwable from handlers; gets converted to `jsonError`.
  - `handler(fn)` — wrap any `/api/*` route. Thrown `HttpError`s become `jsonError`; uncaught throws become JSON 500 with the actual (truncated to 300 chars) error message + `console.error` for `wrangler pages deployment tail`.
  - `guardPreviewWrites(ctx)` — refuses POST/PUT/DELETE/PATCH on non-main Pages preview branches. Method-aware (GET/HEAD/OPTIONS always pass).
  - Version metadata: `AppVersion`, `DependencyVersion` types + pure helpers `relativeTime(iso, now?)`, `commitUrl(version, isAdmin)`, `dependencyUrl(dep, isAdmin)`. Admin-only commit-link gating; private repos = 404 for non-admins.

[Unreleased]: https://github.com/Falkizar/pages-utils/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/Falkizar/pages-utils/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/Falkizar/pages-utils/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/Falkizar/pages-utils/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Falkizar/pages-utils/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/Falkizar/pages-utils/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Falkizar/pages-utils/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Falkizar/pages-utils/releases/tag/v1.0.0

# Changelog

All notable changes to Lume are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Reader** — Outline / Pages sidebar toggle for navigating PDFs with a table of contents
- **Reader** — Color picker in the toolbar for highlight and underline ink
- **Reader** — <kbd>Cmd</kbd> / <kbd>Ctrl</kbd> + scroll wheel zooms the viewport
- **Reader** — Bottom page indicator auto-fades after 1.5s idle and returns on scroll
- **Signature** — Target page picker; signatures can now be applied to any page instead of only page 1
- **Convert** — Exports all pages to PNG (previously capped at 10)

### Changed
- **Convert** — Button relabeled to "Extract Formatted Images"
- **Reader** — Text-layer selection uses a sage-green highlight and fixes selection bleed on PDFs with unusual line-height metrics

### Fixed
- **Reader** — Save dropdown no longer clipped behind the PDF viewport (toolbar z-index bumped to 100)

## [0.1.0] — 2026-04-20

Initial release as a local macOS desktop app — an offline PDF toolkit where every document stays on the device.

### Added
- **Reader** — view, search, highlight, underline, annotate; bookmarks and thumbnail navigation
- **Merge** — combine multiple PDFs into one
- **Organize pages** — drag to reorder, delete, and rotate pages
- **Convert** — PDF ↔ images (PNG / JPG)
- **Sign** — draw a signature and embed it into a document
- **Watermark** — add text watermarks
- **Recent documents** — history kept locally in IndexedDB, surfaced on the Home Dashboard
- **Electron 33 desktop shell** with custom `app://` protocol so the pdfjs worker has a proper origin
- **DMG packaging** via `electron-builder` for Apple Silicon (arm64) and Intel (x64)
- **Icon generation** script using Electron's offscreen capture + `iconutil`
- **End-to-end smoke test** — launches Electron, renders a generated PDF, verifies history persistence
- **Bilingual README** — English primary, 简体中文 linked

[Unreleased]: https://github.com/xiangjie-zhu/Lume/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/xiangjie-zhu/Lume/releases/tag/v0.1.0

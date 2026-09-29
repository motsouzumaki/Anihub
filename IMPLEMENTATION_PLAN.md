# AniHub Implementation Plan

## 1. Executive Summary & Vision

**AniHub** is an all-in-one anime & manga curation platform that unites two core curation workflows into a cohesive, high-performance web experience:
1. **AniRanker**: Linear ranking, drag-and-drop hierarchy matrix, and adaptive visual gallery generator.
2. **AniTierlist**: Multi-tier (S/A/B/C/D/...) tier list builder, customizable tier configurations, and unranked pool management.

Instead of navigating between separate standalone tools with fragmented styling and duplicate code, users have a unified platform featuring a **portal landing page**, a **shared discovery engine** (AniList search, profile sync, seasonal browser, custom image uploads), and **smooth workflow transitions**.

---

## 2. Platform Architecture & Directory Structure

A **Modular Single-Page Application (SPA)** architecture using modern ES modules with zero-build requirements (ready to run directly in modern browsers):

```
Anihub/
├── index.html                   # Unified application entry point & shell
├── style.css                    # Unified design system & custom animations
├── IMPLEMENTATION_PLAN.md       # This implementation plan document
├── js/
│   ├── app.js                   # Application coordinator & initialization
│   ├── router.js                # Hash-based SPA router (#/, #/ranker, #/tierlist)
│   ├── state.js                 # Global application state & theme management
│   ├── api.js                   # Unified AniList GraphQL API client
│   ├── toast.js                 # Toast notification & modal engine
│   ├── components/
│   │   ├── navbar.js            # Universal responsive navigation & controls
│   │   ├── discovery.js         # Unified discovery component (Search, Sync, Seasons, Upload)
│   │   ├── export-modal.js      # Consolidated export & share modal (PNG, JSON, Text, Hash)
│   │   └── tier-settings.js     # Tierlist customization modal
│   └── views/
│       ├── landing.js           # Interactive landing page with feature cards
│       ├── ranker.js            # AniRanker linear workspace & grid output
│       └── tierlist.js          # AniTierlist workspace & unranked pool
├── assets/                      # Shared brand assets & icons
└── legacy/                      # Archived copies of AniRanker & AniTierlist for reference
```

---

## 3. Routing & Navigation Strategy

### Hash-based SPA Router (`#/`)
- **`#/` or `#/home`**: **AniHub Hub / Landing Page** — Interactive gateway to choose between AniRanker and AniTierlist, featuring recent work previews, feature highlights, and quick launch triggers.
- **`#/ranker`**: **AniRanker Workspace** — Linear ranking mode with active state persistence. Supports share hashes (e.g., `#/ranker?data=...` or hash parameters).
- **`#/tierlist`**: **AniTierlist Workspace** — Tier maker mode with tier configs and unranked pool. Supports tier share links (e.g., `#/tierlist?data=...`).

### Universal Navbar
- Fixed/sticky glassmorphic top bar:
  - **Logo**: AniHub icon + brand typography (`Poppins`).
  - **View Switcher**: Quick pill buttons `[ Hub | AniRanker | AniTierlist ]` with active state indicator.
  - **Contextual Actions**: Workspace-specific action triggers (Settings, Reset, Export).
  - **Global Dark Mode Toggle**: Synchronized theme across all views with `localStorage` persistence.

---

## 4. Landing Page UX Blueprint

1. **Hero Section**:
   - Catchy tagline: *"The Ultimate Anime & Manga Curation Suite"*.
   - Dynamic animated gradient backdrop and glowing ambient orbs.
   - Quick Start CTA buttons.
2. **Interactive Service Selection Cards**:
   - **Card 1: AniRanker (Linear Hierarchy)**
     - Visual badge: `Linear Ranking • Gallery Export`.
     - Feature highlights: AniList integration, 1-to-N list & grid ranking, auto-generated visual showcase, PNG export.
     - Direct CTA: *"Launch AniRanker"* `→`
   - **Card 2: AniTierlist (Tier Builder)**
     - Visual badge: `Tier List Maker • Custom Colors`.
     - Feature highlights: S-to-F tiers, custom color pickers, unranked pool, seasonal exploration, text/image export.
     - Direct CTA: *"Launch AniTierlist"* `→`
3. **Cross-Service Capabilities Strip**:
   - Highlights unified features: AniList profile sync, multi-image upload & renaming, seasonal anime browser, and zero-registration local persistence.
4. **Recent Work / Quick Resume**:
   - Detects existing saved items from browser storage and lets users jump straight back into their last active session.

---

## 5. Component Merging & Redundancy Elimination

### A. Unified Discovery & Ingestion Engine (`discovery.js`)
Currently, both `AniRanker` and `AniTierlist` have their own search inputs, sync forms, and API queries. We merge them into one shared tabbed component:

| Tab | Current Status | Unified Feature Set |
|---|---|---|
| **Database Search** | Duplicated across both | Supports **Anime**, **Manga**, and **Characters**. Includes character filtering by **Name** or **Series**, gender filters, and responsive layout toggle (Grid / List). |
| **AniList Profile Sync** | Duplicated across both | Enter username to load Watching, Completed, Planning, etc., with unified sorting (Title, Score, Year) and format filters (TV, Movie, Manga). |
| **Seasonal Browser** | Only in AniTierlist | Now accessible to **both** tools! Browse by season and year with optional user watch-status filter. |
| **Custom Upload & URL** | Fragmented tools | Multi-file local upload + direct image URL input with automatic title generation, custom renaming, and badge identification. |

> **Context-Aware Addition**: An item clicked in the Discovery component is sent to the currently active tool (`Add to Ranked List` in Ranker, or `Add to Unranked Pool` in Tierlist). A quick toggle also allows sending items directly between tools!

### B. Unified AniList API Service (`api.js`)
- Combines all GraphQL queries into a single, deduplicated client.
- Adds shared caching and debounced requests to avoid AniList rate limits.

### C. Unified Export & Share Engine (`export-modal.js`)
- **PNG Generation**: Consolidates `html2canvas` logic with optimized render scales and dark/light background support.
- **Backup & Restore**: Single JSON standard supporting rank lists, tier structures, and custom base64 images.
- **Share Links**: Hash-based URL generator that encodes item IDs and titles.
- **Text Export**: Plaintext list export (by rank or by tier).

### D. Unified Design System & Styling (`style.css`)
- **Palette**: Indigo (`#6366f1`), Sky (`#0ea5e9`), Violet (`#8b5cf6`), and neutral Slate (`#0f172a` dark / `#f8fafc` light).
- **Glassmorphism & Shadows**: Consistent `shadow-soft`, `shadow-glass`, and backdrop blur tokens.
- **Micro-Interactions**: Smooth drag-and-drop feedback, hover elevation, subtle loading pulses, and unified scrollbars.

---

## 6. Implementation Phases

1. **Phase 1: Foundation & Shared Core** [COMPLETED]
   - Establish unified `style.css` design system and utility classes.
   - Implement `js/state.js` (theme, active tool state, storage helpers).
   - Implement `js/router.js` (hash navigation and view mounting).
   - Implement universal `navbar.js` and toast notification system.
   - Set up `index.html` application shell with full responsive layout and theme switching.

2. **Phase 2: AniHub Landing Page** [COMPLETED]
   - Built `views/landing.js` featuring dynamic animated hero section, interactive service selection cards, feature highlights, mock visualization previews, active session detection with quick-resume triggers, curated demo pack loader, and workflow comparison matrix.
   - Enhanced `style.css` with landing page gradient typography, card transition effects, and rank tier badges.

3. **Phase 3: Unified Discovery Engine** [COMPLETED]
   - Built `js/api.js`: Unified, cached GraphQL client with rate-limiting backoff, auto-retry, and normalized media/character models.
   - Built `js/components/discovery.js`: Reusable 4-tab ingestion suite (Database Search with character series drill-down, AniList Profile Sync, Seasonal Explorer with user-list filter, and Multi-file / Direct URL Custom Uploader).
   - Added context-aware target switching (`AniRanker`, `AniTierlist`, or `Both`) and batch ingestion.
   - Mounted Discovery Engine into both `views/ranker.js` and `views/tierlist.js` with live state synchronization.

4. **Phase 4: Workspaces Integration** [COMPLETED]
   - Built full-featured `views/ranker.js`: linear ranking matrix, HTML5 desktop drag-and-drop with top/bottom drop indicators, long-press mobile touch drag-and-drop reordering with haptic feedback, custom item renaming, sort/reverse/shuffle tools, tabbed Matrix List and Grid Showcase view modes, column density selector, rank badge & title visibility toggles, and direct high-DPI PNG download.
   - Built full-featured `views/tierlist.js`: customizable tier matrix, inline editable tier badges, per-row management controls (move up/down, clear, delete), "Show Titles" toggle for both tier matrix and staging pool, HTML5 desktop drag-and-drop between tiers & unranked pool, mobile touch drag reordering with floating avatar, unranked staging pool with live filter search, clear and reset-to-pool actions, text export, and PNG capture.
   - Built `js/components/tier-settings.js`: interactive modal dialog for tier row customization, hex/preset color swatches, tier reordering, safe item retention, and default reset.
   - Enhanced `js/state.js` with tier manipulation helpers (`moveTier`, `clearTier`, `deleteTier`, `addTier`, `returnAllTiersToPool`, `resetTiersToDefault`, `renameItem`).
   - Integrated custom styles in `style.css` for drag avatars, drop targets, tier hover states, and ranking grid showcases.

5. **Phase 5: Unified Export Engine & QA** [COMPLETED]
   - Built `js/components/export-modal.js`: Comprehensive modal suite supporting 4 export modalities:
     - **PNG Graphic**: Multi-scale rasterizer (1x Standard, 2x Retina High-Res, 3x Studio Ultra HD), customizable canvas backgrounds (Slate Dark `#0f172a`, Clean Light `#ffffff`, or App Theme), optional AniHub Studio branding watermark pill, custom filename input, multi-strategy CORS/Base64 pre-conversion engine with real-time asset conversion progress bar, and direct download + clipboard copy support.
     - **Plain Text**: Dynamic list formatter supporting Standard formatted text, Markdown (`#`, `###`, and `- **Bold**`), and CSV with live monospace preview, line count indicators, one-click clipboard copy, and `.txt` file download.
     - **JSON Backup & Restore**: Standardized AniHub v2.0 schema backup (active workspace or full suite), alongside an intelligent parser that restores AniHub v2 backups, legacy AniRanker JSON arrays, and legacy AniTierlist JSON configurations with replace vs. append options.
     - **Share Link & QR**: Compact base64 URL hash generator that serializes workspace items into shareable URLs (`#/.../?share=...`), accompanied by live dynamic QR code generation for scanning on mobile devices, and automatic share link payload ingestion on page load.
   - Integrated unified export modal triggers across `views/ranker.js`, `views/tierlist.js`, and `components/navbar.js`.
   - Verified responsive design across mobile drawer, modals, dropzones, and desktop showcase boards.

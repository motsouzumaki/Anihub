# AniHub

A client-side anime and manga curation suite integrating linear rank-ordered lists with customizable multi-tier matrices, powered by the AniList GraphQL API.

---

## Architecture & Capabilities

- **Unified Client-Side State & Persistence:** Centralized pub/sub store with automated `localStorage` synchronisation across ranking matrices, tier configurations, layout modes, and query parameters.
- **AniList GraphQL Client:** Integrated query builder for media search, seasonal trends, genre filtering, and user collection ingestion, featuring automated rate-limit exponential backoff and in-memory TTL caching (10-minute validity, key-hashed by query and variable footprint).
- **Dual Curation Modes:**
  - *AniRanker:* Ordered linear rankings with drag-and-drop or explicit numerical slotting, custom note annotations, and multi-column grid/list layouts.
  - *AniTierList:* Custom tier-matrix builder with reorderable rows, per-tier hex color selection, pool allocation, and auto-sorting algorithms.
- **Zero-Dependency Media Ingestion:** Search directly across AniList's catalog with media type toggling (Anime / Manga), status filters, and one-click bulk list import by AniList username.
- **Client-Side Canvas Export Engine:** Rasterized image generation via `html2canvas` supporting custom aspect ratios (16:9, 9:16, 1:1, custom), watermarks, and direct PNG download without server roundtrips.
- **Data Portability:** Lossless JSON schema import/export enabling cross-device sync and local backup.

---

## Tech Stack

| Layer | Tech | Purpose |
|---|---|---|
| Runtime | Pure Vanilla JavaScript (ES6+) | Application logic, routing, and state orchestration |
| Styling | Tailwind CSS (CDN) + Custom CSS Variables | Design tokens, typography, dark/light theme definitions |
| External API | AniList GraphQL API | Anime/manga metadata, search, and user list ingestion |
| Rendering Engine | `html2canvas` 1.4.1 | Client-side DOM rasterization to PNG |
| Iconography | Font Awesome 6.4.0 | UI symbols and visual indicators |
| Typography | Inter & JetBrains Mono | Interface labels and technical data displays |

---

## Quickstart

AniHub is a zero-build, static client-side web application. It requires no transpilation, bundlers, or package installations.

1. Clone the repository:
   ```bash
   git clone https://github.com/motsouzumaki/Anihub.git
   cd Anihub
   ```

2. Serve locally using any static HTTP server:
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Or using Node npx
   npx serve .
   ```

3. Open your browser and navigate to `http://localhost:8000`.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| N/A | No | None | All operations run client-side against public endpoints; no server environment keys required. |

*Note: Queries to `https://graphql.anilist.co` are issued directly from the client. Standard AniList client rate limits (90 requests/minute) apply.*

---

## Project Layout

```
.
├── index.html                   # HTML entrypoint, font/CSS imports, script orchestrator
├── style.css                    # Design tokens, theme CSS custom properties, utility overrides
├── js/
│   ├── app.js                   # Application initialization bootstrap
│   ├── router.js                # Hash-based SPA routing controller
│   ├── state.js                 # Central state store, persistence layer, pub/sub dispatcher
│   ├── api.js                   # AniList GraphQL client, request throttling, cache layer
│   ├── toast.js                 # Floating notification system
│   ├── components/
│   │   ├── navbar.js            # Global navigation bar & theme switcher
│   │   ├── discovery.js         # Search drawer, seasonal browser, and username importer
│   │   ├── tier-settings.js     # Row addition, deletion, and tier color configuration
│   │   └── export-modal.js      # html2canvas rasterizer and image exporter
│   └── views/
│       ├── landing.js           # Platform hub overview and mode selector
│       ├── ranker.js            # AniRanker linear list curation interface
│       └── tierlist.js          # AniTierList tier matrix curation interface
└── README.md                    # Technical documentation
```

---

## Storage Schema

State is stored in the browser's `localStorage` under distinct keys:

| Storage Key | Type | Description |
|---|---|---|
| `anihub_theme` | `'dark' \| 'light'` | Active interface color scheme |
| `aniRanker_data` | `Array<MediaItem>` | Active items positioned in the linear ranker |
| `aniRanker_layout` | `'grid' \| 'compact'` | Render density for ranker items |
| `aniTierList_tiers` | `Array<TierRow>` | Tier rows containing partitioned media items |
| `aniTierList_pool` | `Array<MediaItem>` | Unallocated media pool for tier list curation |
| `aniTierList_tierConfig` | `Array<TierConfig>` | Configured tier metadata (id, label, hex color) |
| `anihub_username` | `string` | Last queried AniList profile identifier |

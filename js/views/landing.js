/**
 * AniHub Landing View (Anti-AI Slop Refactor)
 * High-density editorial curation workspace launcher and session desk
 */

window.AniHub = window.AniHub || {};
window.AniHub.views = window.AniHub.views || {};

(function() {
    // Curated high-resolution anime sample pack for instant demo exploration
    const DEMO_ITEMS = [
        {
            id: 154587,
            title: "Frieren: Beyond Journey's End",
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
            format: "TV",
            episodes: 28,
            score: 91
        },
        {
            id: 9253,
            title: "Steins;Gate",
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-tIUXF2gfU8Sg.jpg",
            format: "TV",
            episodes: 24,
            score: 90
        },
        {
            id: 11061,
            title: "Hunter x Hunter (2011)",
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-y5gsT1hoHuHw.png",
            format: "TV",
            episodes: 148,
            score: 89
        },
        {
            id: 101348,
            title: "Vinland Saga",
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-2fhDFPCuMNiz.jpg",
            format: "TV",
            episodes: 24,
            score: 88
        },
        {
            id: 5114,
            title: "Fullmetal Alchemist: Brotherhood",
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-nSWCgQlmOMtj.jpg",
            format: "TV",
            episodes: 64,
            score: 90
        },
        {
            id: 16498,
            title: "Attack on Titan",
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg",
            format: "TV",
            episodes: 25,
            score: 85
        }
    ];

    function getSessionStats() {
        const state = window.AniHub.state;
        if (!state) return { rankerCount: 0, tierCount: 0, poolCount: 0, rankerItems: [], tierItems: [] };

        const rankerItems = state.rankerItems || [];
        const rankerCount = rankerItems.length;

        let tierCount = 0;
        const tierItems = [];
        if (state.tierlistTiers && Array.isArray(state.tierlistTiers)) {
            state.tierlistTiers.forEach(t => {
                if (t.items && Array.isArray(t.items)) {
                    tierCount += t.items.length;
                    t.items.forEach(item => {
                        if (tierItems.length < 5) tierItems.push({ ...item, tierColor: t.color, tierName: t.name });
                    });
                }
            });
        }

        const poolCount = (state.tierlistPool && Array.isArray(state.tierlistPool)) ? state.tierlistPool.length : 0;

        return {
            rankerCount,
            tierCount,
            poolCount,
            rankerItems: rankerItems.slice(0, 5),
            tierItems
        };
    }

    function renderLanding(container) {
        if (!container) return;
        const stats = getSessionStats();
        const hasActiveSession = stats.rankerCount > 0 || stats.tierCount > 0 || stats.poolCount > 0;

        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 md:px-6 py-8 animate-fade-in relative z-10">
                
                <!-- HERO SECTION -->
                <section class="py-8 md:py-12 flex flex-col items-center text-center">
                    
                    <!-- Suite Tag Pill -->
                    <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-mono text-text-muted mb-5">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
                        <span>STUDIO CURATION SUITE • ANILIST SYNC</span>
                    </div>

                    <!-- Main Hero Title -->
                    <h1 class="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary leading-tight mb-4 max-w-3xl">
                        Curate, Rank & Benchmark <br>
                        <span class="text-accent">Anime & Manga Rosters</span>
                    </h1>

                    <!-- Hero Subtitle -->
                    <p class="text-sm sm:text-base text-text-muted max-w-2xl mb-8 leading-relaxed">
                        Linear 1-to-N ranking matrix and multi-tier tier list builder. Integrated AniList synchronization, seasonal catalog exploration, and lossless studio exports.
                    </p>

                    <!-- CTA Actions -->
                    <div class="flex flex-wrap items-center justify-center gap-3 mb-8 w-full sm:w-auto">
                        <a href="#/ranker" class="h-10 px-5 rounded-md bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors">
                            <i class="fas fa-list-ol text-xs"></i>
                            <span>Open AniRanker</span>
                            <i class="fas fa-arrow-right text-[10px]"></i>
                        </a>

                        <a href="#/tierlist" class="h-10 px-5 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-primary font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors">
                            <i class="fas fa-th-large text-xs text-text-muted"></i>
                            <span>Open AniTierlist</span>
                            <i class="fas fa-arrow-right text-[10px]"></i>
                        </a>

                        <button id="hero-demo-btn" class="h-10 px-4 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary font-mono text-xs flex items-center justify-center gap-2 transition-colors">
                            <i class="fas fa-folder-open text-xs"></i>
                            <span>Load Demo Pack</span>
                        </button>
                    </div>

                    <!-- Feature Strip -->
                    <div class="flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-text-muted">
                        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border">
                            <i class="fas fa-bolt text-accent text-xs"></i> Zero Setup
                        </div>
                        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border">
                            <i class="fas fa-lock text-accent text-xs"></i> Client-Side Privacy
                        </div>
                        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border">
                            <i class="fas fa-database text-accent text-xs"></i> AniList GraphQL
                        </div>
                        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border">
                            <i class="fas fa-image text-accent text-xs"></i> High-DPI PNG
                        </div>
                    </div>
                </section>

                <!-- RECENT WORK / ACTIVE SESSION DETECTOR BANNER -->
                ${renderActiveSessionBanner(stats, hasActiveSession)}

                <!-- WORKSPACE SELECTION CARDS -->
                <section class="mb-12">
                    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 border-b border-border pb-4">
                        <div>
                            <h2 class="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                                Workspaces
                            </h2>
                            <p class="text-xs sm:text-sm text-text-muted mt-0.5">
                                Select a curation layout tailored for your list format.
                            </p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                        
                        <!-- CARD 1: AniRanker -->
                        <div class="rounded-lg bg-surface border border-border p-5 sm:p-6 flex flex-col justify-between hover:border-text-muted/40 transition-colors">
                            <div>
                                <!-- Header Badge -->
                                <div class="flex items-center justify-between gap-4 mb-3">
                                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg border border-border text-accent font-mono text-[11px] font-semibold uppercase">
                                        <i class="fas fa-list-ol text-[10px]"></i> Linear Matrix
                                    </span>
                                    <span class="font-mono text-[11px] text-text-muted">1-to-N Priority</span>
                                </div>

                                <h3 class="text-xl font-bold text-text-primary mb-2">
                                    AniRanker Workspace
                                </h3>

                                <p class="text-xs sm:text-sm text-text-muted mb-5 leading-relaxed">
                                    Definitive 1st to Nth sequential ranking with instant drag-and-drop reordering, matrix table, and grid poster showcase.
                                </p>

                                <!-- Visual Mock Interactive Widget -->
                                <div class="p-3 rounded-md bg-bg border border-border mb-5">
                                    <div class="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span>Sequence Preview</span>
                                        <span class="text-accent font-semibold">1-to-N Output</span>
                                    </div>
                                    <div class="space-y-1.5">
                                        <div class="flex items-center gap-2.5 p-1.5 rounded-md bg-surface border border-border">
                                            <span class="w-5 h-5 rounded-sm rank-badge-gold flex items-center justify-center font-mono font-bold text-xs shrink-0">1</span>
                                            <div class="w-7 h-10 rounded-sm bg-surface-hover overflow-hidden shrink-0 border border-border">
                                                <img src="${DEMO_ITEMS[0].image}" alt="Frieren" class="w-full h-full object-cover" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-xs font-semibold text-text-primary truncate">Frieren: Beyond Journey's End</p>
                                                <p class="font-mono text-[10px] text-text-muted">TV • 28 eps • ★ 91</p>
                                            </div>
                                            <i class="fas fa-grip-vertical text-text-muted text-xs px-1"></i>
                                        </div>

                                        <div class="flex items-center gap-2.5 p-1.5 rounded-md bg-surface border border-border">
                                            <span class="w-5 h-5 rounded-sm rank-badge-silver flex items-center justify-center font-mono font-bold text-xs shrink-0">2</span>
                                            <div class="w-7 h-10 rounded-sm bg-surface-hover overflow-hidden shrink-0 border border-border">
                                                <img src="${DEMO_ITEMS[1].image}" alt="Steins;Gate" class="w-full h-full object-cover" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-xs font-semibold text-text-primary truncate">Steins;Gate</p>
                                                <p class="font-mono text-[10px] text-text-muted">TV • 24 eps • ★ 90</p>
                                            </div>
                                            <i class="fas fa-grip-vertical text-text-muted text-xs px-1"></i>
                                        </div>

                                        <div class="flex items-center gap-2.5 p-1.5 rounded-md bg-surface border border-border">
                                            <span class="w-5 h-5 rounded-sm rank-badge-bronze flex items-center justify-center font-mono font-bold text-xs shrink-0">3</span>
                                            <div class="w-7 h-10 rounded-sm bg-surface-hover overflow-hidden shrink-0 border border-border">
                                                <img src="${DEMO_ITEMS[2].image}" alt="Hunter x Hunter" class="w-full h-full object-cover" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-xs font-semibold text-text-primary truncate">Hunter x Hunter (2011)</p>
                                                <p class="font-mono text-[10px] text-text-muted">TV • 148 eps • ★ 89</p>
                                            </div>
                                            <i class="fas fa-grip-vertical text-text-muted text-xs px-1"></i>
                                        </div>
                                    </div>
                                </div>

                                <!-- Feature Checklist -->
                                <ul class="space-y-1.5 mb-6 text-xs text-text-muted">
                                    <li class="flex items-center gap-2">
                                        <i class="fas fa-check text-accent text-xs"></i>
                                        <span>Dynamic 1-to-N auto-numbering & instant drag reorder</span>
                                    </li>
                                    <li class="flex items-center gap-2">
                                        <i class="fas fa-check text-accent text-xs"></i>
                                        <span>Dual views: Structured detail table and visual poster grid</span>
                                    </li>
                                    <li class="flex items-center gap-2">
                                        <i class="fas fa-check text-accent text-xs"></i>
                                        <span>Lossless studio PNG export with custom backgrounds</span>
                                    </li>
                                </ul>
                            </div>

                            <a href="#/ranker" class="h-9 px-4 rounded-md bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs flex items-center justify-center gap-2 transition-colors">
                                <span>Launch AniRanker</span>
                                <i class="fas fa-arrow-right text-[10px]"></i>
                            </a>
                        </div>

                        <!-- CARD 2: AniTierlist -->
                        <div class="rounded-lg bg-surface border border-border p-5 sm:p-6 flex flex-col justify-between hover:border-text-muted/40 transition-colors">
                            <div>
                                <!-- Header Badge -->
                                <div class="flex items-center justify-between gap-4 mb-3">
                                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg border border-border text-accent font-mono text-[11px] font-semibold uppercase">
                                        <i class="fas fa-th-large text-[10px]"></i> Tier Matrix
                                    </span>
                                    <span class="font-mono text-[11px] text-text-muted">S-to-F Groups</span>
                                </div>

                                <h3 class="text-xl font-bold text-text-primary mb-2">
                                    AniTierlist Workspace
                                </h3>

                                <p class="text-xs sm:text-sm text-text-muted mb-5 leading-relaxed">
                                    Categorized tier list builder with custom color swatches, unranked staging pool, and seasonal catalog browsing.
                                </p>

                                <!-- Visual Mock Interactive Widget -->
                                <div class="p-3 rounded-md bg-bg border border-border mb-5">
                                    <div class="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span>Board Preview</span>
                                        <span class="text-accent font-semibold">Custom Tiers</span>
                                    </div>
                                    <div class="space-y-1.5">
                                        <!-- Tier S -->
                                        <div class="flex items-center rounded-sm overflow-hidden border border-border bg-surface">
                                            <div class="w-9 h-10 bg-[#fe769b] text-slate-900 font-bold text-xs flex items-center justify-center shrink-0">
                                                S
                                            </div>
                                            <div class="flex items-center gap-1.5 p-1 overflow-x-auto flex-1 bg-bg">
                                                <img src="${DEMO_ITEMS[0].image}" class="w-6 h-8 rounded-sm object-cover border border-border" alt="Frieren" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                                <img src="${DEMO_ITEMS[1].image}" class="w-6 h-8 rounded-sm object-cover border border-border" alt="Steins;Gate" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                            </div>
                                        </div>

                                        <!-- Tier A -->
                                        <div class="flex items-center rounded-sm overflow-hidden border border-border bg-surface">
                                            <div class="w-9 h-10 bg-[#ffffa6] text-slate-900 font-bold text-xs flex items-center justify-center shrink-0">
                                                A
                                            </div>
                                            <div class="flex items-center gap-1.5 p-1 overflow-x-auto flex-1 bg-bg">
                                                <img src="${DEMO_ITEMS[2].image}" class="w-6 h-8 rounded-sm object-cover border border-border" alt="Hunter x Hunter" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                                <img src="${DEMO_ITEMS[3].image}" class="w-6 h-8 rounded-sm object-cover border border-border" alt="Vinland Saga" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                            </div>
                                        </div>

                                        <!-- Tier B -->
                                        <div class="flex items-center rounded-sm overflow-hidden border border-border bg-surface">
                                            <div class="w-9 h-10 bg-[#9df79d] text-slate-900 font-bold text-xs flex items-center justify-center shrink-0">
                                                B
                                            </div>
                                            <div class="flex items-center gap-1.5 p-1 overflow-x-auto flex-1 bg-bg">
                                                <img src="${DEMO_ITEMS[4].image}" class="w-6 h-8 rounded-sm object-cover border border-border" alt="Fullmetal Alchemist" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                                <img src="${DEMO_ITEMS[5].image}" class="w-6 h-8 rounded-sm object-cover border border-border" alt="Attack on Titan" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Feature Checklist -->
                                <ul class="space-y-1.5 mb-6 text-xs text-text-muted">
                                    <li class="flex items-center gap-2">
                                        <i class="fas fa-check text-accent text-xs"></i>
                                        <span>Fully customizable tier labels and hex color palettes</span>
                                    </li>
                                    <li class="flex items-center gap-2">
                                        <i class="fas fa-check text-accent text-xs"></i>
                                        <span>Staging drawer with search filter and batch clear</span>
                                    </li>
                                    <li class="flex items-center gap-2">
                                        <i class="fas fa-check text-accent text-xs"></i>
                                        <span>Seasonal anime catalog ingestion (Winter, Spring, Summer, Fall)</span>
                                    </li>
                                </ul>
                            </div>

                            <a href="#/tierlist" class="h-9 px-4 rounded-md bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs flex items-center justify-center gap-2 transition-colors">
                                <span>Launch AniTierlist</span>
                                <i class="fas fa-arrow-right text-[10px]"></i>
                            </a>
                        </div>
                    </div>
                </section>

                <!-- UNIFIED ENGINE CAPABILITIES -->
                <section class="mb-12">
                    <div class="p-6 md:p-8 rounded-lg bg-surface border border-border">
                        <div class="max-w-2xl mb-6">
                            <span class="font-mono text-xs font-semibold text-accent uppercase tracking-wider block mb-1">Architecture</span>
                            <h2 class="text-xl md:text-2xl font-bold tracking-tight text-text-primary mb-2">
                                Unified Discovery & Export Engine
                            </h2>
                            <p class="text-xs sm:text-sm text-text-muted leading-relaxed">
                                Both workspaces share the same high-performance API client, profile synchronizer, and export pipeline.
                            </p>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <!-- Capability 1 -->
                            <div class="p-4 rounded-md bg-bg border border-border">
                                <div class="w-8 h-8 rounded-md bg-surface border border-border flex items-center justify-center text-accent text-xs mb-3">
                                    <i class="fas fa-search"></i>
                                </div>
                                <h4 class="font-semibold text-sm text-text-primary mb-1">Universal Search</h4>
                                <p class="text-xs text-text-muted leading-relaxed">
                                    Live fuzzy search across Anime, Manga, and Characters with series filtering.
                                </p>
                            </div>

                            <!-- Capability 2 -->
                            <div class="p-4 rounded-md bg-bg border border-border">
                                <div class="w-8 h-8 rounded-md bg-surface border border-border flex items-center justify-center text-accent text-xs mb-3">
                                    <i class="fas fa-sync-alt"></i>
                                </div>
                                <h4 class="font-semibold text-sm text-text-primary mb-1">AniList Sync</h4>
                                <p class="text-xs text-text-muted leading-relaxed">
                                    Pull Completed, Watching, and Planning watchlists via username.
                                </p>
                            </div>

                            <!-- Capability 3 -->
                            <div class="p-4 rounded-md bg-bg border border-border">
                                <div class="w-8 h-8 rounded-md bg-surface border border-border flex items-center justify-center text-accent text-xs mb-3">
                                    <i class="fas fa-upload"></i>
                                </div>
                                <h4 class="font-semibold text-sm text-text-primary mb-1">Custom Covers</h4>
                                <p class="text-xs text-text-muted leading-relaxed">
                                    Upload local artwork or direct image URLs with inline title detection.
                                </p>
                            </div>

                            <!-- Capability 4 -->
                            <div class="p-4 rounded-md bg-bg border border-border">
                                <div class="w-8 h-8 rounded-md bg-surface border border-border flex items-center justify-center text-accent text-xs mb-3">
                                    <i class="fas fa-file-export"></i>
                                </div>
                                <h4 class="font-semibold text-sm text-text-primary mb-1">Multi-Format Export</h4>
                                <p class="text-xs text-text-muted leading-relaxed">
                                    Studio PNG (1x/2x/3x DPI), Markdown/CSV text, and JSON backup & restore.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- WORKSPACE COMPARISON TABLE -->
                <section class="mb-12">
                    <div class="mb-4">
                        <h2 class="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                            Workflow Comparison
                        </h2>
                        <p class="text-xs sm:text-sm text-text-muted mt-0.5">
                            Technical breakdown of linear vs. tiered curation logic.
                        </p>
                    </div>

                    <div class="rounded-lg border border-border overflow-hidden bg-surface">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead>
                                    <tr class="bg-bg border-b border-border text-text-muted font-mono uppercase text-[11px]">
                                        <th class="py-2.5 px-4 font-semibold">Workflow Dimension</th>
                                        <th class="py-2.5 px-4 font-semibold text-accent"><i class="fas fa-list-ol mr-1.5"></i> AniRanker</th>
                                        <th class="py-2.5 px-4 font-semibold text-text-primary"><i class="fas fa-th-large mr-1.5"></i> AniTierlist</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-border text-text-muted">
                                    <tr>
                                        <td class="py-2.5 px-4 font-medium text-text-primary">Primary Goal</td>
                                        <td class="py-2.5 px-4">Definitive 1st to Nth rank order</td>
                                        <td class="py-2.5 px-4">Categorized grouping (S/A/B/C/D/F)</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 px-4 font-medium text-text-primary">Ordering Logic</td>
                                        <td class="py-2.5 px-4">Strict linear priority with auto-renumbering</td>
                                        <td class="py-2.5 px-4">Flexible tier rows with staging pool</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 px-4 font-medium text-text-primary">Visual Output</td>
                                        <td class="py-2.5 px-4">Poster grid with numbered rank stamps</td>
                                        <td class="py-2.5 px-4">Color-coded tier matrix board</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 px-4 font-medium text-text-primary">Best Suited For</td>
                                        <td class="py-2.5 px-4">Top 10/25 Anime of All Time, Character showdowns</td>
                                        <td class="py-2.5 px-4">Seasonal overviews, franchise rosters, genre tiers</td>
                                    </tr>
                                    <tr>
                                        <td class="py-2.5 px-4 font-medium text-text-primary">Persistence</td>
                                        <td class="py-2.5 px-4 font-mono text-[11px]">localStorage (client-side)</td>
                                        <td class="py-2.5 px-4 font-mono text-[11px]">localStorage (client-side)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <!-- FOOTER -->
                <footer class="pt-6 pb-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
                    <div class="flex items-center gap-2">
                        <div class="w-5 h-5 rounded-md bg-accent flex items-center justify-center text-accent-fg text-[10px] font-bold">
                            <i class="fas fa-layer-group"></i>
                        </div>
                        <span class="font-semibold text-text-primary">AniHub</span>
                        <span>•</span>
                        <span>Open source curation suite</span>
                    </div>

                    <div class="flex items-center gap-6">
                        <a href="#/ranker" class="hover:text-text-primary transition-colors">AniRanker</a>
                        <a href="#/tierlist" class="hover:text-text-primary transition-colors">AniTierlist</a>
                        <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" class="hover:text-accent transition-colors flex items-center gap-1">
                            <span>Powered by AniList</span>
                            <i class="fas fa-external-link-alt text-[9px]"></i>
                        </a>
                    </div>
                </footer>
            </div>
        `;

        bindLandingEvents(container);
    }

    function renderActiveSessionBanner(stats, hasActiveSession) {
        if (!hasActiveSession) return '';

        return `
            <section id="active-session-section" class="mb-8 animate-fade-in">
                <div class="p-4 sm:p-5 rounded-lg bg-surface border border-border">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        
                        <!-- Title & Info -->
                        <div class="flex items-start sm:items-center gap-3">
                            <div class="w-8 h-8 rounded-md bg-bg border border-border text-accent flex items-center justify-center text-xs shrink-0 mt-0.5 sm:mt-0">
                                <i class="fas fa-history"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h3 class="font-bold text-sm text-text-primary">Active Curation Session</h3>
                                    <span class="font-mono text-[10px] font-semibold px-1.5 py-0.2 rounded bg-bg border border-border text-accent">SAVED</span>
                                </div>
                                <p class="font-mono text-xs text-text-muted mt-0.5">
                                    ${stats.rankerCount > 0 ? `${stats.rankerCount} in Ranker` : ''}
                                    ${stats.rankerCount > 0 && stats.tierCount > 0 ? ' • ' : ''}
                                    ${stats.tierCount > 0 ? `${stats.tierCount} in Tierlist` : ''}
                                    ${stats.poolCount > 0 ? ` (+${stats.poolCount} unranked)` : ''}
                                </p>
                            </div>
                        </div>

                        <!-- Mini Cover Row & Quick Actions -->
                        <div class="flex items-center gap-3">
                            <!-- Thumbnail Preview Row -->
                            <div class="hidden sm:flex items-center -space-x-1.5 overflow-hidden py-0.5">
                                ${stats.rankerItems.slice(0, 4).map(item => `
                                    <img src="${item.image}" alt="${item.title}" class="inline-block h-8 w-6 rounded-sm object-cover border border-border" title="${item.title}" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                `).join('')}
                                ${stats.tierItems.slice(0, 2).map(item => `
                                    <img src="${item.image}" alt="${item.title}" class="inline-block h-8 w-6 rounded-sm object-cover border border-border" title="${item.title}" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                `).join('')}
                            </div>

                            <!-- Buttons -->
                            <div class="flex items-center gap-2">
                                ${stats.rankerCount > 0 ? `
                                    <a href="#/ranker" class="h-8 px-3 rounded-md bg-accent text-accent-fg text-xs font-medium hover:bg-accent-hover transition-colors flex items-center gap-1.5">
                                        <span>Resume Ranker</span>
                                        <i class="fas fa-arrow-right text-[9px]"></i>
                                    </a>
                                ` : ''}

                                ${stats.tierCount > 0 || stats.poolCount > 0 ? `
                                    <a href="#/tierlist" class="h-8 px-3 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5">
                                        <span>Resume Tierlist</span>
                                        <i class="fas fa-arrow-right text-[9px]"></i>
                                    </a>
                                ` : ''}

                                <button id="btn-clear-session" class="h-8 w-8 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-rose-400 hover:border-rose-400/40 flex items-center justify-center transition-colors" title="Clear Active Lists">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function bindLandingEvents(container) {
        // Demo Data Loader Button
        const demoBtn = container.querySelector('#hero-demo-btn');
        if (demoBtn) {
            demoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const state = window.AniHub.state;
                if (!state) return;

                // Load demo items into Ranker
                state.setRankerItems([...DEMO_ITEMS]);

                // Load demo items into Tierlist: 2 in S, 2 in A, 2 in B
                const currentTiers = (state.tierlistTiers && state.tierlistTiers.length >= 3)
                    ? state.tierlistTiers.map(t => ({ ...t, items: [] }))
                    : [
                        { name: 'S', color: '#fe769b', items: [] },
                        { name: 'A', color: '#ffffa6', items: [] },
                        { name: 'B', color: '#9df79d', items: [] },
                        { name: 'C', color: '#76f8f8', items: [] }
                    ];

                currentTiers[0].items = [DEMO_ITEMS[0], DEMO_ITEMS[1]];
                currentTiers[1].items = [DEMO_ITEMS[2], DEMO_ITEMS[3]];
                currentTiers[2].items = [DEMO_ITEMS[4], DEMO_ITEMS[5]];

                state.setTierlistTiers(currentTiers);
                state.setTierlistPool([]);

                // Toast notification with fallback
                try {
                    if (window.AniHub.toast) {
                        if (typeof window.AniHub.toast.success === 'function') {
                            window.AniHub.toast.success('Curated sample data loaded into AniRanker and AniTierlist!');
                        } else if (typeof window.AniHub.toast.show === 'function') {
                            window.AniHub.toast.show('Curated sample data loaded into AniRanker and AniTierlist!', 'success');
                        }
                    }
                } catch (err) {
                    console.warn('Toast display failed:', err);
                }

                // Re-render landing view to immediately show active session banner
                renderLanding(container);

                // Smooth scroll to the active session banner
                const sessionBanner = container.querySelector('#active-session-section');
                if (sessionBanner) {
                    sessionBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }

        // Clear Session Button
        const clearBtn = container.querySelector('#btn-clear-session');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to clear your active curation lists? This cannot be undone.')) {
                    const state = window.AniHub.state;
                    if (state) {
                        state.setRankerItems([]);
                        state.setTierlistPool([]);
                        const emptyTiers = (state.tierlistTiers || []).map(t => ({ ...t, items: [] }));
                        state.setTierlistTiers(emptyTiers);
                    }

                    try {
                        if (window.AniHub.toast) {
                            if (typeof window.AniHub.toast.info === 'function') {
                                window.AniHub.toast.info('Active curation data cleared.');
                            } else if (typeof window.AniHub.toast.show === 'function') {
                                window.AniHub.toast.show('Active curation data cleared.', 'info');
                            }
                        }
                    } catch (err) {
                        console.warn('Toast display failed:', err);
                    }

                    renderLanding(container);
                }
            });
        }
    }

    window.AniHub.views.landing = {
        render: renderLanding
    };
})();

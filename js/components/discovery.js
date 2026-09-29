/**
 * AniHub Unified Discovery Engine
 * Shared, state-aware discovery component supporting:
 * 1. Database Search (Anime, Manga, Characters by Name or Series)
 * 2. AniList Profile Sync (Watchlists, status & score filters) - with Universal Username
 * 3. Seasonal Browser (Season, Year, AniList user filter) - with Universal Username
 * 4. Custom Upload & Direct Image URL (with interactive "Release now" dropzone)
 */

window.AniHub = window.AniHub || {};
window.AniHub.components = window.AniHub.components || {};

(function() {
    const STATE_KEY_DISCOVERY_TAB = 'anihub_discovery_tab';

    class DiscoveryEngine {
        constructor() {
            this.container = null;
            this.targetDestination = 'auto'; // 'ranker' | 'tierlist' | 'both' | 'auto'
            this.activeTab = 'search'; // 'search' | 'sync' | 'seasons' | 'custom'

            // Search state
            this.searchType = 'ANIME'; // 'ANIME' | 'MANGA' | 'CHARACTER'
            this.charSearchMode = 'NAME'; // 'NAME' | 'SERIES'
            this.charGender = 'all';
            this.searchSort = 'SEARCH_MATCH';
            this.searchFormat = 'all';
            this.searchResults = [];
            this.seriesResults = [];
            this.activeSeries = null;
            this.currentQuery = '';

            // Universal Username synced with state
            const stateUser = (window.AniHub.state && window.AniHub.state.username) || localStorage.getItem('anihub_username') || localStorage.getItem('anihub_last_sync_username') || '';
            this.universalUsername = stateUser;

            // Sync state
            this.syncType = 'ANIME';
            this.syncStatus = 'all';
            this.syncSort = 'TITLE';
            this.syncMinScore = 0;
            this.syncRawEntries = [];
            this.syncFilteredEntries = [];

            // Seasons state
            const current = window.AniHub.api ? window.AniHub.api.getCurrentSeasonAndYear() : { season: 'WINTER', year: 2026 };
            this.seasonValue = current.season;
            this.seasonYear = current.year;
            this.seasonFormat = 'all';
            this.seasonStatus = 'all';
            this.seasonSort = 'POPULARITY';
            this.seasonSortDir = 'DESC';
            this.seasonTitleFilter = '';
            this.seasonWatchlistFilterActive = false;
            this.seasonRawResults = [];
            this.seasonFilteredResults = [];

            // Custom Upload state
            this.stagedCustomItems = [];
            this.dragCounter = 0;

            // Loading & Error States
            this.isLoading = false;
            this.loadingMessage = '';
            this.errorMessage = null;

            // Debounced search handler
            this.debouncedSearch = window.AniHub.api ? window.AniHub.api.debounce(() => this.executeSearch(), 400) : null;

            // Listen to global username and avatar changes
            if (window.AniHub.state) {
                window.AniHub.state.on('usernameChange', (newUsername) => {
                    this.universalUsername = newUsername;
                    this.syncUsernameInputs();
                });
                window.AniHub.state.on('userAvatarChange', () => {
                    this.syncUsernameInputs();
                });
            }
        }

        getEffectiveDestination() {
            if (this.targetDestination !== 'auto') {
                return this.targetDestination;
            }
            const hash = window.location.hash || '';
            if (hash.startsWith('#/tierlist')) return 'tierlist';
            return 'ranker';
        }

        mount(containerEl, options = {}) {
            this.container = containerEl;
            if (options.targetDestination) {
                this.targetDestination = options.targetDestination;
            }

            const savedTab = localStorage.getItem(STATE_KEY_DISCOVERY_TAB);
            if (savedTab && ['search', 'sync', 'seasons', 'custom'].includes(savedTab)) {
                this.activeTab = savedTab;
            }

            this.render();
            this.bindEvents();

            // Run initial discovery if empty
            if (this.searchResults.length === 0 && this.activeTab === 'search') {
                this.executeSearch('trending');
            }
        }

        // ==========================================
        // RENDER APPLICATION SHELL
        // ==========================================

        render() {
            if (!this.container) return;
            const effectiveDest = this.getEffectiveDestination();
            const username = this.universalUsername;
            const userAvatar = window.AniHub.state ? window.AniHub.state.userAvatar : '';

            this.container.innerHTML = `
                <div class="discovery-root bg-surface rounded-lg border border-border shadow-soft overflow-hidden">
                    <!-- Discovery Header Bar -->
                    <div class="px-4 sm:px-5 py-3 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface">
                        <div class="flex items-center gap-2.5">
                            <div class="w-7 h-7 rounded-md bg-accent text-accent-fg flex items-center justify-center text-xs font-bold shrink-0">
                                <i class="fas fa-compass"></i>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-sm font-bold text-text-primary tracking-tight">Discovery & Ingestion Engine</h2>
                                    <span class="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-bg border border-border text-accent">Unified Core</span>
                                </div>
                                <p class="text-xs text-text-muted">Search database, sync AniList profile, explore seasonal releases, or upload custom media.</p>
                            </div>
                        </div>

                        <!-- Right Control Group: Universal User & Target Workspace -->
                        <div class="flex flex-wrap items-center gap-2">
                            <!-- Universal User Pill -->
                            <div class="flex items-center gap-2 bg-bg px-2.5 py-1 rounded-md border border-border text-xs">
                                <span id="header-universal-user-avatar" class="w-4 h-4 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center shrink-0">
                                    ${userAvatar ? `
                                        <img src="${userAvatar}" alt="${username}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user text-accent text-[8px]\\'></i>';">
                                    ` : `
                                        <i class="fas fa-user text-accent text-[8px]"></i>
                                    `}
                                </span>
                                <span class="text-[11px] text-text-muted font-medium">User:</span>
                                <span id="header-universal-user" class="font-mono text-xs font-bold text-text-primary">${username ? `@${username}` : '<span class="italic text-text-muted">Not set</span>'}</span>
                                <button id="btn-edit-universal-user" class="text-text-muted hover:text-accent transition-colors ml-1 p-0.5" title="Set Universal AniList Username">
                                    <i class="fas fa-pen text-[10px]"></i>
                                </button>
                            </div>

                            <!-- Target Destination Selector -->
                            <div class="flex items-center gap-1 bg-bg p-0.5 rounded-md border border-border">
                                <span class="text-[11px] font-medium text-text-muted px-1.5 flex items-center gap-1">
                                    <i class="fas fa-bullseye text-[10px] text-accent"></i> Target:
                                </span>
                                <button id="dest-btn-ranker" class="dest-toggle-btn px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${effectiveDest === 'ranker' ? 'bg-surface-active text-text-primary border border-border font-bold shadow-xs' : 'text-text-muted hover:text-text-primary'}">
                                    <i class="fas fa-list-ol mr-1"></i> Ranker
                                </button>
                                <button id="dest-btn-tierlist" class="dest-toggle-btn px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${effectiveDest === 'tierlist' ? 'bg-surface-active text-text-primary border border-border font-bold shadow-xs' : 'text-text-muted hover:text-text-primary'}">
                                    <i class="fas fa-th-large mr-1"></i> Tierlist
                                </button>
                                <button id="dest-btn-both" class="dest-toggle-btn px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${effectiveDest === 'both' ? 'bg-surface-active text-text-primary border border-border font-bold shadow-xs' : 'text-text-muted hover:text-text-primary'}">
                                    <i class="fas fa-layer-group mr-1"></i> Both
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation Tabs (Segmented Control Layout like Hub | AniRanker | AniTierlist) -->
                    <div class="px-4 sm:px-5 py-2.5 border-b border-border bg-surface overflow-x-auto custom-scrollbar">
                        <nav class="inline-flex items-center p-0.5 bg-bg rounded-md border border-border">
                            <button class="discovery-tab-btn h-7 px-3 rounded-md text-xs transition-colors shrink-0 flex items-center gap-2 ${this.activeTab === 'search' ? 'font-semibold bg-surface text-text-primary border border-border shadow-xs' : 'font-medium text-text-muted hover:text-text-primary'}" data-tab="search">
                                <i class="fas fa-search text-xs w-4 h-4 flex items-center justify-center"></i>
                                <span>Database Search</span>
                            </button>
                            <button class="discovery-tab-btn h-7 px-3 rounded-md text-xs transition-colors shrink-0 flex items-center gap-2 ${this.activeTab === 'sync' ? 'font-semibold bg-surface text-text-primary border border-border shadow-xs' : 'font-medium text-text-muted hover:text-text-primary'}" data-tab="sync">
                                <i class="fas fa-sync-alt text-xs w-4 h-4 flex items-center justify-center"></i>
                                <span>AniList Profile Sync</span>
                            </button>
                            <button class="discovery-tab-btn h-7 px-3 rounded-md text-xs transition-colors shrink-0 flex items-center gap-2 ${this.activeTab === 'seasons' ? 'font-semibold bg-surface text-text-primary border border-border shadow-xs' : 'font-medium text-text-muted hover:text-text-primary'}" data-tab="seasons">
                                <i class="fas fa-calendar-alt text-xs w-4 h-4 flex items-center justify-center"></i>
                                <span>Seasonal Browser</span>
                            </button>
                            <button class="discovery-tab-btn h-7 px-3 rounded-md text-xs transition-colors shrink-0 flex items-center gap-2 ${this.activeTab === 'custom' ? 'font-semibold bg-surface text-text-primary border border-border shadow-xs' : 'font-medium text-text-muted hover:text-text-primary'}" data-tab="custom">
                                <i class="fas fa-cloud-upload-alt text-xs w-4 h-4 flex items-center justify-center"></i>
                                <span>Custom Upload & URL</span>
                            </button>
                        </nav>
                    </div>

                    <!-- Tab Panels Area -->
                    <div class="p-4 sm:p-5 bg-bg/50">
                        <div id="tab-panel-content">
                            ${this.renderActiveTabContent()}
                        </div>
                    </div>

                    <!-- Results Output & Controls Header -->
                    <div id="discovery-results-section" class="border-t border-border px-4 sm:px-5 py-3.5 bg-surface">
                        ${this.renderResultsSectionHeader()}
                        <div id="discovery-results-container" class="mt-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            ${this.renderResultsList()}
                        </div>
                    </div>
                </div>
            `;
        }

        // ==========================================
        // TAB PANELS CONTENT
        // ==========================================

        renderActiveTabContent() {
            switch (this.activeTab) {
                case 'search':
                    return this.renderSearchTab();
                case 'sync':
                    return this.renderSyncTab();
                case 'seasons':
                    return this.renderSeasonsTab();
                case 'custom':
                    return this.renderCustomTab();
                default:
                    return '';
            }
        }

        renderSearchTab() {
            return `
                <div class="space-y-3.5">
                    <!-- Top Controls: Type Buttons & Character Sub-Mode -->
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-1 bg-bg p-0.5 rounded-md border border-border">
                            <button id="search-type-anime" class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${this.searchType === 'ANIME' ? 'bg-surface-active text-text-primary border border-border shadow-xs font-bold' : 'text-text-muted hover:text-text-primary'}">
                                <i class="fas fa-tv mr-1.5 text-xs"></i> Anime
                            </button>
                            <button id="search-type-manga" class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${this.searchType === 'MANGA' ? 'bg-surface-active text-text-primary border border-border shadow-xs font-bold' : 'text-text-muted hover:text-text-primary'}">
                                <i class="fas fa-book-open mr-1.5 text-xs"></i> Manga
                            </button>
                            <button id="search-type-character" class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${this.searchType === 'CHARACTER' ? 'bg-surface-active text-text-primary border border-border shadow-xs font-bold' : 'text-text-muted hover:text-text-primary'}">
                                <i class="fas fa-user-astronaut mr-1.5 text-xs"></i> Characters
                            </button>
                        </div>

                        ${this.searchType === 'CHARACTER' ? `
                            <div class="flex items-center gap-1 bg-bg p-0.5 rounded-md border border-border">
                                <span class="text-[11px] font-medium text-text-muted pl-2">Mode:</span>
                                <button id="char-mode-name" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${this.charSearchMode === 'NAME' ? 'bg-surface-active text-accent border border-border font-bold' : 'text-text-muted hover:text-text-primary'}">
                                    <i class="fas fa-signature mr-1 text-xs"></i> By Name
                                </button>
                                <button id="char-mode-series" class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${this.charSearchMode === 'SERIES' ? 'bg-surface-active text-accent border border-border font-bold' : 'text-text-muted hover:text-text-primary'}">
                                    <i class="fas fa-film mr-1 text-xs"></i> By Series
                                </button>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Search Input Bar & Filter Bar -->
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                        <div class="md:col-span-6 lg:col-span-7 relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                                <i class="fas fa-search text-xs"></i>
                            </div>
                            <input
                                type="text"
                                id="discovery-search-input"
                                value="${this.currentQuery || ''}"
                                placeholder="${this.searchType === 'CHARACTER' ? (this.charSearchMode === 'SERIES' ? 'Enter series title (e.g. Attack on Titan, Naruto, Bleach)...' : 'Search character name (e.g. Gojo Satoru, Levi, Makima)...') : `Search ${this.searchType.toLowerCase()} title (e.g. Frieren, Death Note)...`}"
                                class="w-full h-8 pl-8 pr-16 rounded-md bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors shadow-xs"
                            >
                            <div class="absolute inset-y-0 right-1 flex items-center gap-1">
                                ${this.currentQuery ? `
                                    <button id="search-clear-btn" class="h-6 w-6 text-text-muted hover:text-text-primary text-xs rounded-md flex items-center justify-center" title="Clear">
                                        <i class="fas fa-times"></i>
                                    </button>
                                ` : ''}
                                <button id="search-submit-btn" class="h-6 px-2.5 bg-accent text-accent-fg text-xs font-bold rounded-md hover:opacity-90 transition-opacity shadow-xs">
                                    Search
                                </button>
                            </div>
                        </div>

                        <!-- Filters Dropdowns -->
                        <div class="md:col-span-6 lg:col-span-5 flex items-center gap-2">
                            ${this.searchType === 'CHARACTER' ? `
                                <div class="flex-1">
                                    <select id="filter-char-gender" class="w-full h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent">
                                        <option value="all" ${this.charGender === 'all' ? 'selected' : ''}>All Genders</option>
                                        <option value="male" ${this.charGender === 'male' ? 'selected' : ''}>Male Only</option>
                                        <option value="female" ${this.charGender === 'female' ? 'selected' : ''}>Female Only</option>
                                    </select>
                                </div>
                            ` : `
                                <div class="flex-1">
                                    <select id="filter-search-format" class="w-full h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent">
                                        <option value="all" ${this.searchFormat === 'all' ? 'selected' : ''}>All Formats</option>
                                        ${this.searchType === 'ANIME' ? `
                                            <option value="TV" ${this.searchFormat === 'TV' ? 'selected' : ''}>TV Show</option>
                                            <option value="MOVIE" ${this.searchFormat === 'MOVIE' ? 'selected' : ''}>Movie</option>
                                            <option value="OVA" ${this.searchFormat === 'OVA' ? 'selected' : ''}>OVA</option>
                                            <option value="ONA" ${this.searchFormat === 'ONA' ? 'selected' : ''}>ONA</option>
                                            <option value="SPECIAL" ${this.searchFormat === 'SPECIAL' ? 'selected' : ''}>Special</option>
                                        ` : `
                                            <option value="MANGA" ${this.searchFormat === 'MANGA' ? 'selected' : ''}>Manga</option>
                                            <option value="NOVEL" ${this.searchFormat === 'NOVEL' ? 'selected' : ''}>Light Novel</option>
                                            <option value="ONE_SHOT" ${this.searchFormat === 'ONE_SHOT' ? 'selected' : ''}>One Shot</option>
                                        `}
                                    </select>
                                </div>
                            `}

                            <div class="flex-1">
                                <select id="filter-search-sort" class="w-full h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent">
                                    <option value="SEARCH_MATCH" ${this.searchSort === 'SEARCH_MATCH' ? 'selected' : ''}>Relevance</option>
                                    <option value="POPULARITY_DESC" ${this.searchSort === 'POPULARITY_DESC' ? 'selected' : ''}>Most Popular</option>
                                    <option value="SCORE_DESC" ${this.searchSort === 'SCORE_DESC' ? 'selected' : ''}>Highest Score</option>
                                    <option value="TRENDING_DESC" ${this.searchSort === 'TRENDING_DESC' ? 'selected' : ''}>Trending</option>
                                    <option value="START_DATE_DESC" ${this.searchSort === 'START_DATE_DESC' ? 'selected' : ''}>Newest First</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    ${this.activeSeries ? `
                        <div class="flex items-center justify-between p-2.5 rounded-md bg-surface border border-border text-xs">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-accent">Selected Series:</span>
                                <span class="font-bold text-text-primary">${this.activeSeries.title}</span>
                                <span class="text-text-muted font-mono text-[11px]">(${this.searchResults.length} characters)</span>
                            </div>
                            <button id="btn-back-to-series" class="h-7 px-2.5 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5">
                                <i class="fas fa-arrow-left text-xs"></i>
                                <span>Back to Series Results</span>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        renderSyncTab() {
            return `
                <div class="space-y-3.5">
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                        <!-- Universal Profile Card -->
                        <div class="md:col-span-4 flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-surface border border-border shadow-xs">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div class="w-7 h-7 rounded-md bg-bg border border-border text-accent flex items-center justify-center text-xs shrink-0">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="min-w-0">
                                    <span class="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Universal Profile</span>
                                    <span class="font-mono text-xs font-bold text-text-primary truncate block">
                                        ${this.universalUsername ? `@${this.universalUsername}` : '<span class="italic text-text-muted font-normal">Not configured</span>'}
                                    </span>
                                </div>
                            </div>
                            <button id="btn-sync-change-user" class="text-xs text-accent font-bold hover:underline shrink-0 px-2 py-1">
                                ${this.universalUsername ? 'Change' : 'Set User'}
                            </button>
                        </div>

                        <div class="md:col-span-8 flex flex-wrap items-center gap-2">
                            <div class="flex items-center gap-1 bg-bg p-0.5 rounded-md border border-border">
                                <button id="sync-type-anime" class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${this.syncType === 'ANIME' ? 'bg-surface-active text-text-primary border border-border shadow-xs font-bold' : 'text-text-muted hover:text-text-primary'}">
                                    Anime
                                </button>
                                <button id="sync-type-manga" class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${this.syncType === 'MANGA' ? 'bg-surface-active text-text-primary border border-border shadow-xs font-bold' : 'text-text-muted hover:text-text-primary'}">
                                    Manga
                                </button>
                            </div>

                            <select id="filter-sync-status" class="h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent">
                                <option value="all" ${this.syncStatus === 'all' ? 'selected' : ''}>All Statuses</option>
                                <option value="CURRENT" ${this.syncStatus === 'CURRENT' ? 'selected' : ''}>Watching / Reading</option>
                                <option value="COMPLETED" ${this.syncStatus === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                                <option value="PLANNING" ${this.syncStatus === 'PLANNING' ? 'selected' : ''}>Planning</option>
                                <option value="PAUSED" ${this.syncStatus === 'PAUSED' ? 'selected' : ''}>Paused</option>
                                <option value="DROPPED" ${this.syncStatus === 'DROPPED' ? 'selected' : ''}>Dropped</option>
                            </select>

                            <select id="filter-sync-sort" class="h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent">
                                <option value="SCORE" ${this.syncSort === 'SCORE' ? 'selected' : ''}>Your Score</option>
                                <option value="TITLE" ${this.syncSort === 'TITLE' ? 'selected' : ''}>Title</option>
                                <option value="YEAR" ${this.syncSort === 'YEAR' ? 'selected' : ''}>Release Year</option>
                                <option value="POPULARITY" ${this.syncSort === 'POPULARITY' ? 'selected' : ''}>Popularity</option>
                            </select>

                            <button id="btn-execute-sync" class="h-8 px-3.5 bg-accent text-accent-fg text-xs font-bold rounded-md hover:opacity-90 transition-opacity shadow-xs flex items-center gap-1.5 ml-auto">
                                <i class="fas fa-sync-alt text-xs"></i>
                                <span>Sync Profile</span>
                            </button>
                        </div>
                    </div>

                    ${this.syncRawEntries.length > 0 ? `
                        <div class="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border font-mono">
                            <span>Synced <strong>${this.syncRawEntries.length}</strong> items for <strong>@${this.universalUsername}</strong></span>
                            <span>Showing <strong>${this.syncFilteredEntries.length}</strong> matching current filters</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        renderSeasonsTab() {
            return `
                <div class="space-y-3.5">
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-end">
                        <!-- Season Selector -->
                        <div class="md:col-span-3">
                            <label class="block text-[11px] font-medium text-text-muted mb-1">Season</label>
                            <select id="season-select" class="w-full h-9 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent shadow-xs">
                                <option value="WINTER" ${this.seasonValue === 'WINTER' ? 'selected' : ''}>Winter</option>
                                <option value="SPRING" ${this.seasonValue === 'SPRING' ? 'selected' : ''}>Spring</option>
                                <option value="SUMMER" ${this.seasonValue === 'SUMMER' ? 'selected' : ''}>Summer</option>
                                <option value="FALL" ${this.seasonValue === 'FALL' ? 'selected' : ''}>Fall</option>
                            </select>
                        </div>

                        <!-- Year Input -->
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-medium text-text-muted mb-1">Year</label>
                            <input
                                type="number"
                                id="season-year-input"
                                value="${this.seasonYear}"
                                min="1960"
                                max="2035"
                                class="w-full h-9 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent shadow-xs"
                            >
                        </div>

                        <!-- Universal Watchlist Filter Toggle -->
                        <div class="md:col-span-4">
                            <label class="block text-[11px] font-medium text-text-muted mb-1">Watchlist Filter</label>
                            <label class="flex items-center gap-2.5 px-3 rounded-md bg-surface border border-border cursor-pointer hover:border-accent/50 transition-colors w-full h-9 shadow-xs">
                                <input type="checkbox" id="season-watchlist-toggle" class="w-4 h-4 rounded text-accent focus:ring-accent border-border shrink-0" ${this.seasonWatchlistFilterActive ? 'checked' : ''}>
                                <div class="min-w-0 flex-1 flex flex-col justify-center">
                                    <span class="text-xs font-semibold text-text-primary leading-tight truncate">Filter by My Watchlist</span>
                                    <span class="text-[10px] text-text-muted leading-tight truncate">
                                        ${this.universalUsername ? `Only show anime on @${this.universalUsername}'s list` : '<span class="italic text-text-muted font-normal">Click to set universal user</span>'}
                                    </span>
                                </div>
                            </label>
                        </div>

                        <!-- Execute Button -->
                        <div class="md:col-span-3">
                            <label class="block text-[11px] font-medium text-transparent mb-1 select-none pointer-events-none hidden md:block">&nbsp;</label>
                            <button id="btn-fetch-season" class="w-full h-9 bg-accent hover:bg-accent-hover text-accent-fg text-xs font-bold rounded-md transition-colors shadow-xs flex items-center justify-center gap-1.5">
                                <i class="fas fa-compass text-xs"></i>
                                <span>Browse Season</span>
                            </button>
                        </div>
                    </div>

                    <!-- Secondary Seasonal Filters: Title Search, Format, Airing Status, and Sorting -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-center pt-2 border-t border-border">
                        <!-- Instant In-Season Title Search -->
                        <div class="md:col-span-4 relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                                <i class="fas fa-search text-xs"></i>
                            </div>
                            <input
                                type="text"
                                id="season-title-filter-input"
                                value="${this.seasonTitleFilter || ''}"
                                placeholder="Filter season titles (instant)..."
                                class="w-full h-8 pl-8 pr-3 rounded-md bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent shadow-xs"
                            >
                        </div>

                        <!-- Format Filter -->
                        <div class="md:col-span-3">
                            <select id="season-format-filter" class="w-full h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent shadow-xs">
                                <option value="all" ${this.seasonFormat === 'all' ? 'selected' : ''}>All Formats</option>
                                <option value="TV" ${this.seasonFormat === 'TV' ? 'selected' : ''}>TV Show</option>
                                <option value="MOVIE" ${this.seasonFormat === 'MOVIE' ? 'selected' : ''}>Movie</option>
                                <option value="TV_SHORT" ${this.seasonFormat === 'TV_SHORT' ? 'selected' : ''}>TV Short</option>
                                <option value="OVA" ${this.seasonFormat === 'OVA' ? 'selected' : ''}>OVA</option>
                                <option value="ONA" ${this.seasonFormat === 'ONA' ? 'selected' : ''}>ONA</option>
                                <option value="SPECIAL" ${this.seasonFormat === 'SPECIAL' ? 'selected' : ''}>Special</option>
                            </select>
                        </div>

                        <!-- Status Filter -->
                        <div class="md:col-span-2">
                            <select id="season-status-filter" class="w-full h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent shadow-xs">
                                <option value="all" ${this.seasonStatus === 'all' ? 'selected' : ''}>All Statuses</option>
                                <option value="RELEASING" ${this.seasonStatus === 'RELEASING' ? 'selected' : ''}>Airing / Releasing</option>
                                <option value="FINISHED" ${this.seasonStatus === 'FINISHED' ? 'selected' : ''}>Finished</option>
                                <option value="NOT_YET_RELEASED" ${this.seasonStatus === 'NOT_YET_RELEASED' ? 'selected' : ''}>Not Yet Aired</option>
                            </select>
                        </div>

                        <!-- Sort By & Direction -->
                        <div class="md:col-span-3 flex items-center gap-1.5">
                            <select id="season-sort-filter" class="w-full h-8 px-2.5 rounded-md bg-surface border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent shadow-xs">
                                <option value="POPULARITY" ${this.seasonSort === 'POPULARITY' ? 'selected' : ''}>Most Popular</option>
                                <option value="SCORE" ${this.seasonSort === 'SCORE' ? 'selected' : ''}>Highest Score</option>
                                <option value="TRENDING" ${this.seasonSort === 'TRENDING' ? 'selected' : ''}>Trending</option>
                                <option value="TITLE" ${this.seasonSort === 'TITLE' ? 'selected' : ''}>Title (A-Z)</option>
                                <option value="START_DATE" ${this.seasonSort === 'START_DATE' ? 'selected' : ''}>Release Date</option>
                            </select>

                            <button id="btn-season-sort-dir" class="h-8 w-8 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary transition-colors text-xs flex items-center justify-center shrink-0 shadow-xs" title="Toggle Sort Direction (${this.seasonSortDir})">
                                <i class="fas fa-sort-amount-${this.seasonSortDir === 'ASC' ? 'up-alt' : 'down'} text-xs"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Quick Season Jump Pills -->
                    <div class="flex items-center gap-1.5 pt-2 border-t border-border overflow-x-auto custom-scrollbar">
                        <span class="font-mono text-[10px] uppercase font-bold text-text-muted tracking-wider">Quick Jump:</span>
                        <button class="quick-season-btn text-xs px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary font-mono transition-colors" data-season="WINTER" data-year="2026">Winter 2026</button>
                        <button class="quick-season-btn text-xs px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary font-mono transition-colors" data-season="SPRING" data-year="2026">Spring 2026</button>
                        <button class="quick-season-btn text-xs px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary font-mono transition-colors" data-season="FALL" data-year="2025">Fall 2025</button>
                        <button class="quick-season-btn text-xs px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary font-mono transition-colors" data-season="SUMMER" data-year="2025">Summer 2025</button>
                    </div>
                </div>
            `;
        }

        renderCustomTab() {
            return `
                <div class="space-y-4">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        <!-- Multi-File Drag & Drop Area with Interactive "Release Now" State -->
                        <div id="custom-dropzone" class="relative border border-dashed border-border hover:border-accent p-6 rounded-lg text-center bg-surface transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px] group overflow-hidden">
                            <input type="file" id="custom-file-input" multiple accept="image/*" class="hidden">
                            
                            <!-- Normal Dropzone Content -->
                            <div class="dropzone-normal flex flex-col items-center justify-center pointer-events-none">
                                <div class="w-8 h-8 rounded-md bg-bg border border-border text-accent flex items-center justify-center text-sm mb-2 transition-transform">
                                    <i class="fas fa-images"></i>
                                </div>
                                <h4 class="text-xs font-bold text-text-primary">Drag & drop image files here</h4>
                                <p class="text-[11px] text-text-muted mt-0.5">PNG, JPG, WebP, GIF supported. Multiple files allowed.</p>
                                <span class="mt-2.5 px-3 py-1 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-primary text-xs font-medium transition-colors pointer-events-auto">
                                    Browse Files
                                </span>
                            </div>

                            <!-- "Release Now" Drag-Over Overlay -->
                            <div class="dropzone-overlay absolute inset-0 bg-surface/95 backdrop-blur-xs flex flex-col items-center justify-center opacity-0 pointer-events-none transition-opacity duration-150">
                                <div class="w-10 h-10 rounded-md bg-accent text-accent-fg flex items-center justify-center text-lg mb-2 shadow-xs">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                </div>
                                <h3 class="text-xs font-bold text-text-primary tracking-wide">Release now to upload!</h3>
                                <p class="text-[11px] text-text-muted mt-0.5">Drop files to stage them instantly</p>
                            </div>
                        </div>

                        <!-- Direct URL Ingestion -->
                        <div class="p-4 rounded-lg bg-surface border border-border flex flex-col justify-between">
                            <div>
                                <h4 class="text-xs font-bold text-text-primary mb-2 flex items-center gap-1.5">
                                    <i class="fas fa-link text-accent"></i> Add Image by Direct URL
                                </h4>
                                <div class="space-y-2">
                                    <input
                                        type="url"
                                        id="custom-url-input"
                                        placeholder="https://example.com/image.jpg..."
                                        class="w-full h-8 px-2.5 rounded-md bg-bg border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                                    >
                                    <input
                                        type="text"
                                        id="custom-url-title"
                                        placeholder="Optional title / label..."
                                        class="w-full h-8 px-2.5 rounded-md bg-bg border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                                    >
                                </div>
                            </div>
                            <button id="btn-add-custom-url" class="mt-3 w-full h-8 bg-accent text-accent-fg text-xs font-bold rounded-md hover:opacity-90 transition-opacity shadow-xs flex items-center justify-center gap-1.5">
                                <i class="fas fa-plus text-xs"></i> Load & Stage Image
                            </button>
                        </div>
                    </div>

                    <!-- Staged Custom Uploads Strip -->
                    ${this.stagedCustomItems.length > 0 ? `
                        <div class="p-3.5 rounded-lg bg-surface border border-border">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <h4 class="text-xs font-bold text-text-primary">Staged Media (${this.stagedCustomItems.length})</h4>
                                    <span class="text-[10px] text-text-muted font-mono">Ready to ingest into active workspace</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button id="btn-clear-staged" class="px-2 py-1 text-xs text-text-muted hover:text-rose-400 font-medium transition-colors">
                                        Clear
                                    </button>
                                    <button id="btn-ingest-all-staged" class="h-7 px-3 bg-accent text-accent-fg text-xs font-bold rounded-md hover:opacity-90 transition-opacity shadow-xs flex items-center gap-1.5">
                                        <i class="fas fa-check-double text-xs"></i> Ingest All (${this.stagedCustomItems.length})
                                    </button>
                                </div>
                            </div>

                            <div class="flex flex-wrap gap-2">
                                ${this.stagedCustomItems.map((item, idx) => `
                                    <div class="w-20 rounded-md overflow-hidden border border-border bg-bg p-1 flex flex-col gap-1 relative group">
                                        <div class="aspect-[2/3] rounded-sm overflow-hidden bg-bg">
                                            <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                        </div>
                                        <input
                                            type="text"
                                            value="${item.title}"
                                            data-idx="${idx}"
                                            class="staged-title-input text-[10px] px-1 py-0.5 rounded-sm bg-surface border border-border text-text-primary truncate w-full font-mono"
                                            title="Click to rename"
                                        >
                                        <button data-idx="${idx}" class="btn-remove-staged absolute top-1.5 right-1.5 w-4 h-4 rounded-sm bg-black/80 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // ==========================================
        // RESULTS SECTION HEADER
        // ==========================================

        renderResultsSectionHeader() {
            const results = this.getActiveResultsList();
            const totalCount = results.length;

            return `
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-text-primary">
                            Results <span class="font-mono text-text-muted font-normal">(${totalCount})</span>
                        </span>
                        ${this.isLoading ? `
                            <span class="font-mono text-xs text-accent font-medium flex items-center gap-1.5 animate-pulse">
                                <i class="fas fa-circle-notch fa-spin text-xs"></i> ${this.loadingMessage || 'Loading...'}
                            </span>
                        ` : ''}
                    </div>

                    ${totalCount > 0 ? `
                        <button id="btn-add-all-results" class="h-7 px-2.5 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-primary hover:text-accent text-xs font-medium transition-colors flex items-center gap-1.5">
                            <i class="fas fa-plus-circle text-xs"></i>
                            <span>Add All Visible (${totalCount})</span>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // ==========================================
        // RESULTS LIST & CARDS
        // ==========================================

        getActiveResultsList() {
            if (this.activeTab === 'search') {
                if (this.searchType === 'CHARACTER' && this.charSearchMode === 'SERIES' && !this.activeSeries) {
                    return this.seriesResults;
                }
                return this.searchResults;
            }
            if (this.activeTab === 'sync') {
                return this.syncFilteredEntries;
            }
            if (this.activeTab === 'seasons') {
                return this.seasonFilteredResults;
            }
            if (this.activeTab === 'custom') {
                return this.stagedCustomItems;
            }
            return [];
        }

        renderResultsList() {
            if (this.isLoading && this.getActiveResultsList().length === 0) {
                return `
                    <div class="col-span-full py-16 text-center text-accent">
                        <i class="fas fa-circle-notch fa-spin text-2xl mb-2.5"></i>
                        <p class="font-mono text-xs font-medium text-text-muted">${this.loadingMessage || 'Fetching records from AniList...'}</p>
                    </div>
                `;
            }

            if (this.errorMessage) {
                return `
                    <div class="col-span-full py-8 px-4 rounded-md bg-surface border border-rose-500/30 text-center text-rose-400 text-xs">
                        <i class="fas fa-exclamation-triangle text-base mb-2"></i>
                        <p class="font-mono font-medium">${this.errorMessage}</p>
                    </div>
                `;
            }

            const results = this.getActiveResultsList();
            if (results.length === 0) {
                return `
                    <div class="col-span-full py-12 text-center text-text-muted">
                        <div class="w-8 h-8 rounded-md bg-bg border border-border flex items-center justify-center text-xs mx-auto mb-2.5 text-text-muted">
                            <i class="fas fa-inbox"></i>
                        </div>
                        <p class="text-xs font-medium text-text-primary">No media found matching current criteria</p>
                        <p class="text-[11px] text-text-muted mt-0.5">Try modifying your query or adjusting the filters above</p>
                    </div>
                `;
            }

            // Series selection cards
            if (this.activeTab === 'search' && this.searchType === 'CHARACTER' && this.charSearchMode === 'SERIES' && !this.activeSeries) {
                return results.map(series => this.renderSeriesCard(series)).join('');
            }

            return results.map(item => this.renderResultItem(item)).join('');
        }

        renderSeriesCard(series) {
            return `
                <div class="series-select-card bg-surface rounded-md overflow-hidden border border-border hover:border-accent transition-colors cursor-pointer group flex flex-col" data-series-id="${series.id}">
                    <div class="aspect-[2/3] overflow-hidden bg-bg relative">
                        <img src="${series.image}" alt="${series.title}" class="w-full h-full object-cover pointer-events-none" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-white text-center pointer-events-none">
                            <div>
                                <i class="fas fa-users text-lg mb-1"></i>
                                <p class="font-mono text-[10px] font-bold uppercase tracking-wider">Select Cast</p>
                            </div>
                        </div>
                    </div>
                    <div class="p-2 flex-1 flex flex-col justify-between">
                        <h4 class="text-xs font-medium text-text-primary truncate group-hover:text-accent transition-colors" title="${series.title}">${series.title}</h4>
                        <div class="mt-1 flex items-center justify-between font-mono text-[10px] text-text-muted">
                            <span>${series.format || 'Anime'}</span>
                            ${series.year ? `<span>${series.year}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        renderResultItem(item) {
            const state = window.AniHub.state;
            const effectiveDest = this.getEffectiveDestination();

            // Check if already in Ranker or Tierlist
            const isRanked = state && state.rankerItems && state.rankerItems.some(i => i.id === item.id);
            const rankIndex = isRanked ? state.rankerItems.findIndex(i => i.id === item.id) + 1 : null;

            let tierlistLocation = null;
            if (state) {
                if (state.tierlistPool && state.tierlistPool.some(i => i.id === item.id)) {
                    tierlistLocation = 'Pool';
                } else if (state.tierlistTiers) {
                    for (const t of state.tierlistTiers) {
                        if (t.items && t.items.some(i => i.id === item.id)) {
                            tierlistLocation = `${t.name} Tier`;
                            break;
                        }
                    }
                }
            }

            const isAlreadyAdded = (effectiveDest === 'ranker' && isRanked) ||
                                   (effectiveDest === 'tierlist' && tierlistLocation) ||
                                   (effectiveDest === 'both' && isRanked && tierlistLocation);

            // Responsive Card Grid
            return `
                <div class="result-item-card bg-surface border border-border hover:border-accent rounded-md overflow-hidden transition-colors group flex flex-col cursor-pointer relative" data-item-id="${item.id}">
                    <div class="aspect-[2/3] overflow-hidden bg-bg relative">
                        <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">

                        <!-- Overlay Badge Indicators -->
                        <div class="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10 pointer-events-none">
                            ${isRanked ? `<span class="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-accent text-accent-fg shadow-xs">#${rankIndex} Ranked</span>` : ''}
                            ${tierlistLocation ? `<span class="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-surface-active border border-border text-text-primary shadow-xs">${tierlistLocation}</span>` : ''}
                        </div>

                        ${item.score ? `
                            <div class="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                                <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-bg/90 border border-border text-accent shadow-xs flex items-center gap-1">
                                    <i class="fas fa-star text-[8px]"></i>${item.score}
                                </span>
                            </div>
                        ` : ''}

                        <!-- Hover Action Bar -->
                        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-2">
                            <button class="btn-add-item w-full h-7 rounded-sm ${isAlreadyAdded ? 'bg-surface-active text-text-primary border border-border' : 'bg-accent text-accent-fg'} text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                                <i class="fas ${isAlreadyAdded ? 'fa-check' : 'fa-plus'} text-[10px]"></i>
                                <span>${isAlreadyAdded ? 'Add Another' : 'Add to Workspace'}</span>
                            </button>
                        </div>
                    </div>

                    <div class="p-2 flex-1 flex flex-col justify-between">
                        <h4 class="text-xs font-medium text-text-primary truncate" title="${item.title}">${item.title}</h4>
                        <div class="mt-1 flex items-center justify-between font-mono text-[10px] text-text-muted">
                            <span class="truncate" title="${(item.type === 'CHARACTER' && item.seriesTitle) ? item.seriesTitle : (item.format || item.type || '')}">
                                ${(item.type === 'CHARACTER' && item.seriesTitle) ? item.seriesTitle : (item.format || item.type || '')}
                            </span>
                            ${item.year ? `<span>${item.year}</span>` : (item.gender ? `<span>${item.gender}</span>` : '')}
                        </div>
                    </div>
                </div>
            `;
        }

        // ==========================================
        // EVENTS AND INTERACTIONS
        // ==========================================

        bindEvents() {
            if (!this.container) return;

            // Universal Username Edit
            const editUserBtn = this.container.querySelector('#btn-edit-universal-user');
            if (editUserBtn) {
                editUserBtn.addEventListener('click', () => {
                    const entered = prompt('Enter your universal AniList username:', this.universalUsername || '');
                    if (entered !== null) {
                        this.setUniversalUsername(entered);
                    }
                });
            }

            // Target destination toggle
            const rankerBtn = this.container.querySelector('#dest-btn-ranker');
            const tierlistBtn = this.container.querySelector('#dest-btn-tierlist');
            const bothBtn = this.container.querySelector('#dest-btn-both');

            if (rankerBtn) rankerBtn.addEventListener('click', () => this.setTargetDestination('ranker'));
            if (tierlistBtn) tierlistBtn.addEventListener('click', () => this.setTargetDestination('tierlist'));
            if (bothBtn) bothBtn.addEventListener('click', () => this.setTargetDestination('both'));

            // Tab switching
            this.container.querySelectorAll('.discovery-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = btn.dataset.tab;
                    if (tab) this.switchTab(tab);
                });
            });

            // Search Tab Event Listeners
            this.bindSearchEvents();

            // Sync Tab Event Listeners
            this.bindSyncEvents();

            // Seasons Tab Event Listeners
            this.bindSeasonsEvents();

            // Custom Tab Event Listeners
            this.bindCustomEvents();

            // Results Click Delegation
            this.bindResultsDelegation();
        }

        setUniversalUsername(username) {
            const clean = (username || '').trim();
            this.universalUsername = clean;
            if (window.AniHub.state) {
                window.AniHub.state.setUsername(clean);
            }
            this.syncUsernameInputs();
            if (window.AniHub.toast) {
                window.AniHub.toast.info(clean ? `Universal AniList username set to @${clean}` : 'Universal username cleared');
            }
        }

        syncUsernameInputs() {
            if (!this.container) return;
            const headerEl = this.container.querySelector('#header-universal-user');
            if (headerEl) {
                headerEl.innerHTML = this.universalUsername ? `@${this.universalUsername}` : '<span class="italic text-text-muted">Not set</span>';
            }
            const avatarEl = this.container.querySelector('#header-universal-user-avatar');
            if (avatarEl) {
                const avatar = window.AniHub.state ? window.AniHub.state.userAvatar : '';
                avatarEl.innerHTML = avatar
                    ? `<img src="${avatar}" alt="${this.universalUsername}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user text-accent text-[8px]\\'></i>';">`
                    : `<i class="fas fa-user text-accent text-[8px]"></i>`;
            }
            if (this.activeTab === 'sync' || this.activeTab === 'seasons') {
                this.render();
                this.bindEvents();
            }
        }

        setTargetDestination(dest) {
            this.targetDestination = dest;
            this.render();
            this.bindEvents();
            if (window.AniHub.toast) {
                window.AniHub.toast.info(`Ingestion target set to ${dest.toUpperCase()}`);
            }
        }

        switchTab(tab) {
            this.activeTab = tab;
            localStorage.setItem(STATE_KEY_DISCOVERY_TAB, tab);
            this.errorMessage = null;
            this.render();
            this.bindEvents();

            if (tab === 'seasons' && this.seasonRawResults.length === 0) {
                this.executeSeasonSearch();
            }
        }

        // ==========================================
        // TAB-SPECIFIC BINDINGS & LOGIC
        // ==========================================

        bindSearchEvents() {
            // Type toggle buttons
            const animeBtn = this.container.querySelector('#search-type-anime');
            const mangaBtn = this.container.querySelector('#search-type-manga');
            const charBtn = this.container.querySelector('#search-type-character');

            if (animeBtn) animeBtn.addEventListener('click', () => {
                this.searchType = 'ANIME';
                this.activeSeries = null;
                this.render();
                this.bindEvents();
                this.executeSearch();
            });

            if (mangaBtn) mangaBtn.addEventListener('click', () => {
                this.searchType = 'MANGA';
                this.activeSeries = null;
                this.render();
                this.bindEvents();
                this.executeSearch();
            });

            if (charBtn) charBtn.addEventListener('click', () => {
                this.searchType = 'CHARACTER';
                this.activeSeries = null;
                this.render();
                this.bindEvents();
                this.executeSearch();
            });

            // Character mode toggle
            const nameModeBtn = this.container.querySelector('#char-mode-name');
            const seriesModeBtn = this.container.querySelector('#char-mode-series');

            if (nameModeBtn) nameModeBtn.addEventListener('click', () => {
                this.charSearchMode = 'NAME';
                this.activeSeries = null;
                this.render();
                this.bindEvents();
                this.executeSearch();
            });

            if (seriesModeBtn) seriesModeBtn.addEventListener('click', () => {
                this.charSearchMode = 'SERIES';
                this.activeSeries = null;
                this.render();
                this.bindEvents();
                this.executeSearch();
            });

            // Back from series cast
            const backBtn = this.container.querySelector('#btn-back-to-series');
            if (backBtn) backBtn.addEventListener('click', () => {
                this.activeSeries = null;
                this.render();
                this.bindEvents();
            });

            // Search input
            const input = this.container.querySelector('#discovery-search-input');
            const clearBtn = this.container.querySelector('#search-clear-btn');
            const submitBtn = this.container.querySelector('#search-submit-btn');

            if (input) {
                input.addEventListener('input', (e) => {
                    this.currentQuery = e.target.value;
                    if (this.debouncedSearch) this.debouncedSearch();
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.executeSearch();
                    }
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.currentQuery = '';
                    if (input) input.value = '';
                    this.executeSearch();
                });
            }

            if (submitBtn) {
                submitBtn.addEventListener('click', () => this.executeSearch());
            }

            // Filters
            const formatSelect = this.container.querySelector('#filter-search-format');
            if (formatSelect) {
                formatSelect.addEventListener('change', (e) => {
                    this.searchFormat = e.target.value;
                    this.executeSearch();
                });
            }

            const genderSelect = this.container.querySelector('#filter-char-gender');
            if (genderSelect) {
                genderSelect.addEventListener('change', (e) => {
                    this.charGender = e.target.value;
                    this.executeSearch();
                });
            }

            const sortSelect = this.container.querySelector('#filter-search-sort');
            if (sortSelect) {
                sortSelect.addEventListener('change', (e) => {
                    this.searchSort = e.target.value;
                    this.executeSearch();
                });
            }
        }

        async executeSearch(forceQuery = null) {
            const query = forceQuery !== null ? forceQuery : (this.currentQuery || '');
            this.isLoading = true;
            this.loadingMessage = `Searching AniList ${this.searchType.toLowerCase()}...`;
            this.errorMessage = null;
            this.updateResultsView();

            try {
                if (this.searchType === 'CHARACTER') {
                    if (this.charSearchMode === 'SERIES' && !this.activeSeries) {
                        const series = await window.AniHub.api.searchSeriesForCharacters({
                            query: query || 'Naruto',
                            type: 'ANIME'
                        });
                        this.seriesResults = series;
                    } else if (this.activeSeries) {
                        this.loadingMessage = `Fetching cast for "${this.activeSeries.title}"...`;
                        this.updateResultsView();
                        const cast = await window.AniHub.api.getCharactersBySeriesId({
                            seriesId: this.activeSeries.id,
                            seriesTitle: this.activeSeries.title,
                            gender: this.charGender
                        });
                        this.searchResults = cast.items;
                    } else {
                        const res = await window.AniHub.api.searchCharactersByName({
                            query: query || 'L',
                            gender: this.charGender,
                            sort: this.searchSort
                        });
                        this.searchResults = res.items;
                    }
                } else {
                    const res = await window.AniHub.api.searchMedia({
                        query,
                        type: this.searchType,
                        format: this.searchFormat,
                        sort: this.searchSort
                    });
                    this.searchResults = res.items;
                }
            } catch (err) {
                console.error('Search error:', err);
                this.errorMessage = err.message || 'Failed to search AniList database.';
            } finally {
                this.isLoading = false;
                this.updateResultsView();
            }
        }

        bindSyncEvents() {
            const changeUserBtn = this.container.querySelector('#btn-sync-change-user');
            const animeBtn = this.container.querySelector('#sync-type-anime');
            const mangaBtn = this.container.querySelector('#sync-type-manga');
            const statusFilter = this.container.querySelector('#filter-sync-status');
            const sortFilter = this.container.querySelector('#filter-sync-sort');
            const syncBtn = this.container.querySelector('#btn-execute-sync');

            if (changeUserBtn) {
                changeUserBtn.addEventListener('click', () => {
                    const entered = prompt('Set universal AniList username:', this.universalUsername || '');
                    if (entered !== null) {
                        this.setUniversalUsername(entered);
                    }
                });
            }

            if (animeBtn) animeBtn.addEventListener('click', () => {
                this.syncType = 'ANIME';
                this.render();
                this.bindEvents();
                if (this.universalUsername) this.executeSync();
            });

            if (mangaBtn) mangaBtn.addEventListener('click', () => {
                this.syncType = 'MANGA';
                this.render();
                this.bindEvents();
                if (this.universalUsername) this.executeSync();
            });

            if (statusFilter) statusFilter.addEventListener('change', (e) => {
                this.syncStatus = e.target.value;
                this.filterAndSortSyncEntries();
            });

            if (sortFilter) sortFilter.addEventListener('change', (e) => {
                this.syncSort = e.target.value;
                this.filterAndSortSyncEntries();
            });

            if (syncBtn) syncBtn.addEventListener('click', () => {
                if (!this.universalUsername) {
                    const entered = prompt('Please enter your universal AniList username to sync:', '');
                    if (entered !== null && entered.trim()) {
                        this.setUniversalUsername(entered);
                        this.executeSync();
                    }
                    return;
                }
                this.executeSync();
            });
        }

        async executeSync() {
            if (!this.universalUsername) {
                if (window.AniHub.toast) window.AniHub.toast.warning('Please set your universal AniList username first.');
                return;
            }

            this.isLoading = true;
            this.loadingMessage = `Syncing @${this.universalUsername}'s ${this.syncType.toLowerCase()} list...`;
            this.errorMessage = null;
            this.updateResultsView();

            try {
                const data = await window.AniHub.api.getUserList({
                    username: this.universalUsername,
                    type: this.syncType
                });

                this.syncRawEntries = data.entries || [];
                this.filterAndSortSyncEntries();

                if (window.AniHub.toast) {
                    window.AniHub.toast.success(`Successfully synced ${this.syncRawEntries.length} items from ${data.user?.name || this.universalUsername}!`);
                }
            } catch (err) {
                console.error('Sync error:', err);
                this.errorMessage = err.message || 'Failed to sync user list.';
            } finally {
                this.isLoading = false;
                this.render();
                this.bindEvents();
            }
        }

        filterAndSortSyncEntries() {
            let entries = [...this.syncRawEntries];

            if (this.syncStatus !== 'all') {
                entries = entries.filter(e => e.userStatus === this.syncStatus);
            }

            entries.sort((a, b) => {
                if (this.syncSort === 'SCORE') return (b.score || 0) - (a.score || 0);
                if (this.syncSort === 'YEAR') return (b.year || 0) - (a.year || 0);
                if (this.syncSort === 'POPULARITY') return (b.popularity || 0) - (a.popularity || 0);
                return (a.title || '').localeCompare(b.title || '');
            });

            this.syncFilteredEntries = entries;
            this.updateResultsView();
        }

        bindSeasonsEvents() {
            const seasonSelect = this.container.querySelector('#season-select');
            const yearInput = this.container.querySelector('#season-year-input');
            const watchlistToggle = this.container.querySelector('#season-watchlist-toggle');
            const fetchBtn = this.container.querySelector('#btn-fetch-season');
            const titleFilterInput = this.container.querySelector('#season-title-filter-input');
            const formatFilter = this.container.querySelector('#season-format-filter');
            const statusFilter = this.container.querySelector('#season-status-filter');
            const sortFilter = this.container.querySelector('#season-sort-filter');
            const sortDirBtn = this.container.querySelector('#btn-season-sort-dir');

            if (seasonSelect) seasonSelect.addEventListener('change', (e) => this.seasonValue = e.target.value);
            if (yearInput) yearInput.addEventListener('change', (e) => this.seasonYear = parseInt(e.target.value, 10) || 2026);
            
            if (watchlistToggle) {
                watchlistToggle.addEventListener('change', (e) => {
                    if (e.target.checked && !this.universalUsername) {
                        const entered = prompt('Enter your AniList username for watchlist filtering:');
                        if (entered !== null && entered.trim()) {
                            this.setUniversalUsername(entered);
                            this.seasonWatchlistFilterActive = true;
                        } else {
                            e.target.checked = false;
                            this.seasonWatchlistFilterActive = false;
                        }
                    } else {
                        this.seasonWatchlistFilterActive = e.target.checked;
                    }
                    if (this.seasonRawResults.length > 0) {
                        this.filterSeasonalResults();
                    }
                });
            }

            if (titleFilterInput) {
                titleFilterInput.addEventListener('input', (e) => {
                    this.seasonTitleFilter = e.target.value;
                    this.filterSeasonalResults();
                });
            }

            if (formatFilter) {
                formatFilter.addEventListener('change', (e) => {
                    this.seasonFormat = e.target.value;
                    this.filterSeasonalResults();
                });
            }

            if (statusFilter) {
                statusFilter.addEventListener('change', (e) => {
                    this.seasonStatus = e.target.value;
                    this.filterSeasonalResults();
                });
            }

            if (sortFilter) {
                sortFilter.addEventListener('change', (e) => {
                    this.seasonSort = e.target.value;
                    this.filterSeasonalResults();
                });
            }

            if (sortDirBtn) {
                sortDirBtn.addEventListener('click', () => {
                    this.seasonSortDir = this.seasonSortDir === 'DESC' ? 'ASC' : 'DESC';
                    sortDirBtn.title = `Toggle Sort Direction (${this.seasonSortDir})`;
                    sortDirBtn.innerHTML = `<i class="fas fa-sort-amount-${this.seasonSortDir === 'ASC' ? 'up-alt' : 'down'}"></i>`;
                    this.filterSeasonalResults();
                });
            }

            if (fetchBtn) {
                fetchBtn.addEventListener('click', () => {
                    this.executeSeasonSearch();
                });
            }

            this.container.querySelectorAll('.quick-season-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.seasonValue = btn.dataset.season;
                    this.seasonYear = parseInt(btn.dataset.year, 10);
                    this.render();
                    this.bindEvents();
                    this.executeSeasonSearch();
                });
            });
        }

        async executeSeasonSearch() {
            this.isLoading = true;
            this.loadingMessage = `Loading ${this.seasonValue} ${this.seasonYear} seasonal releases...`;
            this.errorMessage = null;
            this.updateResultsView();

            try {
                const results = await window.AniHub.api.getSeasonalAnime({
                    season: this.seasonValue,
                    year: this.seasonYear,
                    onProgress: ({ page, fetchedSoFar }) => {
                        this.loadingMessage = `Fetched ${fetchedSoFar} ${this.seasonValue} titles (Page ${page})...`;
                        this.updateResultsView();
                    }
                });

                this.seasonRawResults = results;
                await this.filterSeasonalResults();
            } catch (err) {
                console.error('Season search error:', err);
                this.errorMessage = err.message || 'Failed to fetch seasonal anime.';
            } finally {
                this.isLoading = false;
                this.updateResultsView();
            }
        }

        async filterSeasonalResults() {
            let filtered = [...this.seasonRawResults];

            // 1. User watchlist filter
            if (this.seasonWatchlistFilterActive && this.universalUsername) {
                this.loadingMessage = `Filtering by @${this.universalUsername}'s watchlist...`;
                this.updateResultsView();

                try {
                    const idSet = await window.AniHub.api.getUserMediaIdSet({
                        username: this.universalUsername,
                        type: 'ANIME'
                    });
                    filtered = filtered.filter(item => idSet.has(item.id));
                } catch (userErr) {
                    console.warn('Could not filter by user:', userErr);
                    if (window.AniHub.toast) {
                        window.AniHub.toast.warning(`Could not fetch @${this.universalUsername}'s list: ${userErr.message}`);
                    }
                }
            }

            // 2. Title search filter
            if (this.seasonTitleFilter) {
                const q = this.seasonTitleFilter.toLowerCase().trim();
                filtered = filtered.filter(item => {
                    const title = (item.title || '').toLowerCase();
                    const romaji = (item.titleDetails?.romaji || '').toLowerCase();
                    const native = (item.titleDetails?.native || '').toLowerCase();
                    return title.includes(q) || romaji.includes(q) || native.includes(q);
                });
            }

            // 3. Format filter
            if (this.seasonFormat && this.seasonFormat !== 'all') {
                filtered = filtered.filter(item => item.format === this.seasonFormat);
            }

            // 4. Status filter
            if (this.seasonStatus && this.seasonStatus !== 'all') {
                filtered = filtered.filter(item => item.status === this.seasonStatus);
            }

            // 5. Sorting
            filtered.sort((a, b) => {
                let comp = 0;
                if (this.seasonSort === 'SCORE') {
                    comp = (b.score || 0) - (a.score || 0);
                } else if (this.seasonSort === 'POPULARITY') {
                    comp = (b.popularity || 0) - (a.popularity || 0);
                } else if (this.seasonSort === 'TRENDING') {
                    comp = (b.trending || 0) - (a.trending || 0);
                } else if (this.seasonSort === 'START_DATE') {
                    comp = (b.year || 0) - (a.year || 0);
                } else {
                    comp = (a.title || '').localeCompare(b.title || '');
                }

                return this.seasonSortDir === 'ASC' ? -comp : comp;
            });

            this.seasonFilteredResults = filtered;
            this.updateResultsView();
        }

        bindCustomEvents() {
            const dropzone = this.container.querySelector('#custom-dropzone');
            const fileInput = this.container.querySelector('#custom-file-input');
            const overlay = dropzone ? dropzone.querySelector('.dropzone-overlay') : null;
            const urlInput = this.container.querySelector('#custom-url-input');
            const urlTitleInput = this.container.querySelector('#custom-url-title');
            const addUrlBtn = this.container.querySelector('#btn-add-custom-url');
            const clearStagedBtn = this.container.querySelector('#btn-clear-staged');
            const ingestAllBtn = this.container.querySelector('#btn-ingest-all-staged');

            if (dropzone && fileInput) {
                dropzone.addEventListener('click', () => fileInput.click());

                // Interactive "Release Now" drag feedback
                this.dragCounter = 0;

                dropzone.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    this.dragCounter++;
                    dropzone.classList.add('dropzone-active');
                    if (overlay) overlay.classList.remove('opacity-0');
                });

                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (!dropzone.classList.contains('dropzone-active')) {
                        dropzone.classList.add('dropzone-active');
                        if (overlay) overlay.classList.remove('opacity-0');
                    }
                });

                dropzone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    this.dragCounter--;
                    if (this.dragCounter <= 0) {
                        this.dragCounter = 0;
                        dropzone.classList.remove('dropzone-active');
                        if (overlay) overlay.classList.add('opacity-0');
                    }
                });

                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    this.dragCounter = 0;
                    dropzone.classList.remove('dropzone-active');
                    if (overlay) overlay.classList.add('opacity-0');

                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        this.processUploadedFiles(e.dataTransfer.files);
                    }
                });

                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        this.processUploadedFiles(e.target.files);
                    }
                });
            }

            if (addUrlBtn && urlInput) {
                addUrlBtn.addEventListener('click', () => {
                    const url = urlInput.value.trim();
                    if (!url) return;
                    const customTitle = (urlTitleInput && urlTitleInput.value.trim()) ||
                                        url.split('/').pop().split('?')[0].replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') ||
                                        'Custom Image';

                    const item = {
                        id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        title: customTitle,
                        image: url,
                        format: 'IMAGE',
                        year: null,
                        score: null,
                        type: 'CUSTOM',
                        custom: true
                    };

                    this.stagedCustomItems.push(item);
                    urlInput.value = '';
                    if (urlTitleInput) urlTitleInput.value = '';
                    this.render();
                    this.bindEvents();
                    if (window.AniHub.toast) window.AniHub.toast.success('Image staged successfully!');
                });
            }

            if (clearStagedBtn) {
                clearStagedBtn.addEventListener('click', () => {
                    this.stagedCustomItems = [];
                    this.render();
                    this.bindEvents();
                });
            }

            if (ingestAllBtn) {
                ingestAllBtn.addEventListener('click', () => {
                    this.ingestAllStaged();
                });
            }

            // Staged rename and remove inputs
            this.container.querySelectorAll('.staged-title-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.idx, 10);
                    if (this.stagedCustomItems[idx]) {
                        this.stagedCustomItems[idx].title = e.target.value.trim();
                    }
                });
            });

            this.container.querySelectorAll('.btn-remove-staged').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.idx, 10);
                    this.stagedCustomItems.splice(idx, 1);
                    this.render();
                    this.bindEvents();
                });
            });
        }

        async processUploadedFiles(files) {
            const list = Array.from(files);
            const imageFiles = list.filter(f => f.type.startsWith('image/'));

            if (imageFiles.length === 0) {
                if (window.AniHub.toast) window.AniHub.toast.warning('Please select image files (PNG, JPG, WebP, GIF).');
                return;
            }

            this.isLoading = true;
            this.loadingMessage = `Processing ${imageFiles.length} file(s)...`;
            this.updateResultsView();

            const reads = imageFiles.map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                        resolve({
                            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            title: cleanTitle,
                            image: e.target.result,
                            format: 'LOCAL',
                            year: null,
                            score: null,
                            type: 'CUSTOM',
                            custom: true
                        });
                    };
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(file);
                });
            });

            const processed = await Promise.all(reads);
            const valid = processed.filter(Boolean);
            this.stagedCustomItems = [...this.stagedCustomItems, ...valid];

            this.isLoading = false;
            this.render();
            this.bindEvents();

            if (window.AniHub.toast) {
                window.AniHub.toast.success(`Staged ${valid.length} custom images!`);
            }
        }

        ingestAllStaged() {
            if (this.stagedCustomItems.length === 0) return;
            const itemsToAdd = [...this.stagedCustomItems];
            let addedCount = 0;

            itemsToAdd.forEach(item => {
                const added = this.addItemToWorkspace(item, false);
                if (added) addedCount++;
            });

            this.stagedCustomItems = [];
            this.render();
            this.bindEvents();

            if (window.AniHub.toast) {
                window.AniHub.toast.success(`Successfully ingested ${addedCount} items into your workspace!`);
            }
        }

        bindResultsDelegation() {
            const section = this.container.querySelector('#discovery-results-section');
            if (!section) return;

            // Series Card Click (Robust lookup by ID)
            section.querySelectorAll('.series-select-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = card.dataset.seriesId;
                    const series = this.seriesResults.find(s => String(s.id) === String(id));
                    if (series) {
                        this.activeSeries = series;
                        this.render();
                        this.bindEvents();
                        this.executeSearch();
                    }
                });
            });

            // Card or Add button click
            section.querySelectorAll('.result-item-card').forEach(card => {
                const itemId = card.dataset.itemId;
                const addBtn = card.querySelector('.btn-add-item');

                const handleAdd = (e) => {
                    if (e) e.stopPropagation();
                    const item = this.findItemById(itemId);
                    if (item) {
                        this.addItemToWorkspace(item, true);
                    }
                };

                if (addBtn) {
                    addBtn.addEventListener('click', handleAdd);
                }
                card.addEventListener('click', handleAdd);
            });

            // Add all visible results
            const addAllBtn = section.querySelector('#btn-add-all-results');
            if (addAllBtn) {
                addAllBtn.addEventListener('click', () => {
                    const results = this.getActiveResultsList();
                    if (results.length === 0) return;

                    if (results.length > 30) {
                        const ok = confirm(`Add all ${results.length} items to your workspace?`);
                        if (!ok) return;
                    }

                    let count = 0;
                    results.forEach(item => {
                        if (this.addItemToWorkspace(item, false)) count++;
                    });

                    this.updateResultsView();
                    if (window.AniHub.toast) {
                        window.AniHub.toast.success(`Added ${count} items to active workspace!`);
                    }
                });
            }
        }

        findItemById(id) {
            const results = this.getActiveResultsList();
            return results.find(i => String(i.id) === String(id));
        }

        addItemToWorkspace(item, showFeedback = true) {
            const state = window.AniHub.state;
            if (!state) return false;

            const effectiveDest = this.getEffectiveDestination();
            let addedToRanker = false;
            let addedToTierlist = false;

            if (effectiveDest === 'ranker' || effectiveDest === 'both') {
                addedToRanker = state.addRankerItem(item);
            }

            if (effectiveDest === 'tierlist' || effectiveDest === 'both') {
                addedToTierlist = state.addTierlistPoolItem(item);
            }

            const success = addedToRanker || addedToTierlist;

            if (showFeedback) {
                if (success) {
                    if (window.AniHub.toast) {
                        const destLabel = effectiveDest === 'both' ? 'Ranker & Tierlist' : (effectiveDest === 'ranker' ? 'AniRanker' : 'Tierlist Pool');
                        window.AniHub.toast.success(`Added "${item.title}" to ${destLabel}!`);
                    }
                    this.updateResultsView();
                } else {
                    if (window.AniHub.toast) {
                        window.AniHub.toast.warning(`"${item.title}" is already in your workspace.`);
                    }
                }
            }

            return success;
        }

        updateResultsView() {
            const header = this.container ? this.container.querySelector('#discovery-results-section') : null;
            if (!header) return;

            const resultsContainer = this.container.querySelector('#discovery-results-container');
            if (resultsContainer) {
                resultsContainer.innerHTML = this.renderResultsList();
            }

            const resultsHeader = this.container.querySelector('#discovery-results-section > div');
            if (resultsHeader) {
                resultsHeader.outerHTML = this.renderResultsSectionHeader();
            }

            this.bindResultsDelegation();
        }
    }

    window.AniHub.components.DiscoveryEngine = DiscoveryEngine;
    window.AniHub.components.createDiscovery = function(container, options) {
        const engine = new DiscoveryEngine();
        engine.mount(container, options);
        return engine;
    };
})();

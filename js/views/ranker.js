/**
 * AniRanker View
 * Linear Hierarchy Matrix & High-Res Visual Grid Showcase
 * Desktop & Touch Drag-and-Drop Reordering in BOTH Grid & List Modes,
 * Custom Renaming, and Robust Base64 Image Conversion for PNG Capture
 */

window.AniHub = window.AniHub || {};
window.AniHub.views = window.AniHub.views || {};

(function() {
    let discoveryInstance = null;
    let rankerUnsub = null;
    let activeTab = 'grid'; // Default to Grid mode as requested
    let gridCols = 5;
    let showRanks = true;
    let showTitles = true;

    // Helper: Convert remote image to base64 Data URL to prevent canvas tainting in html2canvas
    async function convertImageToDataURL(url) {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;

        // Strategy 1: In-memory Image element rendering to offscreen canvas with CORS
        const tryCanvas = () => new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const timeout = setTimeout(() => reject(new Error('Image load timeout')), 3500);
            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth || img.width || 300;
                    c.height = img.naturalHeight || img.height || 450;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(c.toDataURL('image/png'));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = (e) => {
                clearTimeout(timeout);
                reject(e);
            };
            // Append cache buster to bypass cached non-CORS headers
            img.src = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        });

        try {
            const res = await tryCanvas();
            if (res) return res;
        } catch (e) {}

        // Strategy 2: Direct fetch with CORS mode
        try {
            const resp = await fetch(url, { mode: 'cors' });
            if (resp.ok) {
                const blob = await resp.blob();
                const dataUrl = await new Promise((res) => {
                    const reader = new FileReader();
                    reader.onloadend = () => res(reader.result);
                    reader.readAsDataURL(blob);
                });
                if (dataUrl) return dataUrl;
            }
        } catch (e) {}

        // Strategy 3: Public CORS proxies as fallback
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?url=${encodeURIComponent(url)}`
        ];
        for (const proxy of proxies) {
            try {
                const resp = await fetch(proxy);
                if (resp.ok) {
                    const blob = await resp.blob();
                    const dataUrl = await new Promise((res) => {
                        const reader = new FileReader();
                        reader.onloadend = () => res(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    if (dataUrl) return dataUrl;
                }
            } catch (e) {}
        }

        return url;
    }

    function renderRanker(container) {
        const state = window.AniHub.state;

        container.innerHTML = `
            <div class="py-6 max-w-7xl mx-auto px-4 md:px-6 space-y-4 animate-fade-in">
                <!-- Controls & Action Toolbar -->
                <div class="space-y-3">
                    <div class="p-3.5 rounded-lg bg-surface border border-border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <!-- Left: Display Config (Columns, Show Ranks, Show Titles) -->
                        <div class="flex flex-wrap items-center gap-4 font-medium text-text-muted">
                            <!-- Columns selector -->
                            <div class="flex items-center gap-2">
                                <span>Columns:</span>
                                <select id="grid-cols-select" class="h-8 px-2 rounded-md bg-bg border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-accent">
                                    <option value="3" ${gridCols === 3 ? 'selected' : ''}>3 cols</option>
                                    <option value="4" ${gridCols === 4 ? 'selected' : ''}>4 cols</option>
                                    <option value="5" ${gridCols === 5 ? 'selected' : ''}>5 cols</option>
                                    <option value="6" ${gridCols === 6 ? 'selected' : ''}>6 cols</option>
                                    <option value="8" ${gridCols === 8 ? 'selected' : ''}>8 cols</option>
                                </select>
                            </div>

                            <!-- Show Ranks Checkbox -->
                            <label class="flex items-center gap-1.5 cursor-pointer select-none text-text-primary">
                                <input type="checkbox" id="toggle-grid-ranks" ${showRanks ? 'checked' : ''} class="rounded border-border text-accent focus:ring-0">
                                <span>Show Ranks</span>
                            </label>

                            <!-- Show Titles Checkbox -->
                            <label class="flex items-center gap-1.5 cursor-pointer select-none text-text-primary">
                                <input type="checkbox" id="toggle-grid-titles" ${showTitles ? 'checked' : ''} class="rounded border-border text-accent focus:ring-0">
                                <span>Show Titles</span>
                            </label>
                        </div>

                        <!-- Middle: Entries Counter Badge -->
                        <div class="flex items-center justify-center">
                            <span id="ranker-count-badge" class="font-mono text-xs font-semibold px-3 py-1 rounded-md bg-bg border border-border text-accent shadow-xs">
                                0 Entries
                            </span>
                        </div>

                        <!-- Right: Action Buttons & Save PNG Toolbar -->
                        <div class="flex flex-wrap items-center gap-2 justify-end">
                            <button id="btn-ranker-reverse" class="h-8 w-8 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary text-xs flex items-center justify-center transition-colors" title="Reverse Ranking Order">
                                <i class="fas fa-sort-numeric-down-alt"></i>
                            </button>
                            <button id="btn-ranker-shuffle" class="h-8 w-8 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary text-xs flex items-center justify-center transition-colors" title="Shuffle Randomly">
                                <i class="fas fa-random"></i>
                            </button>
                            <button id="btn-open-ranker-export" class="h-8 px-3 rounded-md bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs" title="Export PNG, Text, JSON Backup & Share Link">
                                <i class="fas fa-file-export text-xs"></i>
                                <span>Export</span>
                            </button>
                            <!-- Clear Button with Strong Red Background and Prominent Label -->
                            <button id="btn-clear-ranker" class="h-8 px-3 rounded-md bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs" title="Clear all rankings">
                                <i class="fas fa-trash-alt text-xs"></i>
                                <span>Clear</span>
                            </button>
                            <button id="btn-download-grid-png" class="h-8 px-3.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs">
                                <i class="fas fa-download text-xs"></i>
                                <span>Save PNG</span>
                            </button>
                        </div>
                    </div>

                    <!-- Row Directly Underneath: Grid View / List View Switcher in the Middle & Longer -->
                    <div class="flex justify-center">
                        <div class="inline-flex items-center p-1 rounded-lg bg-surface border border-border shadow-xs">
                            <button id="btn-tab-grid" class="h-9 px-6 sm:px-8 min-w-[130px] rounded-md text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'grid' ? 'bg-bg text-text-primary border border-border font-bold shadow-xs' : 'text-text-muted hover:text-text-primary font-medium'}">
                                <i class="fas fa-th-large text-xs sm:text-sm"></i>
                                <span>Grid View</span>
                            </button>
                            <button id="btn-tab-list" class="h-9 px-6 sm:px-8 min-w-[130px] rounded-md text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-bg text-text-primary border border-border font-bold shadow-xs' : 'text-text-muted hover:text-text-primary font-medium'}">
                                <i class="fas fa-bars text-xs sm:text-sm"></i>
                                <span>List View</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Grid Showcase View Panel (DEFAULT) -->
                <div id="ranker-grid-panel" class="${activeTab === 'grid' ? '' : 'hidden'} space-y-4">

                    <!-- Canvas/Grid Showcase Container -->
                    <div class="p-4 sm:p-6 rounded-lg bg-bg border border-border overflow-hidden">
                        <div id="ranker-export-canvas" class="p-6 rounded-md bg-[#090d16] text-white border border-border transition-all">
                            <!-- Responsive Grid Tiles -->
                            <div id="ranker-tiles-container" class="grid gap-3 ${showRanks ? '' : 'hide-ranks'} ${showTitles ? '' : 'hide-titles'}">
                                <!-- Tiles injected here -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Matrix List View Panel -->
                <div id="ranker-list-panel" class="${activeTab === 'list' ? '' : 'hidden'} space-y-4">
                    <div id="ranker-items-list" class="space-y-2 max-w-4xl mx-auto">
                        <!-- Dynamic list items injected here -->
                    </div>

                    <!-- Empty State for List -->
                    <div id="ranker-empty-state" class="hidden text-center py-12 px-4 bg-surface rounded-lg border border-border max-w-md mx-auto">
                        <div class="w-12 h-12 rounded-md bg-bg border border-border text-accent flex items-center justify-center text-xl mx-auto mb-3">
                            <i class="fas fa-list-ol"></i>
                        </div>
                        <h3 class="text-sm font-bold text-text-primary">Ranking Matrix is Empty</h3>
                        <p class="text-xs text-text-muted mt-1 max-w-xs mx-auto mb-4">
                            Ingest anime, manga, characters, or custom artwork using the Discovery Engine below.
                        </p>
                        <button onclick="document.getElementById('ranker-discovery-mount')?.scrollIntoView({behavior:'smooth'})" class="h-8 px-3 rounded-md bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover transition-colors">
                            <i class="fas fa-search mr-1"></i> Open Discovery Engine
                        </button>
                    </div>
                </div>

                <!-- Unified Discovery Engine Mount Point -->
                <div class="pt-4">
                    <div class="flex items-center gap-2 mb-4 px-1">
                        <span class="font-mono text-xs uppercase font-bold text-text-muted tracking-wider">Ingest & Discover</span>
                        <div class="h-px bg-border flex-1"></div>
                    </div>
                    <div id="ranker-discovery-mount"></div>
                </div>
            </div>
        `;

        // Date for export canvas
        const dateEl = container.querySelector('#grid-export-date');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        }

        // Tab switching
        const btnTabList = container.querySelector('#btn-tab-list');
        const btnTabGrid = container.querySelector('#btn-tab-grid');
        const panelList = container.querySelector('#ranker-list-panel');
        const panelGrid = container.querySelector('#ranker-grid-panel');

        function setTab(tab) {
            activeTab = tab;
            if (tab === 'grid') {
                btnTabGrid.className = 'h-9 px-6 sm:px-8 min-w-[130px] rounded-md text-xs sm:text-sm transition-all flex items-center justify-center gap-2 bg-bg text-text-primary border border-border font-bold shadow-xs';
                btnTabList.className = 'h-9 px-6 sm:px-8 min-w-[130px] rounded-md text-xs sm:text-sm transition-all flex items-center justify-center gap-2 text-text-muted hover:text-text-primary font-medium';
                panelGrid.classList.remove('hidden');
                panelList.classList.add('hidden');
            } else {
                btnTabList.className = 'h-9 px-6 sm:px-8 min-w-[130px] rounded-md text-xs sm:text-sm transition-all flex items-center justify-center gap-2 bg-bg text-text-primary border border-border font-bold shadow-xs';
                btnTabGrid.className = 'h-9 px-6 sm:px-8 min-w-[130px] rounded-md text-xs sm:text-sm transition-all flex items-center justify-center gap-2 text-text-muted hover:text-text-primary font-medium';
                panelList.classList.remove('hidden');
                panelGrid.classList.add('hidden');
            }
            updateRankerView();
        }

        btnTabList.addEventListener('click', () => setTab('list'));
        btnTabGrid.addEventListener('click', () => setTab('grid'));

        // Grid Column Controller
        const gridSelect = container.querySelector('#grid-cols-select');
        if (gridSelect) {
            gridSelect.addEventListener('change', (e) => {
                gridCols = parseInt(e.target.value, 10);
                updateGridView();
            });
        }

        // Toggle Ranks Checkbox
        const toggleRanksCheckbox = container.querySelector('#toggle-grid-ranks');
        if (toggleRanksCheckbox) {
            toggleRanksCheckbox.addEventListener('change', (e) => {
                showRanks = e.target.checked;
                const tiles = container.querySelector('#ranker-tiles-container');
                if (tiles) {
                    if (showRanks) tiles.classList.remove('hide-ranks');
                    else tiles.classList.add('hide-ranks');
                }
            });
        }

        // Toggle Titles Checkbox
        const toggleTitlesCheckbox = container.querySelector('#toggle-grid-titles');
        if (toggleTitlesCheckbox) {
            toggleTitlesCheckbox.addEventListener('change', (e) => {
                showTitles = e.target.checked;
                const tiles = container.querySelector('#ranker-tiles-container');
                if (tiles) {
                    if (showTitles) tiles.classList.remove('hide-titles');
                    else tiles.classList.add('hide-titles');
                }
            });
        }

        // Utility Buttons: Reverse, Shuffle, Copy Text, Clear
        container.querySelector('#btn-ranker-reverse').addEventListener('click', () => {
            const items = [...(state.rankerItems || [])];
            if (items.length < 2) return;
            items.reverse();
            state.setRankerItems(items);
            if (window.AniHub.toast) window.AniHub.toast.info('Ranking order reversed');
        });

        container.querySelector('#btn-ranker-shuffle').addEventListener('click', () => {
            const items = [...(state.rankerItems || [])];
            if (items.length < 2) return;
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
            state.setRankerItems(items);
            if (window.AniHub.toast) window.AniHub.toast.info('Ranking shuffled');
        });

        container.querySelector('#btn-clear-ranker').addEventListener('click', () => {
            const items = state.rankerItems || [];
            if (items.length === 0) return;
            if (confirm(`Remove all ${items.length} items from your ranking?`)) {
                state.setRankerItems([]);
                if (window.AniHub.toast) window.AniHub.toast.info('Ranking cleared');
            }
        });

        // Open Unified Export & Share Studio
        const btnOpenExport = container.querySelector('#btn-open-ranker-export');
        if (btnOpenExport) {
            btnOpenExport.addEventListener('click', () => {
                if (window.AniHub.exportModal) {
                    window.AniHub.exportModal.open({
                        context: 'ranker',
                        defaultTab: 'png',
                        element: container.querySelector('#ranker-export-canvas')
                    });
                }
            });
        }

        // Direct High-Quality PNG Download without opening modal window
        const downloadPngBtn = container.querySelector('#btn-download-grid-png');
        if (downloadPngBtn) {
            downloadPngBtn.addEventListener('click', () => {
                if (window.AniHub.exportModal?.directDownloadPng) {
                    window.AniHub.exportModal.directDownloadPng('ranker', container.querySelector('#ranker-export-canvas'));
                } else if (window.AniHub.exportModal) {
                    window.AniHub.exportModal.open({
                        context: 'ranker',
                        defaultTab: 'png',
                        element: container.querySelector('#ranker-export-canvas')
                    });
                }
            });
        }

        // Shared Reordering State
        let draggedIndex = null;

        // Mobile Touch Reordering State
        let touchTimer = null;
        let isTouchReordering = false;
        let touchActiveEl = null;
        let touchAvatar = null;
        let touchStartIndex = null;

        function updateRankerView() {
            const items = state ? (state.rankerItems || []) : [];

            // Update counter badges
            const countBadge = container.querySelector('#ranker-count-badge');
            if (countBadge) {
                countBadge.textContent = `${items.length} ${items.length === 1 ? 'Entry' : 'Entries'}`;
            }

            const emptyEl = container.querySelector('#ranker-empty-state');
            const listEl = container.querySelector('#ranker-items-list');

            if (items.length === 0) {
                if (emptyEl) emptyEl.classList.remove('hidden');
                if (listEl) listEl.innerHTML = '';
            } else {
                if (emptyEl) emptyEl.classList.add('hidden');
                renderListItems(items);
            }

            updateGridView();
        }

        // Render List Mode
        function renderListItems(items) {
            const listContainer = container.querySelector('#ranker-items-list');
            if (!listContainer) return;

            listContainer.innerHTML = items.map((item, idx) => {
                const badgeClass = idx === 0 
                    ? 'rank-badge-gold' 
                    : idx === 1 
                    ? 'rank-badge-silver' 
                    : idx === 2 
                    ? 'rank-badge-bronze' 
                    : 'bg-bg border border-border text-text-muted font-mono';

                return `
                    <div class="ranked-item p-2 rounded-md bg-surface border border-border flex items-center gap-3 relative group hover:border-text-muted/40 cursor-grab transition-colors" 
                         draggable="true" 
                         data-idx="${idx}">
                        
                        <!-- Drag Handle & Rank Badge -->
                        <div class="flex items-center gap-1.5 shrink-0">
                            <span class="w-6 h-6 rounded-sm ${badgeClass} font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                ${idx + 1}
                            </span>
                        </div>

                        <!-- Poster Image -->
                        <div class="w-10 h-14 rounded-sm bg-bg border border-border overflow-hidden shrink-0 aspect-[2/3]">
                            <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover pointer-events-none" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                        </div>

                        <!-- Item Meta -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <h4 class="text-xs sm:text-sm font-semibold text-text-primary truncate" title="${item.title}">${item.title}</h4>
                                ${item.custom ? `
                                    <span class="text-[9px] px-1 py-0.2 rounded bg-bg border border-border text-accent font-mono font-bold shrink-0">Custom</span>
                                ` : ''}
                            </div>
                            <div class="flex items-center gap-2 font-mono text-[10px] text-text-muted mt-0.5">
                                <span>${(item.type === 'CHARACTER' && item.seriesTitle) ? item.seriesTitle : (item.format || item.type || 'Anime')}</span>
                                ${item.year ? `<span>• ${item.year}</span>` : ''}
                                ${item.score ? `<span class="text-accent font-semibold">★ ${item.score}%</span>` : ''}
                            </div>
                        </div>

                        <!-- Reorder / Actions Toolbar -->
                        <div class="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            ${item.custom ? `
                                <button class="btn-rename-ranker w-6 h-6 rounded-sm bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-amber-400 text-xs flex items-center justify-center transition-colors" data-idx="${idx}" title="Rename Item">
                                    <i class="fas fa-edit text-[9px]"></i>
                                </button>
                            ` : ''}
                            <button class="btn-move-up w-6 h-6 rounded-sm bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary text-xs flex items-center justify-center transition-colors ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Up">
                                <i class="fas fa-chevron-up text-[9px]"></i>
                            </button>
                            <button class="btn-move-down w-6 h-6 rounded-sm bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary text-xs flex items-center justify-center transition-colors ${idx === items.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}" data-idx="${idx}" ${idx === items.length - 1 ? 'disabled' : ''} title="Move Down">
                                <i class="fas fa-chevron-down text-[9px]"></i>
                            </button>
                            <button class="btn-remove-ranker w-6 h-6 rounded-sm bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-rose-400 text-xs flex items-center justify-center transition-colors" data-idx="${idx}" title="Remove from list">
                                <i class="fas fa-trash-alt text-[9px]"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind List HTML5 Drag & Drop
            const rowEls = listContainer.querySelectorAll('.ranked-item');
            rowEls.forEach(row => {
                row.addEventListener('dragstart', (e) => {
                    draggedIndex = parseInt(row.dataset.idx, 10);
                    row.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggedIndex);
                });

                row.addEventListener('dragend', () => {
                    row.classList.remove('dragging');
                    rowEls.forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
                    draggedIndex = null;
                });

                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedIndex === null) return;
                    const targetIdx = parseInt(row.dataset.idx, 10);
                    if (targetIdx === draggedIndex) return;

                    const rect = row.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        row.classList.add('drag-over-top');
                        row.classList.remove('drag-over-bottom');
                    } else {
                        row.classList.add('drag-over-bottom');
                        row.classList.remove('drag-over-top');
                    }
                });

                row.addEventListener('dragleave', () => {
                    row.classList.remove('drag-over-top', 'drag-over-bottom');
                });

                row.addEventListener('drop', (e) => {
                    e.preventDefault();
                    row.classList.remove('drag-over-top', 'drag-over-bottom');
                    if (draggedIndex === null) return;
                    const targetIdx = parseInt(row.dataset.idx, 10);
                    if (targetIdx === draggedIndex) return;

                    const rect = row.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    const insertBefore = e.clientY < midY;

                    const copy = [...state.rankerItems];
                    const [movedItem] = copy.splice(draggedIndex, 1);
                    let newIdx = targetIdx;
                    if (draggedIndex < targetIdx) {
                        newIdx = insertBefore ? targetIdx - 1 : targetIdx;
                    } else {
                        newIdx = insertBefore ? targetIdx : targetIdx + 1;
                    }
                    copy.splice(newIdx, 0, movedItem);
                    state.setRankerItems(copy);
                });

                // Touch Reordering for List
                setupTouchReorder(row, listContainer, '.ranked-item');
            });

            // Action Buttons in List
            listContainer.querySelectorAll('.btn-move-up').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    moveRankItem(idx, -1);
                });
            });

            listContainer.querySelectorAll('.btn-move-down').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    moveRankItem(idx, 1);
                });
            });

            listContainer.querySelectorAll('.btn-remove-ranker').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    removeRankItem(idx);
                });
            });

            listContainer.querySelectorAll('.btn-rename-ranker').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    renameRankItem(idx);
                });
            });
        }

        // Render Grid Mode with Full Drag & Drop Reordering
        function updateGridView() {
            const items = state ? (state.rankerItems || []) : [];
            const tilesContainer = container.querySelector('#ranker-tiles-container');
            if (!tilesContainer) return;

            // Apply responsive grid layout
            tilesContainer.className = `grid gap-3 sm:gap-4 ${showRanks ? '' : 'hide-ranks'} ${showTitles ? '' : 'hide-titles'}`;
            if (gridCols === 3) tilesContainer.classList.add('grid-cols-2', 'sm:grid-cols-3');
            else if (gridCols === 4) tilesContainer.classList.add('grid-cols-2', 'sm:grid-cols-4');
            else if (gridCols === 6) tilesContainer.classList.add('grid-cols-3', 'sm:grid-cols-6');
            else if (gridCols === 8) tilesContainer.classList.add('grid-cols-4', 'sm:grid-cols-8');
            else tilesContainer.classList.add('grid-cols-2', 'sm:grid-cols-5'); // default 5

            if (items.length === 0) {
                tilesContainer.innerHTML = `
                    <div class="col-span-full py-16 text-center text-slate-500">
                        <i class="fas fa-th-large text-3xl mb-2 opacity-30"></i>
                        <p class="text-xs">No items to preview in showcase</p>
                    </div>
                `;
                return;
            }

            tilesContainer.innerHTML = items.map((item, idx) => `
                <div class="ranking-grid-tile group relative" 
                     draggable="true" 
                     data-idx="${idx}" 
                     title="${item.title} (Rank #${idx + 1})">
                    
                    <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover pointer-events-none" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                    
                    <!-- Rank number badge -->
                    <span class="rank-number">
                        ${idx + 1}
                    </span>

                    <!-- Quick Reorder & Action Controls on Hover -->
                    <div class="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface/90 border border-border p-0.5 rounded-md z-20">
                        ${idx > 0 ? `
                            <button class="btn-grid-prev w-5 h-5 rounded-sm bg-bg hover:bg-surface-hover border border-border text-text-primary text-[9px] flex items-center justify-center transition-colors" data-idx="${idx}" title="Move Previous (Rank #${idx})">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                        ` : ''}
                        ${idx < items.length - 1 ? `
                            <button class="btn-grid-next w-5 h-5 rounded-sm bg-bg hover:bg-surface-hover border border-border text-text-primary text-[9px] flex items-center justify-center transition-colors" data-idx="${idx}" title="Move Next (Rank #${idx + 2})">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        ` : ''}
                        <button class="btn-grid-remove w-5 h-5 rounded-sm bg-bg hover:bg-surface-hover border border-border text-rose-400 hover:text-rose-300 text-[9px] flex items-center justify-center transition-colors" data-idx="${idx}" title="Remove Item">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <!-- Title Overlay -->
                    <div class="grid-title-overlay absolute inset-x-0 bottom-0 px-1.5 pt-4 pb-1.5 bg-gradient-to-t from-[#090d16] via-[#090d16]/80 to-transparent flex flex-col justify-end pointer-events-none">
                        <p class="text-[10px] sm:text-[11px] text-white font-medium leading-snug break-words text-center m-0">${item.title}</p>
                    </div>
                </div>
            `).join('');

            // Bind Drag & Drop Events on Grid Tiles
            const gridTiles = tilesContainer.querySelectorAll('.ranking-grid-tile');
            gridTiles.forEach(tile => {
                tile.addEventListener('dragstart', (e) => {
                    draggedIndex = parseInt(tile.dataset.idx, 10);
                    tile.classList.add('grid-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggedIndex);
                });

                tile.addEventListener('dragend', () => {
                    tile.classList.remove('grid-dragging');
                    gridTiles.forEach(t => t.classList.remove('grid-drag-over'));
                    draggedIndex = null;
                });

                tile.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedIndex === null) return;
                    const targetIdx = parseInt(tile.dataset.idx, 10);
                    if (targetIdx === draggedIndex) return;
                    tile.classList.add('grid-drag-over');
                });

                tile.addEventListener('dragleave', (e) => {
                    if (!tile.contains(e.relatedTarget)) {
                        tile.classList.remove('grid-drag-over');
                    }
                });

                tile.addEventListener('drop', (e) => {
                    e.preventDefault();
                    tile.classList.remove('grid-drag-over');
                    if (draggedIndex === null) return;
                    const targetIdx = parseInt(tile.dataset.idx, 10);
                    if (targetIdx === draggedIndex) return;

                    const copy = [...state.rankerItems];
                    const [movedItem] = copy.splice(draggedIndex, 1);
                    copy.splice(targetIdx, 0, movedItem);
                    state.setRankerItems(copy);
                });

                // Mobile Touch Reordering for Grid
                setupTouchReorder(tile, tilesContainer, '.ranking-grid-tile');
            });

            // Bind Grid Quick Action Buttons
            tilesContainer.querySelectorAll('.btn-grid-prev').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    moveRankItem(idx, -1);
                });
            });

            tilesContainer.querySelectorAll('.btn-grid-next').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    moveRankItem(idx, 1);
                });
            });

            tilesContainer.querySelectorAll('.btn-grid-remove').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    removeRankItem(idx);
                });
            });
        }

        // Shared touch reordering logic
        function setupTouchReorder(element, containerEl, selector) {
            element.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return;
                clearTimeout(touchTimer);
                const touch = e.touches[0];
                touchStartIndex = parseInt(element.dataset.idx, 10);

                touchTimer = setTimeout(() => {
                    isTouchReordering = true;
                    touchActiveEl = element;
                    element.classList.add('drag-placeholder');

                    if (navigator.vibrate) navigator.vibrate(40);

                    touchAvatar = element.cloneNode(true);
                    touchAvatar.className = 'drag-avatar p-2 rounded-md bg-surface border border-accent shadow-2xl flex items-center gap-3 w-36 aspect-[2/3] overflow-hidden pointer-events-none fixed z-[9999]';
                    touchAvatar.style.left = `${touch.clientX - 40}px`;
                    touchAvatar.style.top = `${touch.clientY - 40}px`;
                    document.body.appendChild(touchAvatar);
                }, 300);
            }, { passive: true });

            element.addEventListener('touchmove', (e) => {
                if (!isTouchReordering) {
                    clearTimeout(touchTimer);
                    return;
                }
                if (e.cancelable) e.preventDefault();
                const touch = e.touches[0];

                if (touchAvatar) {
                    touchAvatar.style.left = `${touch.clientX - 40}px`;
                    touchAvatar.style.top = `${touch.clientY - 40}px`;
                }

                const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetTile = elementUnder ? elementUnder.closest(selector) : null;

                containerEl.querySelectorAll(selector).forEach(t => t.classList.remove('grid-drag-over'));
                if (targetTile && targetTile !== touchActiveEl) {
                    targetTile.classList.add('grid-drag-over');
                }
            }, { passive: false });

            element.addEventListener('touchend', (e) => {
                clearTimeout(touchTimer);
                if (isTouchReordering) {
                    isTouchReordering = false;
                    element.classList.remove('drag-placeholder');

                    if (touchAvatar) {
                        touchAvatar.remove();
                        touchAvatar = null;
                    }

                    const lastTouch = e.changedTouches[0];
                    const dropTarget = document.elementFromPoint(lastTouch.clientX, lastTouch.clientY);
                    containerEl.querySelectorAll(selector).forEach(t => t.classList.remove('grid-drag-over'));

                    if (dropTarget) {
                        const targetTile = dropTarget.closest(selector);
                        if (targetTile && targetTile !== touchActiveEl) {
                            const targetIdx = parseInt(targetTile.dataset.idx, 10);
                            const sourceIdx = parseInt(touchActiveEl.dataset.idx, 10);

                            if (!isNaN(targetIdx) && !isNaN(sourceIdx) && targetIdx !== sourceIdx) {
                                const copy = [...state.rankerItems];
                                const [moved] = copy.splice(sourceIdx, 1);
                                copy.splice(targetIdx, 0, moved);
                                state.setRankerItems(copy);
                            }
                        }
                    }

                    touchActiveEl = null;
                }
            });
        }

        // Shared item manipulation actions
        function moveRankItem(idx, direction) {
            const items = [...state.rankerItems];
            const targetIdx = idx + direction;
            if (targetIdx < 0 || targetIdx >= items.length) return;
            const temp = items[idx];
            items[idx] = items[targetIdx];
            items[targetIdx] = temp;
            state.setRankerItems(items);
        }

        function removeRankItem(idx) {
            const copy = state.rankerItems.filter((_, i) => i !== idx);
            state.setRankerItems(copy);
            if (window.AniHub.toast) window.AniHub.toast.info('Item removed');
        }

        function renameRankItem(idx) {
            const item = state.rankerItems[idx];
            if (!item) return;
            const newTitle = prompt('Enter new title for this item:', item.title);
            if (newTitle && newTitle.trim()) {
                state.renameItem(item.id, newTitle.trim(), 'ranker');
                if (window.AniHub.toast) window.AniHub.toast.success('Item renamed');
            }
        }

        // Mount Discovery Engine
        const discoveryMount = container.querySelector('#ranker-discovery-mount');
        if (discoveryMount && window.AniHub.components.createDiscovery) {
            discoveryInstance = window.AniHub.components.createDiscovery(discoveryMount, {
                targetDestination: 'ranker'
            });
        }

        // Subscribe to state updates
        if (rankerUnsub) rankerUnsub();
        rankerUnsub = state.on('rankerChange', () => {
            updateRankerView();
            if (discoveryInstance && discoveryInstance.updateResultsView) {
                discoveryInstance.updateResultsView();
            }
        });

        // Initial render
        updateRankerView();
    }

    window.AniHub.views.ranker = { render: renderRanker };
})();

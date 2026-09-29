/**
 * AniTierlist View
 * Multi-Tier Matrix Workspace with Drag & Drop, Unranked Pool, Customizer Modal, & PNG Export
 */

window.AniHub = window.AniHub || {};
window.AniHub.views = window.AniHub.views || {};

(function() {
    let discoveryInstance = null;
    let tierlistUnsub = null;
    let poolSearchFilter = '';

    // Drag-and-drop state across tiers and pool
    let activeDragItem = null;
    let activeDragSource = null; // 'pool' | { tierIndex: number, itemIndex: number }

    // Touch drag state
    let touchTimer = null;
    let isTouchDragging = false;
    let touchSource = null;
    let touchItem = null;
    let touchAvatar = null;
    let showTierTitles = true;

    // Helper: Convert remote image to base64 Data URL to prevent canvas tainting in html2canvas
    async function convertImageToDataURL(url) {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;

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
            img.src = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        });

        try {
            const res = await tryCanvas();
            if (res) return res;
        } catch (e) {}

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

    function renderTierlist(container) {
        const state = window.AniHub.state;

        container.innerHTML = `
            <div class="py-6 max-w-7xl mx-auto px-4 md:px-6 space-y-4 animate-fade-in">
                <!-- Top Workspace Panel Container -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface px-4 py-4 rounded-lg border border-border">
                    <!-- Left: Placed & Unranked Counter Badge -->
                    <div class="flex items-center">
                        <span id="tierlist-count-badge" class="font-mono text-xs font-semibold px-3 py-1 rounded-md bg-bg border border-border text-accent shadow-xs">
                            0 Placed • 0 Unranked
                        </span>
                    </div>

                    <!-- Global Actions Toolbar -->
                    <div class="flex flex-wrap items-center gap-2">
                        <button id="btn-open-tier-settings" class="h-8 px-3 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs">
                            <i class="fas fa-sliders-h text-accent text-xs"></i>
                            <span>Customize Tiers</span>
                        </button>
                        <button id="btn-add-quick-tier" class="h-8 px-2.5 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary text-xs font-medium transition-colors flex items-center gap-1 shadow-xs" title="Add Tier at Bottom">
                            <i class="fas fa-plus text-[10px]"></i>
                            <span>Add Tier</span>
                        </button>
                        <button id="btn-reset-to-pool" class="h-8 px-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1 shadow-xs" title="Move all placed items back to pool">
                            <i class="fas fa-undo-alt text-[10px]"></i>
                            <span>Reset to Pool</span>
                        </button>
                        <label class="h-8 px-2.5 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-medium flex items-center gap-1.5 cursor-pointer select-none transition-colors shadow-xs" title="Toggle titles visibility on cards">
                            <input type="checkbox" id="toggle-tier-titles" ${showTierTitles ? 'checked' : ''} class="rounded border-border text-accent focus:ring-0">
                            <span>Show Titles</span>
                        </label>
                        <button id="btn-open-tier-export" class="h-8 px-3 rounded-md bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs" title="Export PNG, Text, JSON Backup & Share Link">
                            <i class="fas fa-file-export text-xs"></i>
                            <span>Export</span>
                        </button>
                        <button id="btn-download-tier-png" class="h-8 px-3.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs">
                            <i class="fas fa-download text-xs"></i>
                            <span>Save PNG</span>
                        </button>
                    </div>
                </div>

                <!-- Tiers Matrix Board (Target for PNG capture) -->
                <div class="space-y-4">
                    <div id="tierlist-capture-area" class="p-4 sm:p-5 rounded-lg bg-surface border border-border ${showTierTitles ? '' : 'hide-titles'}">
                        <div class="flex items-center justify-between pb-3 mb-3 border-b border-border">
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-accent"></span>
                                <h2 class="text-xs font-bold text-text-primary uppercase font-mono tracking-wider">Tier Hierarchy</h2>
                            </div>
                            <span class="font-mono text-[11px] text-text-muted">Drag cards directly between tiers & pool</span>
                        </div>

                        <!-- Dynamic Tier Rows Container -->
                        <div id="tier-rows-container" class="space-y-2.5">
                            <!-- Tier rows dynamically rendered here -->
                        </div>
                    </div>
                </div>

                <!-- Unranked Staging Pool -->
                <div class="p-4 sm:p-5 rounded-lg bg-surface border border-border space-y-3">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-accent"></span>
                            <h3 class="text-xs font-bold text-text-primary uppercase font-mono tracking-wider">Unranked Staging Pool</h3>
                            <span id="pool-count-badge" class="font-mono text-[10px] font-semibold px-1.5 py-0.2 rounded bg-bg border border-border text-accent">0</span>
                        </div>

                        <div class="flex items-center gap-2">
                            <!-- Pool Search Filter -->
                            <div class="relative w-48 sm:w-56">
                                <input type="text" id="input-pool-search" placeholder="Filter pool..." class="h-8 w-full pl-7 pr-3 rounded-md bg-bg border border-border text-xs text-text-primary focus:outline-none focus:border-accent font-mono">
                                <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted"></i>
                            </div>

                            <button id="btn-clear-pool" class="h-8 px-2.5 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-rose-400 text-xs font-medium transition-colors flex items-center gap-1.5" title="Clear unranked pool">
                                <i class="fas fa-trash-alt text-[10px]"></i>
                                <span>Clear Pool</span>
                            </button>
                        </div>
                    </div>

                    <!-- Pool Drop Zone & Items -->
                    <div id="pool-dropzone" class="pool-container p-3 rounded-md bg-bg border border-dashed border-border min-h-[100px] flex flex-wrap gap-2 items-center transition-colors">
                        <!-- Dynamic pool album cards injected here -->
                    </div>
                </div>

                <!-- Unified Discovery Engine Mount Point -->
                <div class="pt-4">
                    <div class="flex items-center gap-2 mb-4 px-1">
                        <span class="font-mono text-xs uppercase font-bold text-text-muted tracking-wider">Ingest & Discover</span>
                        <div class="h-px bg-border flex-1"></div>
                    </div>
                    <div id="tierlist-discovery-mount"></div>
                </div>
            </div>
        `;

        // Event: Open Tier Settings Modal
        const btnOpenSettings = container.querySelector('#btn-open-tier-settings');
        if (btnOpenSettings) {
            btnOpenSettings.addEventListener('click', () => {
                if (window.AniHub.components.openTierSettingsModal) {
                    window.AniHub.components.openTierSettingsModal();
                }
            });
        }

        // Event: Quick Add Tier
        const btnAddTier = container.querySelector('#btn-add-quick-tier');
        if (btnAddTier) {
            btnAddTier.addEventListener('click', () => {
                state.addTier();
                if (window.AniHub.toast) window.AniHub.toast.info('New tier added at the bottom');
            });
        }

        // Event: Reset to Pool
        const btnResetToPool = container.querySelector('#btn-reset-to-pool');
        if (btnResetToPool) {
            btnResetToPool.addEventListener('click', () => {
                const tiers = state.tierlistTiers || [];
                const totalPlaced = tiers.reduce((acc, t) => acc + (t.items ? t.items.length : 0), 0);
                if (totalPlaced === 0) {
                    if (window.AniHub.toast) window.AniHub.toast.info('All items are already in the unranked pool');
                    return;
                }
                if (confirm(`Move all ${totalPlaced} placed item(s) back into the unranked pool?`)) {
                    state.returnAllTiersToPool();
                    if (window.AniHub.toast) window.AniHub.toast.success('All items returned to the unranked pool');
                }
            });
        }

        // Event: Toggle Titles on Cards
        const toggleTitlesBtn = container.querySelector('#toggle-tier-titles');
        if (toggleTitlesBtn) {
            toggleTitlesBtn.addEventListener('change', (e) => {
                showTierTitles = e.target.checked;
                const captureArea = container.querySelector('#tierlist-capture-area');
                if (captureArea) {
                    if (showTierTitles) captureArea.classList.remove('hide-titles');
                    else captureArea.classList.add('hide-titles');
                }
                const poolDropzone = container.querySelector('#pool-dropzone');
                if (poolDropzone) {
                    if (showTierTitles) poolDropzone.classList.remove('hide-titles');
                    else poolDropzone.classList.add('hide-titles');
                }
                updateTierlistView();
            });
        }

        // Event: Clear Pool
        const btnClearPool = container.querySelector('#btn-clear-pool');
        if (btnClearPool) {
            btnClearPool.addEventListener('click', () => {
                const pool = state.tierlistPool || [];
                if (pool.length === 0) return;
                if (confirm(`Remove all ${pool.length} items from the unranked pool?`)) {
                    state.setTierlistPool([]);
                    if (window.AniHub.toast) window.AniHub.toast.info('Unranked pool cleared');
                }
            });
        }

        // Event: Pool Search Filter
        const inputPoolSearch = container.querySelector('#input-pool-search');
        if (inputPoolSearch) {
            inputPoolSearch.addEventListener('input', (e) => {
                poolSearchFilter = e.target.value.toLowerCase().trim();
                renderPoolItems();
            });
        }

        // Open Unified Export & Share Studio

        // Open Unified Export & Share Studio
        const btnOpenExport = container.querySelector('#btn-open-tier-export');
        if (btnOpenExport) {
            btnOpenExport.addEventListener('click', () => {
                if (window.AniHub.exportModal) {
                    window.AniHub.exportModal.open({
                        context: 'tierlist',
                        defaultTab: 'png',
                        element: container.querySelector('#tierlist-capture-area')
                    });
                }
            });
        }

        // Event: Direct Download PNG without opening modal window
        const btnDownloadPng = container.querySelector('#btn-download-tier-png');
        if (btnDownloadPng) {
            btnDownloadPng.addEventListener('click', () => {
                if (window.AniHub.exportModal?.directDownloadPng) {
                    window.AniHub.exportModal.directDownloadPng('tierlist', container.querySelector('#tierlist-capture-area'));
                } else if (window.AniHub.exportModal) {
                    window.AniHub.exportModal.open({
                        context: 'tierlist',
                        defaultTab: 'png',
                        element: container.querySelector('#tierlist-capture-area')
                    });
                }
            });
        }

        function updateTierlistView() {
            const tiers = state ? (state.tierlistTiers || []) : [];
            const pool = state ? (state.tierlistPool || []) : [];
            const totalPlaced = tiers.reduce((acc, t) => acc + (t.items ? t.items.length : 0), 0);

            const countBadge = container.querySelector('#tierlist-count-badge');
            if (countBadge) {
                countBadge.textContent = `${totalPlaced} Placed • ${pool.length} Unranked`;
            }

            const poolCountBadge = container.querySelector('#pool-count-badge');
            if (poolCountBadge) {
                poolCountBadge.textContent = `${pool.length}`;
            }

            renderTierRows();
            renderPoolItems();
        }

        // Render Tier Rows
        function renderTierRows() {
            const tiers = state ? (state.tierlistTiers || []) : [];
            const tiersContainer = container.querySelector('#tier-rows-container');
            if (!tiersContainer) return;

            if (tiers.length === 0) {
                tiersContainer.innerHTML = `
                    <div class="py-12 text-center text-slate-400">
                        <i class="fas fa-layer-group text-3xl mb-2 opacity-30"></i>
                        <p class="text-xs">No tiers configured. Click "Customize Tiers" or "Add Tier" to create one.</p>
                    </div>
                `;
                return;
            }

            tiersContainer.innerHTML = tiers.map((tier, tIdx) => `
                <div class="box rounded-md border border-border overflow-hidden flex group/row transition-colors" data-tier-idx="${tIdx}">
                    <!-- Tier Label & Inline Controls -->
                    <div class="name w-20 sm:w-24 shrink-0 flex flex-col items-center justify-center p-2 relative select-none border-r border-border" style="background-color: ${tier.color};">
                        <span class="font-bold text-sm sm:text-base text-slate-900 leading-tight text-center break-words tier-label-text cursor-pointer" title="Double click to rename" contenteditable="true" spellcheck="false" data-tier-idx="${tIdx}">
                            ${tier.name}
                        </span>
                        
                        <!-- Row Quick Buttons -->
                        <div class="flex items-center gap-1 mt-1 opacity-0 group-hover/row:opacity-100 transition-opacity bg-black/60 px-1 py-0.5 rounded-sm">
                            <button class="btn-tier-row-up text-white hover:text-amber-200 text-[9px] p-0.5" data-idx="${tIdx}" title="Move Tier Up">
                                <i class="fas fa-chevron-up"></i>
                            </button>
                            <button class="btn-tier-row-down text-white hover:text-amber-200 text-[9px] p-0.5" data-idx="${tIdx}" title="Move Tier Down">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <button class="btn-tier-row-clear text-white hover:text-rose-300 text-[9px] p-0.5" data-idx="${tIdx}" title="Clear all items in this tier">
                                <i class="fas fa-eraser"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Tier Dropzone & Placed Items -->
                    <div class="tier-dropzone flex-1 p-2 bg-bg flex flex-wrap gap-2 min-h-[92px] items-center transition-colors" data-tier-idx="${tIdx}">
                        ${(tier.items && tier.items.length > 0) ? tier.items.map((item, iIdx) => `
                            <div class="album w-16 h-24 sm:w-18 sm:h-26 rounded-sm overflow-hidden border border-border relative group shrink-0 aspect-[2/3]" 
                                 draggable="true" 
                                 data-tier-idx="${tIdx}" 
                                 data-item-idx="${iIdx}" 
                                 title="${item.title}">
                                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover pointer-events-none" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                                
                                <!-- Visible Title Overlay -->
                                <div class="tier-card-title absolute inset-x-0 bottom-0 px-1 pt-3 pb-1 bg-gradient-to-t from-[#090d16] via-[#090d16]/80 to-transparent flex flex-col justify-end pointer-events-none transition-opacity ${showTierTitles ? 'opacity-100' : 'opacity-0'}">
                                    <p class="text-[8px] sm:text-[9px] text-white font-medium leading-tight break-words text-center m-0">${item.title}</p>
                                </div>

                                <!-- Hover Actions Overlay -->
                                <div class="album-overlay p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between z-10">
                                    <div class="flex items-center justify-between">
                                        ${item.custom ? `
                                            <button class="btn-album-rename text-amber-300 hover:text-amber-200 text-[9px]" data-tier-idx="${tIdx}" data-item-idx="${iIdx}" title="Rename">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                        ` : `<span></span>`}
                                        <button class="btn-album-return w-5 h-5 rounded-sm bg-surface/90 hover:bg-surface border border-border text-text-primary text-[9px] flex items-center justify-center transition-colors" data-tier-idx="${tIdx}" data-item-idx="${iIdx}" title="Return to Pool">
                                            <i class="fas fa-undo"></i>
                                        </button>
                                    </div>
                                    <p class="text-[9px] text-white font-medium leading-tight m-0 line-clamp-2">${item.title}</p>
                                </div>
                            </div>
                        `).join('') : `
                            <span class="text-xs text-text-muted italic px-2 pointer-events-none font-mono">Drop items here</span>
                        `}
                    </div>
                </div>
            `).join('');

            // Bind Inline Tier Name Renaming
            tiersContainer.querySelectorAll('.tier-label-text').forEach(label => {
                label.addEventListener('blur', () => {
                    const tIdx = parseInt(label.dataset.tierIdx, 10);
                    const newName = label.textContent.trim();
                    if (newName && tiers[tIdx]) {
                        const updated = [...tiers];
                        updated[tIdx] = { ...updated[tIdx], name: newName };
                        state.setTierlistTiers(updated);
                    }
                });
                label.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        label.blur();
                    }
                });
            });

            // Bind Row Toolbar actions (Move up, Move down, Clear tier)
            tiersContainer.querySelectorAll('.btn-tier-row-up').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    state.moveTier(idx, -1);
                });
            });

            tiersContainer.querySelectorAll('.btn-tier-row-down').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    state.moveTier(idx, 1);
                });
            });

            tiersContainer.querySelectorAll('.btn-tier-row-clear').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(b.dataset.idx, 10);
                    state.clearTier(idx);
                    if (window.AniHub.toast) window.AniHub.toast.info('Tier items returned to pool');
                });
            });

            // Bind Album Return & Rename inside Tiers
            tiersContainer.querySelectorAll('.btn-album-return').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tIdx = parseInt(b.dataset.tierIdx, 10);
                    const iIdx = parseInt(b.dataset.itemIdx, 10);
                    const tier = tiers[tIdx];
                    if (tier && tier.items && tier.items[iIdx]) {
                        const [returnedItem] = tier.items.splice(iIdx, 1);
                        state.setTierlistTiers([...tiers]);
                        state.addTierlistPoolItem(returnedItem);
                    }
                });
            });

            tiersContainer.querySelectorAll('.btn-album-rename').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tIdx = parseInt(b.dataset.tierIdx, 10);
                    const iIdx = parseInt(b.dataset.itemIdx, 10);
                    const item = tiers[tIdx]?.items?.[iIdx];
                    if (!item) return;
                    const newTitle = prompt('Rename this item:', item.title);
                    if (newTitle && newTitle.trim()) {
                        state.renameItem(item.id, newTitle.trim(), 'tierlist');
                    }
                });
            });

            // Bind Tier Dropzones
            const tierDropzones = tiersContainer.querySelectorAll('.tier-dropzone');
            tierDropzones.forEach(zone => {
                const targetTierIdx = parseInt(zone.dataset.tierIdx, 10);

                zone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    zone.closest('.box').classList.add('tier-drag-hover');
                });

                zone.addEventListener('dragleave', (e) => {
                    if (!zone.contains(e.relatedTarget)) {
                        zone.closest('.box').classList.remove('tier-drag-hover');
                    }
                });

                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.closest('.box').classList.remove('tier-drag-hover');
                    if (!activeDragItem) return;

                    // Remove item from its source
                    if (activeDragSource === 'pool') {
                        const pool = [...state.tierlistPool];
                        const filteredPool = pool.filter(i => i.id !== activeDragItem.id);
                        state.setTierlistPool(filteredPool);
                    } else if (activeDragSource && typeof activeDragSource.tierIndex === 'number') {
                        const currentTiers = [...state.tierlistTiers];
                        const sourceTier = currentTiers[activeDragSource.tierIndex];
                        if (sourceTier && sourceTier.items) {
                            sourceTier.items = sourceTier.items.filter(i => i.id !== activeDragItem.id);
                        }
                        state.setTierlistTiers(currentTiers);
                    }

                    // Add to destination tier
                    const updatedTiers = [...state.tierlistTiers];
                    if (updatedTiers[targetTierIdx]) {
                        updatedTiers[targetTierIdx].items = updatedTiers[targetTierIdx].items || [];
                        updatedTiers[targetTierIdx].items.push(activeDragItem);
                        state.setTierlistTiers(updatedTiers);
                    }

                    activeDragItem = null;
                    activeDragSource = null;
                });
            });

            // Bind Drag & Touch Events on Placed Albums
            tiersContainer.querySelectorAll('.album').forEach(albumEl => {
                const tIdx = parseInt(albumEl.dataset.tierIdx, 10);
                const iIdx = parseInt(albumEl.dataset.itemIdx, 10);
                const item = tiers[tIdx]?.items?.[iIdx];
                if (!item) return;

                // Desktop HTML5 Drag
                albumEl.addEventListener('dragstart', (e) => {
                    activeDragItem = item;
                    activeDragSource = { tierIndex: tIdx, itemIndex: iIdx };
                    albumEl.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.id);
                });

                albumEl.addEventListener('dragend', () => {
                    albumEl.classList.remove('dragging');
                    document.querySelectorAll('.box').forEach(b => b.classList.remove('tier-drag-hover'));
                });

                // Mobile Touch Drag
                setupTouchDrag(albumEl, item, { tierIndex: tIdx, itemIndex: iIdx });
            });
        }

        // Render Staging Pool Items
        function renderPoolItems() {
            const pool = state ? (state.tierlistPool || []) : [];
            const poolContainer = container.querySelector('#pool-dropzone');
            if (!poolContainer) return;

            const filtered = poolSearchFilter 
                ? pool.filter(i => (i.title || '').toLowerCase().includes(poolSearchFilter))
                : pool;

            if (filtered.length === 0) {
                poolContainer.innerHTML = pool.length === 0
                    ? `<p class="text-xs text-slate-400 italic px-2 py-4">Pool is empty. Search or import titles using the Discovery Engine below.</p>`
                    : `<p class="text-xs text-slate-400 italic px-2 py-4">No pool items matching "${poolSearchFilter}".</p>`;
                return;
            }

            poolContainer.innerHTML = filtered.map((item, idx) => `
                <div class="album w-16 h-24 rounded-sm overflow-hidden border border-border relative group shrink-0 aspect-[2/3]" 
                     draggable="true" 
                     data-pool-idx="${idx}" 
                     title="${item.title}">
                    <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover pointer-events-none" onerror="this.onerror=null;this.src=window.AniHub?.FALLBACK_POSTER||'';">
                    
                    <!-- Visible Title Overlay -->
                    <div class="tier-card-title absolute inset-x-0 bottom-0 px-1 pt-3 pb-1 bg-gradient-to-t from-[#090d16] via-[#090d16]/80 to-transparent flex flex-col justify-end pointer-events-none transition-opacity ${showTierTitles ? 'opacity-100' : 'opacity-0'}">
                        <p class="text-[8px] sm:text-[9px] text-white font-medium leading-tight break-words text-center m-0">${item.title}</p>
                    </div>

                    <!-- Overlay Actions -->
                    <div class="album-overlay p-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between z-10">
                        <div class="flex items-center justify-between">
                            ${item.custom ? `
                                <button class="btn-pool-rename text-amber-300 hover:text-amber-200 text-[9px]" data-id="${item.id}" title="Rename">
                                    <i class="fas fa-edit"></i>
                                </button>
                            ` : `<span></span>`}
                            <button class="btn-pool-remove w-5 h-5 rounded-sm bg-surface/90 hover:bg-surface border border-border text-rose-400 hover:text-rose-300 text-[9px] flex items-center justify-center transition-colors" data-id="${item.id}" title="Remove from Pool">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <p class="text-[9px] text-white font-medium leading-tight m-0 line-clamp-2">${item.title}</p>
                    </div>
                </div>
            `).join('');

            // Bind Pool Item Actions
            poolContainer.querySelectorAll('.btn-pool-remove').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = b.dataset.id;
                    const updated = state.tierlistPool.filter(i => String(i.id) !== String(id));
                    state.setTierlistPool(updated);
                    if (window.AniHub.toast) window.AniHub.toast.info('Item removed from pool');
                });
            });

            poolContainer.querySelectorAll('.btn-pool-rename').forEach(b => {
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = b.dataset.id;
                    const item = state.tierlistPool.find(i => String(i.id) === String(id));
                    if (!item) return;
                    const newTitle = prompt('Rename this image:', item.title);
                    if (newTitle && newTitle.trim()) {
                        state.renameItem(item.id, newTitle.trim(), 'tierlist');
                    }
                });
            });

            // Bind Drag & Touch on Pool Albums
            poolContainer.querySelectorAll('.album').forEach(albumEl => {
                const idx = parseInt(albumEl.dataset.poolIdx, 10);
                const item = filtered[idx];
                if (!item) return;

                albumEl.addEventListener('dragstart', (e) => {
                    activeDragItem = item;
                    activeDragSource = 'pool';
                    albumEl.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.id);
                });

                albumEl.addEventListener('dragend', () => {
                    albumEl.classList.remove('dragging');
                    poolContainer.classList.remove('tier-drag-hover');
                });

                setupTouchDrag(albumEl, item, 'pool');
            });
        }

        // Bind Pool Dropzone (Receiving items dragged back from tiers)
        const poolDropzone = container.querySelector('#pool-dropzone');
        if (poolDropzone) {
            poolDropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                poolDropzone.classList.add('tier-drag-hover');
            });

            poolDropzone.addEventListener('dragleave', (e) => {
                if (!poolDropzone.contains(e.relatedTarget)) {
                    poolDropzone.classList.remove('tier-drag-hover');
                }
            });

            poolDropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                poolDropzone.classList.remove('tier-drag-hover');
                if (!activeDragItem || activeDragSource === 'pool') return;

                // Remove from source tier
                if (activeDragSource && typeof activeDragSource.tierIndex === 'number') {
                    const tiers = [...state.tierlistTiers];
                    const sourceTier = tiers[activeDragSource.tierIndex];
                    if (sourceTier && sourceTier.items) {
                        sourceTier.items = sourceTier.items.filter(i => i.id !== activeDragItem.id);
                        state.setTierlistTiers(tiers);
                    }
                }

                // Add to pool
                state.addTierlistPoolItem(activeDragItem);
                activeDragItem = null;
                activeDragSource = null;
            });
        }

        // Touch Drag Helper for Mobile Devices
        function setupTouchDrag(element, item, source) {
            element.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return;
                clearTimeout(touchTimer);
                const touch = e.touches[0];
                touchItem = item;
                touchSource = source;

                touchTimer = setTimeout(() => {
                    isTouchDragging = true;
                    element.classList.add('drag-placeholder');

                    if (navigator.vibrate) navigator.vibrate(40);

                    touchAvatar = element.cloneNode(true);
                    touchAvatar.className = 'drag-avatar w-16 h-24 rounded-sm aspect-[2/3] overflow-hidden shadow-2xl border border-accent pointer-events-none fixed z-[9999]';
                    touchAvatar.style.left = `${touch.clientX - 32}px`;
                    touchAvatar.style.top = `${touch.clientY - 48}px`;
                    document.body.appendChild(touchAvatar);
                }, 350);
            }, { passive: true });

            element.addEventListener('touchmove', (e) => {
                if (!isTouchDragging) {
                    clearTimeout(touchTimer);
                    return;
                }
                if (e.cancelable) e.preventDefault();
                const touch = e.touches[0];

                if (touchAvatar) {
                    touchAvatar.style.left = `${touch.clientX - 32}px`;
                    touchAvatar.style.top = `${touch.clientY - 48}px`;
                }

                // Highlight hovered tier or pool dropzone
                const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
                document.querySelectorAll('.box').forEach(b => b.classList.remove('tier-drag-hover'));
                if (poolDropzone) poolDropzone.classList.remove('tier-drag-hover');

                if (elUnder) {
                    const tierBox = elUnder.closest('.box');
                    if (tierBox) {
                        tierBox.classList.add('tier-drag-hover');
                    } else if (elUnder.closest('#pool-dropzone')) {
                        if (poolDropzone) poolDropzone.classList.add('tier-drag-hover');
                    }
                }
            }, { passive: false });

            element.addEventListener('touchend', (e) => {
                clearTimeout(touchTimer);
                if (isTouchDragging) {
                    isTouchDragging = false;
                    element.classList.remove('drag-placeholder');

                    if (touchAvatar) {
                        touchAvatar.remove();
                        touchAvatar = null;
                    }

                    const lastTouch = e.changedTouches[0];
                    const dropTarget = document.elementFromPoint(lastTouch.clientX, lastTouch.clientY);

                    document.querySelectorAll('.box').forEach(b => b.classList.remove('tier-drag-hover'));
                    if (poolDropzone) poolDropzone.classList.remove('tier-drag-hover');

                    if (dropTarget) {
                        const targetTierBox = dropTarget.closest('.box');
                        const targetPool = dropTarget.closest('#pool-dropzone');

                        if (targetTierBox) {
                            const destTierIdx = parseInt(targetTierBox.dataset.tierIdx, 10);
                            executeMove(touchItem, touchSource, { destination: 'tier', tierIndex: destTierIdx });
                        } else if (targetPool) {
                            executeMove(touchItem, touchSource, { destination: 'pool' });
                        }
                    }

                    touchItem = null;
                    touchSource = null;
                }
            });
        }

        function executeMove(item, source, target) {
            if (!item || !target) return;

            // Remove from source
            if (source === 'pool') {
                const pool = state.tierlistPool.filter(i => i.id !== item.id);
                state.setTierlistPool(pool);
            } else if (source && typeof source.tierIndex === 'number') {
                const tiers = [...state.tierlistTiers];
                if (tiers[source.tierIndex]) {
                    tiers[source.tierIndex].items = tiers[source.tierIndex].items.filter(i => i.id !== item.id);
                    state.setTierlistTiers(tiers);
                }
            }

            // Add to destination
            if (target.destination === 'tier') {
                const tiers = [...state.tierlistTiers];
                if (tiers[target.tierIndex]) {
                    tiers[target.tierIndex].items = tiers[target.tierIndex].items || [];
                    tiers[target.tierIndex].items.push(item);
                    state.setTierlistTiers(tiers);
                }
            } else if (target.destination === 'pool') {
                state.addTierlistPoolItem(item);
            }
        }

        // Mount Unified Discovery Engine
        const discoveryMount = container.querySelector('#tierlist-discovery-mount');
        if (discoveryMount && window.AniHub.components.createDiscovery) {
            discoveryInstance = window.AniHub.components.createDiscovery(discoveryMount, {
                targetDestination: 'tierlist'
            });
        }

        // Subscribe to state updates
        if (tierlistUnsub) tierlistUnsub();
        tierlistUnsub = state.on('tierlistChange', () => {
            updateTierlistView();
            if (discoveryInstance && discoveryInstance.updateResultsView) {
                discoveryInstance.updateResultsView();
            }
        });

        // Initial render
        updateTierlistView();
    }

    window.AniHub.views.tierlist = { render: renderTierlist };
})();

/**
 * AniHub Tier Settings Modal Component (Anti-AI Slop Refactor)
 * High-density studio tier customizer with disciplined tokens and hairline borders.
 */

window.AniHub = window.AniHub || {};
window.AniHub.components = window.AniHub.components || {};

(function() {
    const COLOR_PRESETS = [
        { name: 'Crimson', color: '#fe769b' },
        { name: 'Coral', color: '#ff9472' },
        { name: 'Gold', color: '#ffffa6' },
        { name: 'Lime', color: '#9df79d' },
        { name: 'Cyan', color: '#76f8f8' },
        { name: 'Indigo', color: '#9998fe' },
        { name: 'Violet', color: '#ffbafd' },
        { name: 'Slate', color: '#989898' },
        { name: 'Sky', color: '#38bdf8' },
        { name: 'Emerald', color: '#34d399' }
    ];

    let modalElement = null;

    function createModalDom() {
        if (document.getElementById('anihub-tier-settings-modal')) {
            return document.getElementById('anihub-tier-settings-modal');
        }

        const modal = document.createElement('div');
        modal.id = 'anihub-tier-settings-modal';
        modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/70 opacity-0 pointer-events-none transition-opacity duration-150';
        modal.innerHTML = `
            <div class="modal-card bg-surface border border-border rounded-lg shadow-elevated max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden scale-95 transition-transform duration-150">
                <!-- Modal Header -->
                <div class="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-surface">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-md bg-bg border border-border text-accent flex items-center justify-center text-xs">
                            <i class="fas fa-sliders-h"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-text-primary tracking-tight">Tier Customizer</h3>
                            <p class="text-xs text-text-muted">Reorder, rename, and style your tier list matrix</p>
                        </div>
                    </div>
                    <button class="btn-close-tier-settings h-7 w-7 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary flex items-center justify-center text-xs transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Modal Body: Dynamic Tier Rows -->
                <div class="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                    <div class="flex items-center justify-between text-xs text-text-muted px-0.5 font-mono uppercase tracking-wider">
                        <span>Configured Tiers</span>
                        <span id="tier-modal-total-tiers" class="text-accent font-semibold">0 Tiers</span>
                    </div>

                    <div id="tier-settings-rows-list" class="space-y-2">
                        <!-- Injected via renderRows -->
                    </div>

                    <!-- Add New Tier Button -->
                    <button id="btn-add-modal-tier" class="w-full h-9 rounded-md border border-dashed border-border text-text-muted hover:text-accent hover:border-accent bg-bg font-medium text-xs transition-colors flex items-center justify-center gap-2">
                        <i class="fas fa-plus text-[10px]"></i>
                        <span>Add New Tier Row</span>
                    </button>

                    <!-- Quick Palette Presets -->
                    <div class="pt-3 border-t border-border">
                        <span class="text-[11px] font-mono font-bold text-text-muted uppercase tracking-wider block mb-2">Preset Accent Swatches</span>
                        <div class="flex flex-wrap gap-1.5">
                            ${COLOR_PRESETS.map(p => `
                                <div class="w-5 h-5 rounded-sm border border-border cursor-pointer hover:scale-110 transition-transform" style="background-color: ${p.color};" title="${p.name}"></div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="px-5 py-3 border-t border-border bg-surface flex items-center justify-between shrink-0">
                    <button id="btn-reset-default-tiers" class="h-8 px-2.5 rounded-md bg-surface hover:bg-surface-hover border border-border text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5">
                        <i class="fas fa-undo-alt text-[10px]"></i>
                        <span>Reset Defaults</span>
                    </button>
                    <button id="btn-save-tier-settings" class="h-8 px-4 rounded-md bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors flex items-center gap-1.5">
                        <i class="fas fa-check text-xs"></i>
                        <span>Done</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind backdrop and close handlers
        const closeBtn = modal.querySelector('.btn-close-tier-settings');
        const doneBtn = modal.querySelector('#btn-save-tier-settings');

        const closeModal = () => {
            modal.classList.add('opacity-0', 'pointer-events-none');
            const card = modal.querySelector('.modal-card');
            if (card) card.classList.add('scale-95');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (doneBtn) doneBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('pointer-events-none')) {
                closeModal();
            }
        });

        return modal;
    }

    function renderModalRows() {
        const state = window.AniHub.state;
        if (!state || !modalElement) return;

        const listContainer = modalElement.querySelector('#tier-settings-rows-list');
        const totalCountEl = modalElement.querySelector('#tier-modal-total-tiers');
        if (!listContainer) return;

        const tiers = state.tierlistTiers || [];
        if (totalCountEl) totalCountEl.textContent = `${tiers.length} Tiers`;

        if (tiers.length === 0) {
            listContainer.innerHTML = `<div class="p-4 text-center text-xs text-text-muted italic">No tiers configured. Click "Add New Tier" below to begin.</div>`;
            return;
        }

        listContainer.innerHTML = tiers.map((tier, idx) => {
            const count = tier.items ? tier.items.length : 0;
            return `
                <div class="flex items-center gap-2 p-2 rounded-md bg-surface border border-border group hover:border-text-muted/40 transition-colors" data-tier-idx="${idx}">
                    <!-- Color Picker Input -->
                    <div class="relative w-7 h-7 rounded-sm overflow-hidden shrink-0 cursor-pointer border border-border">
                        <input type="color" value="${tier.color || '#3db4f2'}" class="tier-color-input absolute inset-0 w-full h-full opacity-0 cursor-pointer" data-idx="${idx}">
                        <div class="w-full h-full rounded-sm pointer-events-none" style="background-color: ${tier.color || '#3db4f2'};"></div>
                    </div>

                    <!-- Tier Name Input -->
                    <input type="text" value="${tier.name || `Tier ${idx + 1}`}" maxlength="20" placeholder="Tier Name" class="tier-name-input flex-1 h-8 px-2.5 rounded-md bg-bg border border-border text-xs font-semibold text-text-primary focus:outline-none focus:border-accent font-mono" data-idx="${idx}">

                    <!-- Item count badge -->
                    <span class="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-bg border border-border ${count > 0 ? 'text-accent font-semibold' : 'text-text-muted'} shrink-0" title="${count} items currently placed in this tier">
                        ${count} ${count === 1 ? 'item' : 'items'}
                    </span>

                    <!-- Move Controls -->
                    <div class="flex items-center gap-1 shrink-0">
                        <button class="btn-tier-move-up h-7 w-7 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary text-xs flex items-center justify-center transition-colors ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Up">
                            <i class="fas fa-chevron-up text-[10px]"></i>
                        </button>
                        <button class="btn-tier-move-down h-7 w-7 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary text-xs flex items-center justify-center transition-colors ${idx === tiers.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}" data-idx="${idx}" ${idx === tiers.length - 1 ? 'disabled' : ''} title="Move Down">
                            <i class="fas fa-chevron-down text-[10px]"></i>
                        </button>
                        <button class="btn-tier-delete h-7 w-7 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-rose-400 text-xs flex items-center justify-center transition-colors" data-idx="${idx}" title="Delete tier (items return to pool)">
                            <i class="fas fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach listeners
        listContainer.querySelectorAll('.tier-color-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                if (tiers[idx]) {
                    const updated = [...tiers];
                    updated[idx] = { ...updated[idx], color: e.target.value };
                    state.setTierlistTiers(updated);
                    // Update preview block
                    const preview = e.target.nextElementSibling;
                    if (preview) preview.style.backgroundColor = e.target.value;
                }
            });
        });

        listContainer.querySelectorAll('.tier-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                const val = e.target.value.trim();
                if (tiers[idx] && val) {
                    const updated = [...tiers];
                    updated[idx] = { ...updated[idx], name: val };
                    state.setTierlistTiers(updated);
                }
            });
        });

        listContainer.querySelectorAll('.btn-tier-move-up').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                state.moveTier(idx, -1);
                renderModalRows();
            });
        });

        listContainer.querySelectorAll('.btn-tier-move-down').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                state.moveTier(idx, 1);
                renderModalRows();
            });
        });

        listContainer.querySelectorAll('.btn-tier-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const tier = tiers[idx];
                const count = tier && tier.items ? tier.items.length : 0;
                const msg = count > 0 
                    ? `Delete "${tier.name}"? Its ${count} item(s) will return to the Unranked Pool.`
                    : `Delete "${tier.name}"?`;
                if (confirm(msg)) {
                    state.deleteTier(idx);
                    renderModalRows();
                    if (window.AniHub.toast) window.AniHub.toast.info(`Tier "${tier.name}" deleted.`);
                }
            });
        });
    }

    function openTierSettingsModal() {
        modalElement = createModalDom();
        renderModalRows();

        const state = window.AniHub.state;

        // Add tier button
        const addBtn = modalElement.querySelector('#btn-add-modal-tier');
        if (addBtn) {
            addBtn.onclick = () => {
                state.addTier();
                renderModalRows();
            };
        }

        // Reset default tiers button
        const resetBtn = modalElement.querySelector('#btn-reset-default-tiers');
        if (resetBtn) {
            resetBtn.onclick = () => {
                if (confirm('Reset tiers to standard S, A, B, C, D, E, F? Placed items will be kept and moved to the pool.')) {
                    state.resetTiersToDefault();
                    renderModalRows();
                    if (window.AniHub.toast) window.AniHub.toast.info('Tiers reset to default configuration.');
                }
            };
        }

        // Reveal modal
        modalElement.classList.remove('opacity-0', 'pointer-events-none');
        const card = modalElement.querySelector('.modal-card');
        if (card) card.classList.remove('scale-95');
    }

    window.AniHub.components.openTierSettingsModal = openTierSettingsModal;
})();

/**
 * AniHub Unified Export & Share Engine Modal
 * Lossless PNG rendering, formatted text output, JSON backup/restore, and URL share link generation.
 */

window.AniHub = window.AniHub || {};
window.AniHub.components = window.AniHub.components || {};

(function() {
    let modalElement = null;
    let activeContext = 'ranker'; // 'ranker' | 'tierlist'
    let currentTab = 'png';       // 'png' | 'text' | 'json' | 'share'
    let customCaptureTarget = null;
    let isRenderingPng = false;

    // Helper: Multi-strategy image pre-conversion to Base64 to bypass CORS in html2canvas
    async function convertImageToDataURL(url) {
        if (!url || typeof url !== 'string') return url;
        if (url.startsWith('data:')) return url;

        // Strategy 1: In-memory image element with crossOrigin
        const tryCanvas = () => new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const timeout = setTimeout(() => reject(new Error('Timeout loading image')), 4000);
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

    // Helper: Base64 UTF-8 safe encode/decode
    function safeBtoa(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode('0x' + p1);
        }));
    }

    function safeAtob(str) {
        return decodeURIComponent(Array.prototype.map.call(atob(str), (c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    function createModalDom() {
        if (document.getElementById('anihub-export-modal')) {
            return document.getElementById('anihub-export-modal');
        }

        const modal = document.createElement('div');
        modal.id = 'anihub-export-modal';
        modal.className = 'fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6 bg-black/70 opacity-0 pointer-events-none transition-opacity duration-150';
        modal.innerHTML = `
            <div class="modal-card bg-surface border border-border rounded-lg shadow-elevated max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden scale-95 transition-transform duration-150">
                <!-- Header -->
                <div class="px-5 py-3.5 border-b border-border flex items-center justify-between shrink-0 bg-surface">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-md bg-accent text-accent-fg flex items-center justify-center text-xs font-bold">
                            <i class="fas fa-file-export"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="text-sm font-bold text-text-primary tracking-tight">Export & Share Studio</h3>
                                <span id="export-modal-badge" class="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-bg border border-border text-accent">
                                    AniRanker
                                </span>
                            </div>
                            <p class="text-xs text-text-muted">High-DPI graphics, plaintext lists, JSON backups & share links</p>
                        </div>
                    </div>
                    <button class="btn-close-export-modal h-7 w-7 rounded-md bg-bg hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary flex items-center justify-center text-xs transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Navigation Tabs -->
                <div class="flex border-b border-border px-5 pt-2 gap-1 bg-surface shrink-0 overflow-x-auto custom-scrollbar">
                    <button id="tab-btn-png" data-tab="png" class="export-tab-btn flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 border-accent text-accent transition-colors whitespace-nowrap">
                        <i class="fas fa-image text-xs"></i>
                        <span>PNG Graphic</span>
                    </button>
                    <button id="tab-btn-text" data-tab="text" class="export-tab-btn flex items-center gap-2 pb-2.5 px-3 text-xs font-medium border-b-2 border-transparent text-text-muted hover:text-text-primary transition-colors whitespace-nowrap">
                        <i class="fas fa-align-left text-xs"></i>
                        <span>Plain Text</span>
                    </button>
                    <button id="tab-btn-json" data-tab="json" class="export-tab-btn flex items-center gap-2 pb-2.5 px-3 text-xs font-medium border-b-2 border-transparent text-text-muted hover:text-text-primary transition-colors whitespace-nowrap">
                        <i class="fas fa-database text-xs"></i>
                        <span>JSON Backup & Restore</span>
                    </button>
                    <button id="tab-btn-share" data-tab="share" class="export-tab-btn flex items-center gap-2 pb-2.5 px-3 text-xs font-medium border-b-2 border-transparent text-text-muted hover:text-text-primary transition-colors whitespace-nowrap">
                        <i class="fas fa-share-alt text-xs"></i>
                        <span>Share Link & QR</span>
                    </button>
                </div>

                <!-- Modal Body (Panels) -->
                <div class="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    
                    <!-- TAB 1: PNG GRAPHIC -->
                    <div id="panel-export-png" class="export-panel space-y-3">
                        <div class="p-4 rounded-md bg-bg border border-border space-y-3">
                            <h4 class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">Canvas Configuration</h4>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <!-- Resolution Scale -->
                                <div class="sm:col-span-2">
                                    <label class="block text-text-muted font-medium mb-1">Render Quality / Scale</label>
                                    <select id="export-png-scale" class="w-full h-8 px-2.5 rounded-md bg-surface border border-border text-text-primary font-mono text-xs focus:outline-none focus:border-accent">
                                        <option value="1">Standard (1x - Fast)</option>
                                        <option value="2" selected>Retina High-Res (2x - Recommended)</option>
                                        <option value="3">Studio Ultra HD (3x - Print Quality)</option>
                                    </select>
                                </div>
                            </div>

                            <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                                <!-- Watermark Pill Toggle -->
                                <label class="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-text-primary">
                                    <input type="checkbox" id="export-png-watermark" checked class="rounded border-border text-accent focus:ring-0">
                                    <span>Include AniHub Studio Watermark</span>
                                </label>

                                <!-- Filename prefix -->
                                <div class="flex items-center gap-2 text-xs">
                                    <span class="text-text-muted font-mono">File:</span>
                                    <input type="text" id="export-png-filename" class="h-7 px-2 rounded-md bg-surface border border-border font-mono text-xs w-44 text-text-primary focus:outline-none focus:border-accent">
                                </div>
                            </div>
                        </div>

                        <!-- Progress Bar (shown during export) -->
                        <div id="export-png-progress" class="hidden p-3 rounded-md bg-bg border border-border space-y-1.5">
                            <div class="flex items-center justify-between text-xs font-mono font-bold text-accent">
                                <span id="export-png-status-text"><i class="fas fa-spinner fa-spin mr-1.5"></i>Preparing media assets...</span>
                                <span id="export-png-percent">0%</span>
                            </div>
                            <div class="w-full h-1.5 rounded-sm bg-surface overflow-hidden">
                                <div id="export-png-bar" class="h-full bg-accent transition-all duration-150" style="width: 0%;"></div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex flex-wrap items-center gap-2 pt-1">
                            <button id="btn-export-download-png" class="flex-1 h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs">
                                <i class="fas fa-download text-xs"></i>
                                <span>Download PNG Graphic</span>
                            </button>
                            <button id="btn-export-copy-png" class="h-9 px-4 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-primary font-medium text-xs transition-colors flex items-center justify-center gap-2" title="Copy directly to clipboard">
                                <i class="fas fa-copy text-xs"></i>
                                <span>Copy Image</span>
                            </button>
                        </div>
                    </div>

                    <!-- TAB 2: PLAIN TEXT -->
                    <div id="panel-export-text" class="export-panel hidden space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div class="flex items-center gap-2">
                                <span class="text-text-muted font-medium">Format:</span>
                                <div class="flex items-center p-0.5 rounded-md bg-bg border border-border">
                                    <button id="btn-text-format-standard" class="h-6 px-2.5 rounded-sm text-xs font-semibold bg-surface text-text-primary border border-border">Standard</button>
                                    <button id="btn-text-format-markdown" class="h-6 px-2.5 rounded-sm text-xs font-medium text-text-muted hover:text-text-primary">Markdown</button>
                                    <button id="btn-text-format-csv" class="h-6 px-2.5 rounded-sm text-xs font-medium text-text-muted hover:text-text-primary">CSV</button>
                                </div>
                            </div>

                            <span id="export-text-count" class="text-text-muted font-mono text-[11px]">0 items listed</span>
                        </div>

                        <!-- Monospace Preview Box -->
                        <div class="relative">
                            <textarea id="export-text-preview" readonly class="w-full h-52 p-3.5 rounded-md bg-[#090d16] text-text-primary font-mono text-xs leading-relaxed border border-border custom-scrollbar focus:outline-none select-all resize-none"></textarea>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-2">
                            <button id="btn-export-copy-text" class="flex-1 h-9 px-4 rounded-md bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors flex items-center justify-center gap-2">
                                <i class="fas fa-copy text-xs"></i>
                                <span>Copy to Clipboard</span>
                            </button>
                            <button id="btn-export-download-text" class="h-9 px-4 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-primary font-medium text-xs transition-colors flex items-center justify-center gap-2">
                                <i class="fas fa-file-download text-xs"></i>
                                <span>Download .txt</span>
                            </button>
                        </div>
                    </div>

                    <!-- TAB 3: JSON BACKUP & RESTORE -->
                    <div id="panel-export-json" class="export-panel hidden space-y-4">
                        
                        <!-- Backup Section -->
                        <div class="p-4 rounded-md bg-bg border border-border space-y-2.5">
                            <div class="flex items-center justify-between">
                                <h4 class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">Backup Workspace Data</h4>
                                <span class="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border text-accent font-semibold">Schema v2.0</span>
                            </div>
                            <p class="text-xs text-text-muted leading-relaxed">
                                Save a portable JSON snapshot containing your custom titles, tier settings, ranked order, and images for easy recovery or transfer.
                            </p>

                            <div class="flex items-center gap-4 text-xs font-medium text-text-primary pt-1">
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="radio" name="json-scope" value="active" checked class="text-accent focus:ring-0">
                                    <span id="json-scope-active-label">Active Workspace Only</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="radio" name="json-scope" value="all" class="text-accent focus:ring-0">
                                    <span>Complete AniHub Suite (Both)</span>
                                </label>
                            </div>

                            <button id="btn-export-download-json" class="w-full h-8 px-4 rounded-md bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors flex items-center justify-center gap-2">
                                <i class="fas fa-download text-xs"></i>
                                <span>Download JSON Backup</span>
                            </button>
                        </div>

                        <!-- Restore Section -->
                        <div class="p-4 rounded-md bg-bg border border-border space-y-2.5">
                            <div class="flex items-center justify-between">
                                <h4 class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">Restore / Import from File</h4>
                                <span class="font-mono text-[10px] text-text-muted">Supports v2 & legacy formats</span>
                            </div>

                            <!-- Dropzone & File Input -->
                            <div id="json-restore-dropzone" class="border border-dashed border-border hover:border-accent rounded-md p-5 text-center cursor-pointer transition-colors bg-surface group">
                                <input type="file" id="json-restore-file-input" accept=".json,application/json" class="hidden">
                                <div class="w-8 h-8 rounded-md bg-bg border border-border text-accent flex items-center justify-center text-sm mx-auto mb-2">
                                    <i class="fas fa-file-upload"></i>
                                </div>
                                <p class="text-xs font-semibold text-text-primary">
                                    Click to select JSON file, or drag & drop here
                                </p>
                                <p class="text-[11px] font-mono text-text-muted mt-0.5">
                                    Compatible with .json files from AniHub, AniRanker, and AniTierlist
                                </p>
                            </div>

                            <!-- Import Options -->
                            <div class="flex items-center justify-between gap-4 text-xs font-medium text-text-primary pt-0.5">
                                <div class="flex items-center gap-3">
                                    <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input type="radio" name="json-import-mode" value="replace" checked class="text-accent focus:ring-0">
                                        <span>Replace Current</span>
                                    </label>
                                    <label class="flex items-center gap-1.5 cursor-pointer select-none">
                                        <input type="radio" name="json-import-mode" value="append" class="text-accent focus:ring-0">
                                        <span>Append / Merge</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- TAB 4: SHARE LINK & QR -->
                    <div id="panel-export-share" class="export-panel hidden space-y-3">
                        <div class="p-4 rounded-md bg-bg border border-border space-y-2.5">
                            <h4 class="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">Interactive Web Share Link</h4>
                            <p class="text-xs text-text-muted leading-relaxed">
                                Share your list with friends! This URL encodes your list items directly into the link hash so anyone can view or clone your setup instantly without needing a server account.
                            </p>

                            <!-- Copyable Link Input -->
                            <div class="flex items-center gap-2">
                                <input type="text" id="export-share-url" readonly class="flex-1 h-8 px-2.5 rounded-md bg-surface border border-border font-mono text-[11px] text-text-primary focus:outline-none select-all">
                                <button id="btn-export-copy-share-url" class="h-8 px-3 rounded-md bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap">
                                    <i class="fas fa-copy text-xs"></i>
                                    <span>Copy</span>
                                </button>
                            </div>
                        </div>

                        <!-- Mobile QR Code Preview -->
                        <div class="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-md bg-bg border border-border">
                            <div class="w-32 h-32 rounded-md bg-white p-2 border border-border flex items-center justify-center shrink-0">
                                <img id="export-share-qr-img" src="" alt="Share QR Code" class="w-full h-full object-contain">
                            </div>
                            <div class="space-y-1 text-center sm:text-left">
                                <div class="flex items-center justify-center sm:justify-start gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
                                    <h5 class="text-xs font-bold uppercase font-mono tracking-wide text-text-primary">Scan & View on Mobile</h5>
                                </div>
                                <p class="text-xs text-text-muted leading-relaxed">
                                    Scan this QR code with any camera phone to load your live list on mobile and test responsive touch reordering!
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setupModalEvents(modal);
        return modal;
    }

    function setupModalEvents(modal) {
        // Close modal handlers
        const closeBtn = modal.querySelector('.btn-close-export-modal');
        closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('pointer-events-none')) {
                closeModal();
            }
        });

        // Tab Switching
        const tabBtns = modal.querySelectorAll('.export-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab);
            });
        });

        // PNG Download & Copy
        const btnDownloadPng = modal.querySelector('#btn-export-download-png');
        if (btnDownloadPng) {
            btnDownloadPng.addEventListener('click', () => renderAndDownloadPng(false));
        }

        const btnCopyPng = modal.querySelector('#btn-export-copy-png');
        if (btnCopyPng) {
            btnCopyPng.addEventListener('click', () => renderAndDownloadPng(true));
        }

        // Text Export Format Switching
        let currentTextFormat = 'standard';
        const formatBtns = {
            standard: modal.querySelector('#btn-text-format-standard'),
            markdown: modal.querySelector('#btn-text-format-markdown'),
            csv: modal.querySelector('#btn-text-format-csv'),
        };

        Object.keys(formatBtns).forEach(key => {
            const btn = formatBtns[key];
            if (btn) {
                btn.addEventListener('click', () => {
                    Object.values(formatBtns).forEach(b => {
                        b.className = 'px-2.5 py-1 rounded-md text-xs font-medium text-text-muted hover:text-text-primary transition-colors';
                    });
                    btn.className = 'px-2.5 py-1 rounded-md text-xs font-bold bg-surface-active text-text-primary border border-border shadow-xs';
                    currentTextFormat = key;
                    updateTextPreview(currentTextFormat);
                });
            }
        });

        // Copy Text
        const btnCopyText = modal.querySelector('#btn-export-copy-text');
        if (btnCopyText) {
            btnCopyText.addEventListener('click', () => {
                const preview = modal.querySelector('#export-text-preview');
                if (preview && preview.value) {
                    navigator.clipboard.writeText(preview.value).then(() => {
                        const originalHtml = btnCopyText.innerHTML;
                        btnCopyText.innerHTML = '<i class="fas fa-check"></i><span>Copied to Clipboard!</span>';
                        if (window.AniHub.toast) window.AniHub.toast.success('Text copied to clipboard!');
                        setTimeout(() => {
                            btnCopyText.innerHTML = originalHtml;
                        }, 2000);
                    }).catch(() => {
                        if (window.AniHub.toast) window.AniHub.toast.error('Failed to copy text.');
                    });
                }
            });
        }

        // Download Text
        const btnDownloadText = modal.querySelector('#btn-export-download-text');
        if (btnDownloadText) {
            btnDownloadText.addEventListener('click', () => {
                const preview = modal.querySelector('#export-text-preview');
                if (!preview || !preview.value) return;

                const blob = new Blob([preview.value], { type: 'text/plain;charset=utf-8' });
                const ext = currentTextFormat === 'markdown' ? 'md' : currentTextFormat === 'csv' ? 'csv' : 'txt';
                const filename = `anihub-${activeContext}-${new Date().toISOString().slice(0, 10)}.${ext}`;

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                if (window.AniHub.toast) window.AniHub.toast.success(`Downloaded ${filename}`);
            });
        }

        // JSON Download Backup
        const btnDownloadJson = modal.querySelector('#btn-export-download-json');
        if (btnDownloadJson) {
            btnDownloadJson.addEventListener('click', () => {
                const scope = modal.querySelector('input[name="json-scope"]:checked')?.value || 'active';
                downloadJsonBackup(scope);
            });
        }

        // JSON Restore Dropzone & File Input
        const dropzone = modal.querySelector('#json-restore-dropzone');
        const fileInput = modal.querySelector('#json-restore-file-input');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('border-accent', 'bg-accent/5');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('border-accent', 'bg-accent/5');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-accent', 'bg-accent/5');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    processJsonRestoreFile(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    processJsonRestoreFile(e.target.files[0]);
                    e.target.value = ''; // Reset
                }
            });
        }

        // Copy Share URL
        const btnCopyShare = modal.querySelector('#btn-export-copy-share-url');
        if (btnCopyShare) {
            btnCopyShare.addEventListener('click', () => {
                const urlInput = modal.querySelector('#export-share-url');
                if (urlInput && urlInput.value) {
                    navigator.clipboard.writeText(urlInput.value).then(() => {
                        const originalHtml = btnCopyShare.innerHTML;
                        btnCopyShare.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                        if (window.AniHub.toast) window.AniHub.toast.success('Share link copied!');
                        setTimeout(() => {
                            btnCopyShare.innerHTML = originalHtml;
                        }, 2000);
                    });
                }
            });
        }
    }

    function switchTab(tabName) {
        if (!modalElement) return;
        currentTab = tabName;

        const tabBtns = modalElement.querySelectorAll('.export-tab-btn');
        const panels = modalElement.querySelectorAll('.export-panel');

        tabBtns.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.className = 'export-tab-btn flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 border-accent text-accent transition-colors whitespace-nowrap';
            } else {
                btn.className = 'export-tab-btn flex items-center gap-2 pb-2.5 px-3 text-xs font-medium border-b-2 border-transparent text-text-muted hover:text-text-primary transition-colors whitespace-nowrap';
            }
        });

        panels.forEach(panel => {
            if (panel.id === `panel-export-${tabName}`) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });

        // Trigger tab content updates
        if (tabName === 'text') {
            updateTextPreview('standard');
        } else if (tabName === 'share') {
            updateShareLink();
        }
    }

    function openModal(options = {}) {
        modalElement = createModalDom();
        activeContext = options.context || (window.location.hash.includes('tierlist') ? 'tierlist' : 'ranker');
        currentTab = options.defaultTab || 'png';
        customCaptureTarget = options.element || null;

        // Update badge
        const badge = modalElement.querySelector('#export-modal-badge');
        if (badge) {
            badge.textContent = activeContext === 'tierlist' ? 'AniTierlist' : 'AniRanker';
            badge.className = 'font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-bg border border-border text-accent';
        }

        // Set default filename
        const filenameInput = modalElement.querySelector('#export-png-filename');
        if (filenameInput) {
            const today = new Date().toISOString().slice(0, 10);
            filenameInput.value = `anihub-${activeContext}-${today}`;
        }

        // Scope active label in JSON
        const activeScopeLabel = modalElement.querySelector('#json-scope-active-label');
        if (activeScopeLabel) {
            activeScopeLabel.textContent = `Active Workspace Only (${activeContext === 'tierlist' ? 'AniTierlist' : 'AniRanker'})`;
        }

        switchTab(currentTab);

        // Show modal
        modalElement.classList.remove('opacity-0', 'pointer-events-none');
        const card = modalElement.querySelector('.modal-card');
        if (card) {
            card.classList.remove('scale-95');
            card.classList.add('scale-100');
        }
    }

    function closeModal() {
        if (!modalElement) return;
        modalElement.classList.add('opacity-0', 'pointer-events-none');
        const card = modalElement.querySelector('.modal-card');
        if (card) {
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
        }
    }

    // --- PNG RENDERING ENGINE ---
    async function renderAndDownloadPng(copyToClipboard = false) {
        if (isRenderingPng) return;
        const state = window.AniHub.state;
        const modal = modalElement;

        // Locate element to capture
        let targetEl = customCaptureTarget;
        if (!targetEl) {
            if (activeContext === 'ranker') {
                targetEl = document.getElementById('ranker-export-canvas') || document.querySelector('#ranker-grid-panel');
            } else {
                targetEl = document.getElementById('tierlist-capture-area');
            }
        }

        if (!targetEl) {
            if (window.AniHub.toast) window.AniHub.toast.error('Visual board target not found in view.');
            return;
        }

        if (typeof html2canvas === 'undefined') {
            if (window.AniHub.toast) window.AniHub.toast.error('html2canvas rendering library not loaded.');
            return;
        }

        // Options from modal inputs
        const scaleVal = parseInt(modal.querySelector('#export-png-scale')?.value || '2', 10);
        const bgVal = modal.querySelector('#export-png-bg')?.value || 'slate';
        const includeWatermark = modal.querySelector('#export-png-watermark')?.checked ?? true;
        const filenamePrefix = (modal.querySelector('#export-png-filename')?.value || `anihub-${activeContext}`).trim();

        let bgColor = '#0f172a';
        if (bgVal === 'light') {
            bgColor = '#ffffff';
        } else if (bgVal === 'theme') {
            bgColor = document.documentElement.classList.contains('dark') ? '#0f172a' : '#f8fafc';
        }

        // Show Progress UI
        isRenderingPng = true;
        const progressContainer = modal.querySelector('#export-png-progress');
        const statusText = modal.querySelector('#export-png-status-text');
        const percentText = modal.querySelector('#export-png-percent');
        const progressBar = modal.querySelector('#export-png-bar');
        const btnDownload = modal.querySelector('#btn-export-download-png');
        const btnCopy = modal.querySelector('#btn-export-copy-png');

        if (progressContainer) progressContainer.classList.remove('hidden');
        if (btnDownload) btnDownload.disabled = true;
        if (btnCopy) btnCopy.disabled = true;

        const updateProgress = (text, percent) => {
            if (statusText) statusText.innerHTML = text;
            if (percentText) percentText.textContent = `${percent}%`;
            if (progressBar) progressBar.style.width = `${percent}%`;
        };

        const originalSources = [];
        let watermarkEl = null;

        try {
            updateProgress('<i class="fas fa-spinner fa-spin mr-1.5"></i>Scanning media elements...', 10);

            // Pre-process images inside targetEl to Data URLs
            const imgEls = targetEl.querySelectorAll('img');
            const totalImgs = imgEls.length;

            for (let i = 0; i < totalImgs; i++) {
                const img = imgEls[i];
                originalSources.push({ img, src: img.src });

                const pct = Math.round(10 + ((i + 1) / (totalImgs || 1)) * 50);
                updateProgress(`<i class="fas fa-spinner fa-spin mr-1.5"></i>Converting asset ${i + 1} of ${totalImgs}...`, pct);

                const dataUrl = await convertImageToDataURL(img.src);
                if (dataUrl) {
                    img.src = dataUrl;
                }
            }

            // Optional Watermark pill
            if (includeWatermark) {
                watermarkEl = document.createElement('div');
                watermarkEl.className = 'anihub-render-watermark flex items-center justify-between px-3.5 py-1.5 mt-3.5 rounded-md bg-bg/90 border border-border text-[11px] text-text-muted font-medium';
                watermarkEl.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
                        <span class="font-bold text-text-primary tracking-tight">AniHub</span>
                        <span>• Curation Suite</span>
                    </div>
                    <span class="font-mono text-[10px] text-text-muted">anihub.local</span>
                `;
                targetEl.appendChild(watermarkEl);
            }

            updateProgress('<i class="fas fa-magic mr-1.5"></i>Synthesizing High-DPI Lossless Canvas...', 75);
            await new Promise(r => setTimeout(r, 150)); // layout sync

            const canvas = await html2canvas(targetEl, {
                backgroundColor: bgColor,
                scale: scaleVal,
                useCORS: true,
                allowTaint: false,
                logging: false
            });

            updateProgress('<i class="fas fa-check mr-1.5"></i>Export finalized!', 100);

            if (copyToClipboard && navigator.clipboard && window.ClipboardItem) {
                // Copy PNG directly to clipboard
                canvas.toBlob(async (blob) => {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        if (window.AniHub.toast) window.AniHub.toast.success('PNG copied directly to clipboard!');
                    } catch (err) {
                        console.error('Clipboard write error:', err);
                        // Fallback download if clipboard access is denied
                        const link = document.createElement('a');
                        link.download = `${filenamePrefix}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                        if (window.AniHub.toast) window.AniHub.toast.warning('Clipboard blocked; downloaded file instead.');
                    }
                }, 'image/png');
            } else {
                // Regular file download
                const link = document.createElement('a');
                link.download = `${filenamePrefix}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                if (window.AniHub.toast) window.AniHub.toast.success(`Exported ${filenamePrefix}.png successfully!`);
            }

        } catch (err) {
            console.error('PNG Render Error:', err);
            if (window.AniHub.toast) window.AniHub.toast.error('PNG Render failed. Check console for details.');
        } finally {
            // Restore images and clean up watermark
            originalSources.forEach(({ img, src }) => {
                img.src = src;
            });
            if (watermarkEl && watermarkEl.parentNode) {
                watermarkEl.parentNode.removeChild(watermarkEl);
            }

            isRenderingPng = false;
            if (progressContainer) {
                setTimeout(() => {
                    progressContainer.classList.add('hidden');
                }, 1000);
            }
            if (btnDownload) btnDownload.disabled = false;
            if (btnCopy) btnCopy.disabled = false;
        }
    }

    // --- PLAIN TEXT EXPORT ENGINE ---
    function generatePlainText(format = 'standard') {
        const state = window.AniHub.state;
        const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

        if (activeContext === 'ranker') {
            const items = state ? state.rankerItems || [] : [];
            if (items.length === 0) return 'No items in AniRanker list.';

            if (format === 'markdown') {
                let md = `# AniRanker Rankings\n*Exported on ${today} • ${items.length} titles*\n\n`;
                items.forEach((item, idx) => {
                    const title = item.title || item.name || 'Untitled';
                    const seriesOrFmt = (item.type === 'CHARACTER' && item.seriesTitle) 
                        ? item.seriesTitle 
                        : item.format;
                    const fmt = seriesOrFmt ? ` [${seriesOrFmt}]` : '';
                    md += `${idx + 1}. **${title}**${fmt}\n`;
                });
                return md;
            } else if (format === 'csv') {
                let csv = `Rank,Title,Type / Series,AniList ID\n`;
                items.forEach((item, idx) => {
                    const title = `"${(item.title || item.name || 'Untitled').replace(/"/g, '""')}"`;
                    const typeOrSeries = `"${((item.type === 'CHARACTER' && item.seriesTitle) ? item.seriesTitle : (item.format || item.type || 'MEDIA')).replace(/"/g, '""')}"`;
                    csv += `${idx + 1},${title},${typeOrSeries},${item.id || ''}\n`;
                });
                return csv;
            } else {
                let text = `====================================\n`;
                text += `  ANIHUB RANKER LIST (${today})\n`;
                text += `  Total: ${items.length} Items\n`;
                text += `====================================\n\n`;
                items.forEach((item, idx) => {
                    const title = item.title || item.name || 'Untitled';
                    const seriesOrFmt = (item.type === 'CHARACTER' && item.seriesTitle) 
                        ? item.seriesTitle 
                        : item.format;
                    const fmt = seriesOrFmt ? ` (${seriesOrFmt})` : '';
                    text += `${(idx + 1).toString().padStart(2, ' ')}. ${title}${fmt}\n`;
                });
                return text;
            }
        } else {
            // Tierlist context
            const tiers = state ? state.tierlistTiers || [] : [];
            const pool = state ? state.tierlistPool || [] : [];
            const totalItems = tiers.reduce((acc, t) => acc + (t.items?.length || 0), 0) + pool.length;

            if (totalItems === 0) return 'No items in AniTierlist workspace.';

            if (format === 'markdown') {
                let md = `# AniTierlist Matrix\n*Exported on ${today}*\n\n`;
                tiers.forEach(tier => {
                    md += `### ${tier.name} Tier (${tier.items?.length || 0})\n`;
                    if (tier.items && tier.items.length > 0) {
                        tier.items.forEach(item => {
                            md += `- **${item.title || 'Untitled'}**\n`;
                        });
                    } else {
                        md += `*Empty*\n`;
                    }
                    md += `\n`;
                });
                if (pool.length > 0) {
                    md += `### Unranked Staging Pool (${pool.length})\n`;
                    pool.forEach(item => {
                        md += `- ${item.title || 'Untitled'}\n`;
                    });
                }
                return md;
            } else if (format === 'csv') {
                let csv = `Tier,Title,ID\n`;
                tiers.forEach(tier => {
                    (tier.items || []).forEach(item => {
                        const title = `"${(item.title || 'Untitled').replace(/"/g, '""')}"`;
                        csv += `"${tier.name}",${title},${item.id || ''}\n`;
                    });
                });
                pool.forEach(item => {
                    const title = `"${(item.title || 'Untitled').replace(/"/g, '""')}"`;
                    csv += `"Unranked",${title},${item.id || ''}\n`;
                });
                return csv;
            } else {
                let text = `====================================\n`;
                text += `  ANIHUB TIER LIST (${today})\n`;
                text += `====================================\n\n`;
                tiers.forEach(tier => {
                    text += `[${tier.name} TIER] (${tier.items?.length || 0})\n`;
                    text += `------------------------------------\n`;
                    if (tier.items && tier.items.length > 0) {
                        tier.items.forEach(item => {
                            text += `  • ${item.title || 'Untitled'}\n`;
                        });
                    } else {
                        text += `  (Empty)\n`;
                    }
                    text += `\n`;
                });
                if (pool.length > 0) {
                    text += `[UNRANKED STAGING POOL] (${pool.length})\n`;
                    text += `------------------------------------\n`;
                    pool.forEach(item => {
                        text += `  • ${item.title || 'Untitled'}\n`;
                    });
                }
                return text;
            }
        }
    }

    function updateTextPreview(format) {
        if (!modalElement) return;
        const preview = modalElement.querySelector('#export-text-preview');
        const countBadge = modalElement.querySelector('#export-text-count');
        const state = window.AniHub.state;

        if (preview) {
            preview.value = generatePlainText(format);
        }

        if (countBadge && state) {
            if (activeContext === 'ranker') {
                countBadge.textContent = `${state.rankerItems?.length || 0} ranked items`;
            } else {
                const placed = (state.tierlistTiers || []).reduce((a, b) => a + (b.items?.length || 0), 0);
                countBadge.textContent = `${placed} placed • ${state.tierlistPool?.length || 0} unranked`;
            }
        }
    }

    // --- JSON BACKUP & RESTORE ENGINE ---
    function downloadJsonBackup(scope = 'active') {
        const state = window.AniHub.state;
        if (!state) return;

        const backupData = {
            anihub_version: '2.0',
            export_date: new Date().toISOString(),
            source: 'AniHub Curation Suite',
            username: state.username || '',
            active_workspace: activeContext,
            scope: scope
        };

        if (scope === 'active') {
            if (activeContext === 'ranker') {
                backupData.ranker = state.rankerItems || [];
            } else {
                backupData.tierlist = {
                    tiers: state.tierlistTiers || [],
                    pool: state.tierlistPool || [],
                    config: state.tierConfig || []
                };
            }
        } else {
            // Entire Suite
            backupData.ranker = state.rankerItems || [];
            backupData.tierlist = {
                tiers: state.tierlistTiers || [],
                pool: state.tierlistPool || [],
                config: state.tierConfig || []
            };
        }

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const filename = `anihub-backup-${scope === 'all' ? 'full' : activeContext}-${new Date().toISOString().slice(0, 10)}.json`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        if (window.AniHub.toast) window.AniHub.toast.success(`Saved backup to ${filename}`);
    }

    function processJsonRestoreFile(file) {
        if (!file) return;
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                restoreDataFromJson(parsed);
            } catch (err) {
                console.error('JSON Restore parse error:', err);
                if (window.AniHub.toast) window.AniHub.toast.error('Invalid JSON file format.');
            }
        };

        reader.readAsText(file);
    }

    function restoreDataFromJson(data) {
        const state = window.AniHub.state;
        if (!state) return;

        const modal = modalElement;
        const mode = modal?.querySelector('input[name="json-import-mode"]:checked')?.value || 'replace';

        let restoredRankerCount = 0;
        let restoredTierCount = 0;

        // Pattern 1: AniHub v2.0 JSON
        if (data.anihub_version === '2.0' || data.ranker || data.tierlist) {
            // Restore Ranker
            if (Array.isArray(data.ranker)) {
                if (mode === 'replace') {
                    state.setRankerItems(data.ranker);
                } else {
                    const existingIds = new Set((state.rankerItems || []).map(i => i.id));
                    const newItems = data.ranker.filter(i => !existingIds.has(i.id));
                    state.setRankerItems([...state.rankerItems, ...newItems]);
                }
                restoredRankerCount = data.ranker.length;
            }

            // Restore Tierlist
            if (data.tierlist) {
                if (data.tierlist.config) {
                    state.setTierConfig(data.tierlist.config);
                }
                if (Array.isArray(data.tierlist.tiers)) {
                    if (mode === 'replace') {
                        state.setTierlistTiers(data.tierlist.tiers);
                    } else {
                        // Merge tiers
                        const existingTiers = [...state.tierlistTiers];
                        data.tierlist.tiers.forEach((incomingTier, idx) => {
                            if (existingTiers[idx]) {
                                const existingIds = new Set((existingTiers[idx].items || []).map(i => i.id));
                                const additions = (incomingTier.items || []).filter(i => !existingIds.has(i.id));
                                existingTiers[idx].items = [...(existingTiers[idx].items || []), ...additions];
                            } else {
                                existingTiers.push(incomingTier);
                            }
                        });
                        state.setTierlistTiers(existingTiers);
                    }
                    restoredTierCount += data.tierlist.tiers.reduce((a, b) => a + (b.items?.length || 0), 0);
                }
                if (Array.isArray(data.tierlist.pool)) {
                    if (mode === 'replace') {
                        state.setTierlistPool(data.tierlist.pool);
                    } else {
                        const existingPoolIds = new Set((state.tierlistPool || []).map(i => i.id));
                        const additions = data.tierlist.pool.filter(i => !existingPoolIds.has(i.id));
                        state.setTierlistPool([...state.tierlistPool, ...additions]);
                    }
                    restoredTierCount += data.tierlist.pool.length;
                }
            }

            if (data.username) {
                state.setUsername(data.username);
            }
        }
        // Pattern 2: Legacy AniTierlist JSON ({ tierConfig, items: [{ tierIndex, title, image }] })
        else if (data.tierConfig && Array.isArray(data.items)) {
            state.setTierConfig(data.tierConfig);
            const newTiers = data.tierConfig.map(cfg => ({ name: cfg.name, color: cfg.color, items: [] }));
            const newPool = [];

            data.items.forEach(savedItem => {
                const item = {
                    id: savedItem.id || `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    title: savedItem.title || 'Untitled',
                    image: savedItem.image || savedItem.img || ''
                };
                if (savedItem.tierIndex === -1) {
                    newPool.push(item);
                } else if (savedItem.tierIndex >= 0 && savedItem.tierIndex < newTiers.length) {
                    newTiers[savedItem.tierIndex].items.push(item);
                } else {
                    newPool.push(item);
                }
            });

            if (mode === 'replace') {
                state.setTierlistTiers(newTiers);
                state.setTierlistPool(newPool);
            } else {
                state.setTierlistTiers([...state.tierlistTiers, ...newTiers]);
                state.setTierlistPool([...state.tierlistPool, ...newPool]);
            }
            restoredTierCount = data.items.length;
        }
        // Pattern 3: Legacy AniRanker JSON (Array of items)
        else if (Array.isArray(data)) {
            const normalized = data.map(item => ({
                id: item.id || `legacy_rank_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                title: item.title?.romaji || item.title?.english || item.title || item.name?.full || item.name || 'Untitled',
                image: item.image || item.customImage || item.coverImage?.large || '',
                format: item.format || item.type || 'MEDIA'
            }));

            if (mode === 'replace') {
                state.setRankerItems(normalized);
            } else {
                const existingIds = new Set((state.rankerItems || []).map(i => i.id));
                const additions = normalized.filter(i => !existingIds.has(i.id));
                state.setRankerItems([...state.rankerItems, ...additions]);
            }
            restoredRankerCount = normalized.length;
        } else {
            if (window.AniHub.toast) window.AniHub.toast.error('Unrecognized JSON structure.');
            return;
        }

        const msg = [];
        if (restoredRankerCount > 0) msg.push(`${restoredRankerCount} AniRanker items`);
        if (restoredTierCount > 0) msg.push(`${restoredTierCount} AniTierlist items`);
        
        if (window.AniHub.toast) {
            window.AniHub.toast.success(`Successfully restored ${msg.join(' & ')}!`);
        }
        closeModal();
    }

    // --- SHARE LINK & QR ENGINE ---
    function generateShareUrl() {
        const state = window.AniHub.state;
        if (!state) return window.location.href;

        let payload = null;

        if (activeContext === 'ranker') {
            const items = (state.rankerItems || []).slice(0, 50).map(item => ({
                id: item.id,
                t: item.title || item.name || 'Untitled',
                i: item.image || '',
                f: item.format || ''
            }));
            payload = { c: 'ranker', items };
        } else {
            const tiers = (state.tierlistTiers || []).map(t => ({
                n: t.name,
                c: t.color,
                items: (t.items || []).slice(0, 30).map(i => ({
                    id: i.id,
                    t: i.title || 'Untitled',
                    i: i.image || ''
                }))
            }));
            const pool = (state.tierlistPool || []).slice(0, 30).map(i => ({
                id: i.id,
                t: i.title || 'Untitled',
                i: i.image || ''
            }));
            payload = { c: 'tierlist', tiers, pool };
        }

        const jsonStr = JSON.stringify(payload);
        const encoded = safeBtoa(jsonStr);

        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}#/${activeContext}?share=${encodeURIComponent(encoded)}`;
    }

    function updateShareLink() {
        if (!modalElement) return;
        const shareUrlInput = modalElement.querySelector('#export-share-url');
        const qrImg = modalElement.querySelector('#export-share-qr-img');

        const shareUrl = generateShareUrl();

        if (shareUrlInput) {
            shareUrlInput.value = shareUrl;
        }

        if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
        }
    }

    // --- INCOMING SHARE LINK LOADER ---
    function checkIncomingShareLink() {
        const hash = window.location.hash || '';
        if (!hash.includes('share=')) return;

        try {
            const urlParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
            const shareParam = urlParams.get('share');
            if (!shareParam) return;

            const decodedJson = safeAtob(decodeURIComponent(shareParam));
            const data = JSON.parse(decodedJson);
            const state = window.AniHub.state;
            if (!state) return;

            if (data.c === 'ranker' && Array.isArray(data.items)) {
                const restored = data.items.map(item => ({
                    id: item.id || `share_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    title: item.t || 'Untitled',
                    image: item.i || '',
                    format: item.f || 'MEDIA'
                }));
                state.setRankerItems(restored);
                if (window.AniHub.toast) {
                    window.AniHub.toast.success(`Loaded shared AniRanker list with ${restored.length} items!`);
                }
            } else if (data.c === 'tierlist' && Array.isArray(data.tiers)) {
                const restoredTiers = data.tiers.map(t => ({
                    name: t.n,
                    color: t.c,
                    items: (t.items || []).map(i => ({
                        id: i.id || `share_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                        title: i.t || 'Untitled',
                        image: i.i || ''
                    }))
                }));
                const restoredPool = (data.pool || []).map(i => ({
                    id: i.id || `share_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    title: i.t || 'Untitled',
                    image: i.i || ''
                }));
                state.setTierlistTiers(restoredTiers);
                state.setTierlistPool(restoredPool);
                if (window.AniHub.toast) {
                    const count = restoredTiers.reduce((a, b) => a + b.items.length, 0) + restoredPool.length;
                    window.AniHub.toast.success(`Loaded shared AniTierlist with ${count} items!`);
                }
            }

            // Clean query parameter from hash without reloading
            const cleanHash = hash.split('?')[0];
            history.replaceState(null, '', `${window.location.pathname}${cleanHash}`);

        } catch (err) {
            console.error('Failed to parse incoming share link:', err);
        }
    }

    // Direct headless PNG download without opening modal
    async function directDownloadPng(context = 'ranker', customTarget = null, filename = null) {
        let targetEl = customTarget;
        if (!targetEl) {
            if (context === 'ranker') {
                targetEl = document.getElementById('ranker-export-canvas') || document.querySelector('#ranker-grid-panel');
            } else {
                targetEl = document.getElementById('tierlist-capture-area');
            }
        }

        if (!targetEl) {
            if (window.AniHub.toast) window.AniHub.toast.error('Visual capture target not found.');
            return;
        }

        if (typeof html2canvas === 'undefined') {
            if (window.AniHub.toast) window.AniHub.toast.error('html2canvas rendering library not loaded.');
            return;
        }

        const filenamePrefix = (filename || `anihub-${context}`).trim();
        const toastId = window.AniHub.toast ? window.AniHub.toast.info('Synthesizing PNG graphic, please wait...') : null;

        const originalSources = [];
        try {
            const imgEls = targetEl.querySelectorAll('img');
            for (let i = 0; i < imgEls.length; i++) {
                const img = imgEls[i];
                originalSources.push({ img, src: img.src });
                const dataUrl = await convertImageToDataURL(img.src);
                if (dataUrl) img.src = dataUrl;
            }

            await new Promise(r => setTimeout(r, 120));

            const canvas = await html2canvas(targetEl, {
                backgroundColor: '#0b1622',
                scale: 2,
                useCORS: true,
                allowTaint: false,
                logging: false
            });

            const link = document.createElement('a');
            link.download = `${filenamePrefix}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            if (window.AniHub.toast) window.AniHub.toast.success(`Downloaded ${filenamePrefix}.png!`);
        } catch (err) {
            console.error('Direct PNG download error:', err);
            if (window.AniHub.toast) window.AniHub.toast.error('Failed to generate PNG.');
        } finally {
            originalSources.forEach(({ img, src }) => {
                img.src = src;
            });
        }
    }

    // Export API
    window.AniHub.components.exportModal = {
        open: openModal,
        close: closeModal,
        switchTab: switchTab,
        directDownloadPng: directDownloadPng,
        convertImageToDataURL: convertImageToDataURL,
        checkIncomingShareLink: checkIncomingShareLink
    };

    // Alias for quick access
    window.AniHub.exportModal = window.AniHub.components.exportModal;

    // Run share checker when page loads
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkIncomingShareLink, 300);
    });
})();

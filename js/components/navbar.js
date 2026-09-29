/**
 * Universal Navigation Bar Component (Anti-AI Slop Refactor)
 * High-density, tactile 52px studio header with segmented view switcher
 */

window.AniHub = window.AniHub || {};

(function() {
    function renderNavbar(container) {
        if (!container) return;
        const state = window.AniHub.state;

        container.innerHTML = `
            <header class="w-full bg-surface border-b border-border sticky top-0 z-50 transition-colors duration-150">
                <div class="max-w-7xl mx-auto px-4 md:px-6 h-[52px] flex items-center justify-between gap-4">
                    
                    <!-- Logo & Brand -->
                    <a href="#/" class="flex items-center gap-2.5 group focus:outline-none shrink-0">
                        <div class="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-accent-fg font-bold shrink-0">
                            <i class="fas fa-layer-group text-xs"></i>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-base tracking-tight text-text-primary leading-none">AniHub</span>
                            <span class="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-hover border border-border text-text-muted leading-none">v2.0</span>
                        </div>
                    </a>

                    <!-- Desktop Navigation Links (Tight Segmented Control) -->
                    <nav class="hidden md:flex items-center p-0.5 bg-bg rounded-md border border-border">
                        <a href="#/" id="nav-hub" class="nav-item h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center gap-2 text-text-muted hover:text-text-primary">
                            <i class="fas fa-compass text-xs w-4 h-4 flex items-center justify-center"></i>
                            <span>Hub</span>
                        </a>
                        <a href="#/ranker" id="nav-ranker" class="nav-item h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center gap-2 text-text-muted hover:text-text-primary">
                            <i class="fas fa-list-ol text-xs w-4 h-4 flex items-center justify-center"></i>
                            <span>AniRanker</span>
                        </a>
                        <a href="#/tierlist" id="nav-tierlist" class="nav-item h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center gap-2 text-text-muted hover:text-text-primary">
                            <i class="fas fa-th-large text-xs w-4 h-4 flex items-center justify-center"></i>
                            <span>AniTierlist</span>
                        </a>
                    </nav>

                    <!-- Right Side Actions -->
                    <!-- Right Side Actions -->
                    <div class="flex items-center gap-2">
                        <!-- Universal User Button -->
                        <button id="nav-user-btn" class="hidden sm:flex items-center gap-2 h-8 px-2.5 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-primary text-xs font-medium transition-colors" title="Universal AniList Profile">
                            <span id="nav-user-avatar-wrap" class="w-5 h-5 rounded-full overflow-hidden bg-bg border border-border flex items-center justify-center shrink-0">
                                ${state && state.userAvatar ? `
                                    <img src="${state.userAvatar}" alt="${state.username}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user text-accent text-[10px]\\'></i>';">
                                ` : `
                                    <i class="fas fa-user text-accent text-[10px]"></i>
                                `}
                            </span>
                            <span id="nav-user-label" class="max-w-[110px] truncate font-mono text-xs">${state && state.username ? `@${state.username}` : 'Set User'}</span>
                        </button>

                        <!-- Mobile Menu Hamburger -->
                        <button id="mobile-menu-btn" class="md:hidden h-8 w-8 rounded-md bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary flex items-center justify-center text-xs focus:outline-none">
                            <i class="fas fa-bars"></i>
                        </button>
                    </div>
                </div>

                <!-- Mobile Navigation Drawer -->
                <div id="mobile-menu-drawer" class="md:hidden hidden border-t border-border bg-surface px-4 py-3 flex flex-col gap-1 shadow-dropdown">
                    <!-- Mobile User Row -->
                    <button id="mobile-user-row-btn" class="flex items-center justify-between px-3 py-2 rounded-md bg-bg border border-border mb-2 text-left">
                        <div class="flex items-center gap-2 min-w-0">
                            <span id="mobile-user-avatar-wrap" class="w-6 h-6 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center shrink-0">
                                ${state && state.userAvatar ? `
                                    <img src="${state.userAvatar}" alt="${state.username}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user text-accent text-xs\\'></i>';">
                                ` : `
                                    <i class="fas fa-user text-accent text-xs"></i>
                                `}
                            </span>
                            <span id="mobile-user-label" class="font-mono text-xs font-bold text-text-primary truncate">
                                ${state && state.username ? `@${state.username}` : 'Set AniList User'}
                            </span>
                        </div>
                        <i class="fas fa-pen text-text-muted text-[10px] ml-2"></i>
                    </button>

                    <a href="#/" class="mobile-nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-text-primary hover:bg-surface-hover">
                        <i class="fas fa-compass text-accent w-4"></i>
                        <span>Hub</span>
                    </a>
                    <a href="#/ranker" class="mobile-nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-text-primary hover:bg-surface-hover">
                        <i class="fas fa-list-ol text-accent w-4"></i>
                        <span>AniRanker</span>
                    </a>
                    <a href="#/tierlist" class="mobile-nav-item flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-text-primary hover:bg-surface-hover">
                        <i class="fas fa-th-large text-accent w-4"></i>
                        <span>AniTierlist</span>
                    </a>
                </div>
            </header>
        `;

        if (state) {
            const userBtn = container.querySelector('#nav-user-btn');
            const userLabel = container.querySelector('#nav-user-label');
            const mobileUserBtn = container.querySelector('#mobile-user-row-btn');

            function promptSetUser() {
                const current = state.username || '';
                const entered = prompt('Set universal AniList username:', current);
                if (entered !== null) {
                    state.setUsername(entered);
                    if (window.AniHub.toast) {
                        window.AniHub.toast.success(entered.trim() ? `Universal user set to @${entered.trim()}` : 'Universal user cleared');
                    }
                }
            }

            if (userBtn) userBtn.addEventListener('click', promptSetUser);
            if (mobileUserBtn) mobileUserBtn.addEventListener('click', promptSetUser);

            function updateUserUI() {
                const username = state.username || '';
                const avatar = state.userAvatar || '';

                if (userLabel) {
                    userLabel.textContent = username ? `@${username}` : 'Set User';
                }
                const avatarWrap = container.querySelector('#nav-user-avatar-wrap');
                if (avatarWrap) {
                    avatarWrap.innerHTML = avatar 
                        ? `<img src="${avatar}" alt="${username}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user text-accent text-[10px]\\'></i>';">`
                        : `<i class="fas fa-user text-accent text-[10px]"></i>`;
                }

                const mobileLabel = container.querySelector('#mobile-user-label');
                if (mobileLabel) {
                    mobileLabel.textContent = username ? `@${username}` : 'Set AniList User';
                }
                const mobileAvatarWrap = container.querySelector('#mobile-user-avatar-wrap');
                if (mobileAvatarWrap) {
                    mobileAvatarWrap.innerHTML = avatar 
                        ? `<img src="${avatar}" alt="${username}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user text-accent text-xs\\'></i>';">`
                        : `<i class="fas fa-user text-accent text-xs"></i>`;
                }
            }

            state.on('usernameChange', updateUserUI);
            state.on('userAvatarChange', updateUserUI);
        }

        const mobileBtn = container.querySelector('#mobile-menu-btn');
        const mobileDrawer = container.querySelector('#mobile-menu-drawer');

        if (mobileBtn && mobileDrawer) {
            mobileBtn.addEventListener('click', () => {
                mobileDrawer.classList.toggle('hidden');
            });

            mobileDrawer.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    mobileDrawer.classList.add('hidden');
                });
            });
        }

        highlightActiveRoute(container, state ? state.activeRoute : '#/');
    }

    function highlightActiveRoute(container, activeRoute) {
        if (!container) return;

        const navItems = {
            '#/': container.querySelector('#nav-hub'),
            '#/home': container.querySelector('#nav-hub'),
            '#/ranker': container.querySelector('#nav-ranker'),
            '#/tierlist': container.querySelector('#nav-tierlist')
        };

        Object.values(navItems).forEach(el => {
            if (!el) return;
            el.className = 'nav-item h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center gap-2 text-text-muted hover:text-text-primary';
        });

        const activeEl = navItems[activeRoute] || navItems['#/'];
        if (activeEl) {
            activeEl.className = 'nav-item h-7 px-3 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 bg-surface text-text-primary border border-border shadow-xs';
        }
    }

    window.AniHub.navbar = {
        render: renderNavbar,
        highlight: highlightActiveRoute
    };
})();

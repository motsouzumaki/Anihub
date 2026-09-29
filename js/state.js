/**
 * AniHub State Management
 * Centralized state store with persistence and event broadcasting.
 */

window.AniHub = window.AniHub || {};

(function() {
    const STATE_KEYS = {
        THEME: 'anihub_theme',
        RANKER_ITEMS: 'aniRanker_data',
        RANKER_LAYOUT: 'aniRanker_layout',
        TIERLIST_TIERS: 'aniTierList_tiers',
        TIERLIST_POOL: 'aniTierList_pool',
        TIERLIST_CONFIG: 'aniTierList_tierConfig',
        LAST_SEARCH: 'anihub_last_search',
        USERNAME: 'anihub_username',
        USER_AVATAR: 'anihub_user_avatar'
    };

    window.AniHub.FALLBACK_POSTER = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='100%25' height='100%25' fill='%23131722'/%3E%3Crect x='8' y='8' width='184' height='284' rx='4' fill='none' stroke='%232a324b' stroke-width='1.5' stroke-dasharray='4'/%3E%3Ccircle cx='100' cy='120' r='24' fill='%231e293b' stroke='%23334155' stroke-width='1.5'/%3E%3Cpath d='M92 120 L108 120 M100 112 L100 128' stroke='%2364748b' stroke-width='2' stroke-linecap='round'/%3E%3Ctext x='100' y='175' font-family='sans-serif' font-size='11' font-weight='600' fill='%2364748b' text-anchor='middle' letter-spacing='0.5'%3ENO COVER%3C/text%3E%3C/svg%3E";

    const KNOWN_STALE_COVERS = {
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n2bGQYLoRPKi.jpg': 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg',
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-7pdcVzQSkpKq.png': 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-tIUXF2gfU8Sg.jpg',
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-j5tB907t6qog.png': 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-y5gsT1hoHuHw.png',
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-18e3851b3a1a.jpg': 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-2fhDFPCuMNiz.jpg',
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-18e3851b3a1a.jpg': 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-nSWCgQlmOMtj.jpg',
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg': 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg'
    };

    function repairItemImage(item) {
        if (!item) return item;
        if (item.image && KNOWN_STALE_COVERS[item.image]) {
            return Object.assign({}, item, { image: KNOWN_STALE_COVERS[item.image] });
        }
        return item;
    }

    function repairItemList(items) {
        if (!Array.isArray(items)) return [];
        return items.map(repairItemImage);
    }

    function repairTiers(tiers) {
        if (!Array.isArray(tiers)) return [];
        return tiers.map(t => Object.assign({}, t, {
            items: Array.isArray(t.items) ? t.items.map(repairItemImage) : []
        }));
    }

    const DEFAULT_TIER_CONFIG = [
        { id: 1, name: 'S', color: '#fe769b' },
        { id: 2, name: 'A', color: '#ffffa6' },
        { id: 3, name: 'B', color: '#9df79d' },
        { id: 4, name: 'C', color: '#76f8f8' },
        { id: 5, name: 'D', color: '#9998fe' },
        { id: 6, name: 'E', color: '#ffbafd' },
        { id: 7, name: 'F', color: '#989898' }
    ];

    class StateStore {
        constructor() {
            this.listeners = new Map();
            this.theme = this.initTheme();
            this.activeRoute = '#/';
            this.username = this.loadFromStorage(STATE_KEYS.USERNAME, '') || localStorage.getItem('anihub_last_sync_username') || '';
            this.userAvatar = this.loadFromStorage(STATE_KEYS.USER_AVATAR, '') || localStorage.getItem('anihub_user_avatar') || '';
            if (this.username) {
                setTimeout(() => this.fetchUserAvatar(this.username), 100);
            }
            this.rankerItems = repairItemList(this.loadFromStorage(STATE_KEYS.RANKER_ITEMS, []));
            this.tierConfig = this.loadFromStorage(STATE_KEYS.TIERLIST_CONFIG, DEFAULT_TIER_CONFIG);
            this.tierlistTiers = repairTiers(this.loadFromStorage(
                STATE_KEYS.TIERLIST_TIERS,
                this.tierConfig.slice(0, 4).map(cfg => ({ name: cfg.name, color: cfg.color, items: [] }))
            ));
            this.tierlistPool = repairItemList(this.loadFromStorage(STATE_KEYS.TIERLIST_POOL, []));
        }

        // --- Subscription System ---
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(callback);
            return () => this.off(event, callback);
        }

        off(event, callback) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).delete(callback);
            }
        }

        emit(event, data) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).forEach(cb => {
                    try {
                        cb(data);
                    } catch (e) {
                        console.error(`Error in event listener for ${event}:`, e);
                    }
                });
            }
        }

        // --- Theme Handling ---
        initTheme() {
            this.theme = 'dark';
            document.documentElement.classList.add('dark');
            localStorage.setItem(STATE_KEYS.THEME, 'dark');
            localStorage.setItem('theme', 'dark');
            return 'dark';
        }

        applyTheme() {
            document.documentElement.classList.add('dark');
        }

        toggleTheme() {
            this.theme = 'dark';
            document.documentElement.classList.add('dark');
            return 'dark';
        }

        isDarkMode() {
            return this.theme === 'dark';
        }

        // --- Storage Helpers ---
        loadFromStorage(key, defaultValue) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : defaultValue;
            } catch (e) {
                console.warn(`Failed reading storage for ${key}`, e);
                return defaultValue;
            }
        }

        saveToStorage(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error(`Failed writing storage for ${key}`, e);
            }
        }

        // --- Ranker State Mutators ---
        setRankerItems(items) {
            this.rankerItems = repairItemList(items);
            this.saveToStorage(STATE_KEYS.RANKER_ITEMS, this.rankerItems);
            this.emit('rankerChange', this.rankerItems);
        }

        addRankerItem(item) {
            if (this.rankerItems.some(i => i.id === item.id && !item.custom)) {
                return false;
            }
            const updated = [...this.rankerItems, repairItemImage(item)];
            this.setRankerItems(updated);
            return true;
        }

        // --- Tierlist State Mutators ---
        setTierlistTiers(tiers) {
            this.tierlistTiers = repairTiers(tiers);
            this.saveToStorage(STATE_KEYS.TIERLIST_TIERS, this.tierlistTiers);
            this.emit('tierlistChange', { tiers: this.tierlistTiers, pool: this.tierlistPool });
        }

        setTierlistPool(pool) {
            this.tierlistPool = repairItemList(pool);
            this.saveToStorage(STATE_KEYS.TIERLIST_POOL, this.tierlistPool);
            this.emit('tierlistChange', { tiers: this.tierlistTiers, pool: this.tierlistPool });
        }

        addTierlistPoolItem(item) {
            const existsInPool = this.tierlistPool.some(i => i.id === item.id && !item.custom);
            const existsInTiers = this.tierlistTiers.some(t => t.items.some(i => i.id === item.id && !item.custom));
            if (existsInPool || existsInTiers) {
                return false;
            }
            const updated = [...this.tierlistPool, repairItemImage(item)];
            this.setTierlistPool(updated);
            return true;
        }

        setTierConfig(config) {
            this.tierConfig = config;
            this.saveToStorage(STATE_KEYS.TIERLIST_CONFIG, config);
            this.emit('tierConfigChange', this.tierConfig);
        }

        moveTier(index, direction) {
            const targetIdx = index + direction;
            if (targetIdx < 0 || targetIdx >= this.tierlistTiers.length) return false;
            const tiers = [...this.tierlistTiers];
            const temp = tiers[index];
            tiers[index] = tiers[targetIdx];
            tiers[targetIdx] = temp;
            this.setTierlistTiers(tiers);
            return true;
        }

        clearTier(tierIndex) {
            if (!this.tierlistTiers[tierIndex]) return false;
            const tiers = [...this.tierlistTiers];
            const items = tiers[tierIndex].items || [];
            if (items.length === 0) return true;
            tiers[tierIndex] = { ...tiers[tierIndex], items: [] };
            const pool = [...this.tierlistPool, ...items];
            this.tierlistTiers = tiers;
            this.tierlistPool = pool;
            this.saveToStorage(STATE_KEYS.TIERLIST_TIERS, tiers);
            this.saveToStorage(STATE_KEYS.TIERLIST_POOL, pool);
            this.emit('tierlistChange', { tiers: this.tierlistTiers, pool: this.tierlistPool });
            return true;
        }

        deleteTier(tierIndex) {
            if (!this.tierlistTiers[tierIndex]) return false;
            const tiers = [...this.tierlistTiers];
            const removed = tiers.splice(tierIndex, 1)[0];
            const items = removed.items || [];
            const pool = items.length > 0 ? [...this.tierlistPool, ...items] : this.tierlistPool;
            this.tierlistTiers = tiers;
            this.tierlistPool = pool;
            this.saveToStorage(STATE_KEYS.TIERLIST_TIERS, tiers);
            this.saveToStorage(STATE_KEYS.TIERLIST_POOL, pool);
            this.emit('tierlistChange', { tiers: this.tierlistTiers, pool: this.tierlistPool });
            return true;
        }

        addTier(tierObj = null) {
            const defaultColors = ['#fe769b', '#ffffa6', '#9df79d', '#76f8f8', '#9998fe', '#ffbafd', '#989898', '#cbd5e1'];
            const nextIdx = this.tierlistTiers.length;
            const newTier = tierObj || {
                name: `Tier ${nextIdx + 1}`,
                color: defaultColors[nextIdx % defaultColors.length],
                items: []
            };
            const tiers = [...this.tierlistTiers, newTier];
            this.setTierlistTiers(tiers);
            return true;
        }

        returnAllTiersToPool() {
            const tiers = this.tierlistTiers.map(t => ({ ...t, items: [] }));
            const placedItems = this.tierlistTiers.flatMap(t => t.items || []);
            const pool = [...this.tierlistPool, ...placedItems];
            this.tierlistTiers = tiers;
            this.tierlistPool = pool;
            this.saveToStorage(STATE_KEYS.TIERLIST_TIERS, tiers);
            this.saveToStorage(STATE_KEYS.TIERLIST_POOL, pool);
            this.emit('tierlistChange', { tiers: this.tierlistTiers, pool: this.tierlistPool });
            return true;
        }

        resetTiersToDefault() {
            const placedItems = this.tierlistTiers.flatMap(t => t.items || []);
            const pool = [...this.tierlistPool, ...placedItems];
            const defaultTiers = DEFAULT_TIER_CONFIG.slice(0, 5).map(c => ({
                name: c.name,
                color: c.color,
                items: []
            }));
            this.tierlistTiers = defaultTiers;
            this.tierlistPool = pool;
            this.tierConfig = DEFAULT_TIER_CONFIG;
            this.saveToStorage(STATE_KEYS.TIERLIST_CONFIG, DEFAULT_TIER_CONFIG);
            this.saveToStorage(STATE_KEYS.TIERLIST_TIERS, defaultTiers);
            this.saveToStorage(STATE_KEYS.TIERLIST_POOL, pool);
            this.emit('tierlistChange', { tiers: this.tierlistTiers, pool: this.tierlistPool });
            this.emit('tierConfigChange', this.tierConfig);
            return true;
        }

        renameItem(id, newTitle, context = 'ranker') {
            const cleanTitle = (newTitle || '').trim();
            if (!cleanTitle) return false;

            if (context === 'ranker') {
                const items = this.rankerItems.map(item => {
                    if (item.id === id) {
                        return { ...item, title: cleanTitle };
                    }
                    return item;
                });
                this.setRankerItems(items);
                return true;
            } else if (context === 'tierlist') {
                let found = false;
                const pool = this.tierlistPool.map(item => {
                    if (item.id === id) {
                        found = true;
                        return { ...item, title: cleanTitle };
                    }
                    return item;
                });

                const tiers = this.tierlistTiers.map(tier => ({
                    ...tier,
                    items: (tier.items || []).map(item => {
                        if (item.id === id) {
                            found = true;
                            return { ...item, title: cleanTitle };
                        }
                        return item;
                    })
                }));

                if (found) {
                    this.tierlistPool = pool;
                    this.tierlistTiers = tiers;
                    this.saveToStorage(STATE_KEYS.TIERLIST_POOL, pool);
                    this.saveToStorage(STATE_KEYS.TIERLIST_TIERS, tiers);
                    this.emit('tierlistChange', { tiers: this.tierlistTiers, pool: this.tierlistPool });
                    return true;
                }
            }
            return false;
        }

        setUserAvatar(avatarUrl) {
            const clean = (avatarUrl || '').trim();
            this.userAvatar = clean;
            this.saveToStorage(STATE_KEYS.USER_AVATAR, clean);
            localStorage.setItem('anihub_user_avatar', clean);
            this.emit('userAvatarChange', this.userAvatar);
        }

        async fetchUserAvatar(username) {
            const clean = (username || '').trim();
            if (!clean) {
                this.setUserAvatar('');
                return null;
            }
            if (!window.AniHub?.api?.getUserProfile) {
                return null;
            }
            try {
                const profile = await window.AniHub.api.getUserProfile(clean);
                if (profile && profile.avatar) {
                    this.setUserAvatar(profile.avatar);
                    if (profile.name && profile.name.toLowerCase() === clean.toLowerCase() && profile.name !== this.username) {
                        this.username = profile.name;
                        this.saveToStorage(STATE_KEYS.USERNAME, profile.name);
                        localStorage.setItem('anihub_last_sync_username', profile.name);
                        this.emit('usernameChange', this.username);
                    }
                    return profile.avatar;
                }
            } catch (e) {
                console.warn('Failed fetching user avatar:', e);
            }
            return null;
        }

        setUsername(name) {
            const clean = (name || '').trim();
            this.username = clean;
            this.saveToStorage(STATE_KEYS.USERNAME, clean);
            localStorage.setItem('anihub_last_sync_username', clean);
            if (!clean) {
                this.setUserAvatar('');
            } else {
                this.fetchUserAvatar(clean);
            }
            this.emit('usernameChange', this.username);
        }
    }

    window.AniHub.state = new StateStore();
    window.AniHub.STATE_KEYS = STATE_KEYS;
    window.AniHub.DEFAULT_TIER_CONFIG = DEFAULT_TIER_CONFIG;
})();

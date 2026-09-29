/**
 * AniHub API Client
 * Centralized, cached GraphQL client for AniList API and data normalization.
 */

window.AniHub = window.AniHub || {};

(function() {
    const ANILIST_API_URL = 'https://graphql.anilist.co';
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
    const cache = new Map();

    const FALLBACK_IMAGE = 'https://placehold.co/400x600/1e293b/94a3b8?text=AniHub';

    /**
     * Cache key generator helper
     */
    function getCacheKey(query, variables) {
        return `${query.trim().slice(0, 40)}_${JSON.stringify(variables)}`;
    }

    /**
     * Debounce helper
     */
    function debounce(func, delay = 300) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Core GraphQL Fetcher with rate-limit retries and caching
     */
    async function request(query, variables = {}, bypassCache = false) {
        const cacheKey = getCacheKey(query, variables);

        if (!bypassCache && cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
                return cached.data;
            } else {
                cache.delete(cacheKey);
            }
        }

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const response = await fetch(ANILIST_API_URL, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query, variables })
                });

                // Handle AniList 429 rate limit
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
                    console.warn(`AniList rate limited. Waiting ${retryAfter}s before attempt ${attempts + 1}...`);
                    await new Promise(r => setTimeout(r, retryAfter * 1000));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`AniList HTTP ${response.status}: ${response.statusText}`);
                }

                const json = await response.json();
                if (json.errors && json.errors.length > 0) {
                    throw new Error(json.errors[0].message || 'GraphQL API error');
                }

                cache.set(cacheKey, { timestamp: Date.now(), data: json.data });
                return json.data;
            } catch (err) {
                if (attempts >= maxAttempts) {
                    throw err;
                }
                await new Promise(r => setTimeout(r, 600 * attempts));
            }
        }
    }

    // ==========================================
    // DATA NORMALIZERS
    // ==========================================

    function normalizeMedia(media, extra = {}) {
        if (!media) return null;
        const titleStr = media.title?.english || media.title?.romaji || media.title?.native || 'Untitled';
        return {
            id: media.id,
            title: titleStr,
            titleDetails: {
                english: media.title?.english || '',
                romaji: media.title?.romaji || '',
                native: media.title?.native || ''
            },
            image: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || FALLBACK_IMAGE,
            format: media.format || 'ANIME',
            year: media.startDate?.year || (media.seasonYear || null),
            score: extra.score !== undefined ? extra.score : (media.averageScore || null),
            popularity: media.popularity || 0,
            trending: media.trending || 0,
            userStatus: extra.userStatus || null,
            status: media.status || null,
            description: media.description || '',
            episodes: media.episodes || null,
            chapters: media.chapters || null,
            type: media.type || 'ANIME',
            custom: false
        };
    }

    function normalizeCharacter(char, extra = {}) {
        if (!char) return null;
        const fullName = char.name?.full || char.name?.native || 'Unknown Character';
        return {
            id: `char-${char.id}`,
            rawId: char.id,
            title: fullName,
            titleDetails: {
                english: fullName,
                romaji: char.name?.native || '',
                native: char.name?.native || ''
            },
            image: char.image?.large || char.image?.medium || FALLBACK_IMAGE,
            format: 'CHARACTER',
            year: null,
            score: null,
            popularity: char.favourites || 0,
            gender: char.gender || 'Unknown',
            role: extra.role || null,
            seriesTitle: extra.seriesTitle || (char.media?.nodes?.[0]?.title?.english || char.media?.nodes?.[0]?.title?.romaji || null),
            description: char.description || '',
            type: 'CHARACTER',
            custom: false
        };
    }

    // ==========================================
    // GRAPHQL QUERIES
    // ==========================================

    const QUERIES = {
        SEARCH_MEDIA: `
            query ($search: String, $type: MediaType, $format_in: [MediaFormat], $sort: [MediaSort], $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        hasNextPage
                        total
                    }
                    media(search: $search, type: $type, format_in: $format_in, sort: $sort, isAdult: false) {
                        id
                        type
                        title { romaji english native }
                        coverImage { extraLarge large medium }
                        startDate { year }
                        format
                        status
                        episodes
                        chapters
                        averageScore
                        popularity
                        trending
                        description(asHtml: false)
                    }
                }
            }
        `,

        SEARCH_CHARACTERS_BY_NAME: `
            query ($search: String, $page: Int, $perPage: Int, $sort: [CharacterSort]) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        hasNextPage
                        total
                    }
                    characters(search: $search, sort: $sort) {
                        id
                        name { full native }
                        image { large medium }
                        gender
                        favourites
                        media(sort: POPULARITY_DESC, perPage: 1) {
                            nodes {
                                id
                                title { romaji english }
                            }
                        }
                    }
                }
            }
        `,

        SEARCH_SERIES: `
            query ($search: String, $type: MediaType, $perPage: Int) {
                Page(perPage: $perPage) {
                    media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) {
                        id
                        type
                        title { romaji english native }
                        coverImage { extraLarge large }
                        startDate { year }
                        format
                        averageScore
                        popularity
                    }
                }
            }
        `,

        CHARACTERS_BY_SERIES_ID: `
            query ($id: Int, $page: Int, $perPage: Int) {
                Media(id: $id) {
                    id
                    title { romaji english native }
                    characters(page: $page, perPage: $perPage, sort: [ROLE, FAVOURITES_DESC]) {
                        pageInfo {
                            hasNextPage
                        }
                        edges {
                            role
                            node {
                                id
                                name { full native }
                                image { large medium }
                                gender
                                favourites
                            }
                        }
                    }
                }
            }
        `,

        USER_PROFILE: `
            query ($name: String) {
                User(name: $name) {
                    id
                    name
                    avatar {
                        large
                        medium
                    }
                }
            }
        `,

        USER_LIST: `
            query ($userName: String, $type: MediaType) {
                MediaListCollection(userName: $userName, type: $type) {
                    user {
                        id
                        name
                        avatar { medium }
                    }
                    lists {
                        name
                        isCustomList
                        status
                        entries {
                            id
                            status
                            score(format: POINT_100)
                            media {
                                id
                                type
                                title { romaji english native }
                                coverImage { extraLarge large }
                                startDate { year }
                                format
                                status
                                episodes
                                chapters
                                averageScore
                                popularity
                            }
                        }
                    }
                }
            }
        `,

        USER_MEDIA_IDS: `
            query ($userName: String, $type: MediaType) {
                MediaListCollection(userName: $userName, type: $type) {
                    lists {
                        entries {
                            media { id }
                        }
                    }
                }
            }
        `,

        SEASONAL_ANIME: `
            query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int, $sort: [MediaSort]) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo {
                        hasNextPage
                        currentPage
                        total
                    }
                    media(season: $season, seasonYear: $seasonYear, type: ANIME, isAdult: false, sort: $sort) {
                        id
                        type
                        title { romaji english native }
                        coverImage { extraLarge large }
                        startDate { year }
                        format
                        status
                        episodes
                        averageScore
                        popularity
                        trending
                        description(asHtml: false)
                    }
                }
            }
        `
    };

    // ==========================================
    // PUBLIC API METHODS
    // ==========================================

    const api = {
        FALLBACK_IMAGE,
        debounce,

        /**
         * Search Anime or Manga
         */
        async searchMedia({ query, type = 'ANIME', format = null, sort = 'SEARCH_MATCH', page = 1, perPage = 40 }) {
            const variables = {
                search: query && query.trim() ? query.trim() : undefined,
                type: type.toUpperCase(),
                page,
                perPage,
                sort: [sort]
            };

            if (format && format !== 'all') {
                variables.format_in = [format];
            }

            const data = await request(QUERIES.SEARCH_MEDIA, variables);
            const items = (data?.Page?.media || []).map(m => normalizeMedia(m));
            return {
                items,
                pageInfo: data?.Page?.pageInfo || { hasNextPage: false, total: items.length }
            };
        },

        /**
         * Search Characters by Character Name
         */
        async searchCharactersByName({ query, gender = 'all', sort = 'SEARCH_MATCH', page = 1, perPage = 40 }) {
            let sortEnum = 'SEARCH_MATCH';
            if (sort === 'FAVOURITES') sortEnum = 'FAVOURITES_DESC';
            if (sort === 'ID') sortEnum = 'ID_DESC';

            const variables = {
                search: query.trim(),
                page,
                perPage,
                sort: [sortEnum]
            };

            const data = await request(QUERIES.SEARCH_CHARACTERS_BY_NAME, variables);
            let characters = (data?.Page?.characters || []).map(c => normalizeCharacter(c));

            if (gender && gender !== 'all') {
                characters = characters.filter(c => (c.gender || '').toLowerCase() === gender.toLowerCase());
            }

            return {
                items: characters,
                pageInfo: data?.Page?.pageInfo || { hasNextPage: false, total: characters.length }
            };
        },

        /**
         * Search Series titles for character selection
         */
        async searchSeriesForCharacters({ query, type = 'ANIME', perPage = 20 }) {
            const variables = {
                search: query.trim(),
                type: type.toUpperCase(),
                perPage
            };

            const data = await request(QUERIES.SEARCH_SERIES, variables);
            return (data?.Page?.media || []).map(m => normalizeMedia(m));
        },

        /**
         * Fetch characters by Media / Series ID
         */
        async getCharactersBySeriesId({ seriesId, seriesTitle, gender = 'all', page = 1, perPage = 50 }) {
            const variables = {
                id: parseInt(seriesId, 10),
                page,
                perPage
            };

            const data = await request(QUERIES.CHARACTERS_BY_SERIES_ID, variables);
            const media = data?.Media;
            const edges = media?.characters?.edges || [];

            let characters = edges.map(edge => normalizeCharacter(edge.node, {
                role: edge.role,
                seriesTitle: seriesTitle || media?.title?.english || media?.title?.romaji
            }));

            if (gender && gender !== 'all') {
                characters = characters.filter(c => (c.gender || '').toLowerCase() === gender.toLowerCase());
            }

            return {
                seriesTitle: seriesTitle || media?.title?.english || media?.title?.romaji,
                items: characters,
                pageInfo: media?.characters?.pageInfo || { hasNextPage: false }
            };
        },

        /**
         * Fetch User AniList Profile Collection
         */
        async getUserList({ username, type = 'ANIME' }) {
            const variables = {
                userName: username.trim(),
                type: type.toUpperCase()
            };

            const data = await request(QUERIES.USER_LIST, variables, true); // Fresh sync
            const collection = data?.MediaListCollection;
            if (!collection) {
                throw new Error(`No public ${type.toLowerCase()} list found for "${username}".`);
            }

            const lists = collection.lists || [];
            const allEntries = [];

            lists.forEach(list => {
                const listStatus = list.status;
                (list.entries || []).forEach(entry => {
                    const norm = normalizeMedia(entry.media, {
                        score: entry.score,
                        userStatus: entry.status || listStatus
                    });
                    if (norm) {
                        allEntries.push(norm);
                    }
                });
            });

            return {
                user: collection.user,
                entries: allEntries
            };
        },

        /**
         * Fetch complete set of Media IDs for a user (used for Seasonal intersection filtering)
         */
        async getUserMediaIdSet({ username, type = 'ANIME' }) {
            const variables = {
                userName: username.trim(),
                type: type.toUpperCase()
            };

            const data = await request(QUERIES.USER_MEDIA_IDS, variables);
            const lists = data?.MediaListCollection?.lists || [];
            const idSet = new Set();

            lists.forEach(list => {
                (list.entries || []).forEach(entry => {
                    if (entry.media?.id) idSet.add(entry.media.id);
                });
            });

            return idSet;
        },

        /**
         * Fetch Seasonal Anime with optional pagination & user filter
         */
        async getSeasonalAnime({ season, year, sort = 'POPULARITY_DESC', maxPages = 4, onProgress = null }) {
            let allItems = [];
            let page = 1;
            let hasNext = true;

            while (hasNext && page <= maxPages) {
                if (onProgress) {
                    onProgress({ page, maxPages, fetchedSoFar: allItems.length });
                }

                const variables = {
                    season: season ? season.toUpperCase() : undefined,
                    seasonYear: parseInt(year, 10),
                    page,
                    perPage: 50,
                    sort: [sort]
                };

                const data = await request(QUERIES.SEASONAL_ANIME, variables);
                const pageData = data?.Page;
                const items = (pageData?.media || []).map(m => normalizeMedia(m));

                allItems = allItems.concat(items);
                hasNext = pageData?.pageInfo?.hasNextPage;
                page++;

                if (hasNext && page <= maxPages) {
                    // Small delay to prevent bursting
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            return allItems;
        },

        /**
         * Guess current Season & Year
         */
        getCurrentSeasonAndYear() {
            const now = new Date();
            const month = now.getMonth() + 1; // 1-12
            const year = now.getFullYear();

            let season = 'WINTER';
            if (month >= 3 && month <= 5) season = 'SPRING';
            else if (month >= 6 && month <= 8) season = 'SUMMER';
            else if (month >= 9 && month <= 11) season = 'FALL';
            else if (month === 12) season = 'WINTER';

            return { season, year };
        },

        /**
         * Fetch AniList User Profile (ID, exact casing, avatar)
         */
        async getUserProfile(username) {
            if (!username || !username.trim()) return null;
            try {
                const data = await request(QUERIES.USER_PROFILE, { name: username.trim() });
                if (data?.User) {
                    return {
                        id: data.User.id,
                        name: data.User.name,
                        avatar: data.User.avatar?.large || data.User.avatar?.medium || null
                    };
                }
            } catch (err) {
                console.warn(`Failed fetching user profile for "${username}":`, err);
            }
            return null;
        },

        /**
         * Clear cached responses
         */
        clearCache() {
            cache.clear();
        }
    };

    window.AniHub.api = api;
})();

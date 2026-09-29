/**
 * AniHub SPA Router
 * Hash-based client-side router
 */

window.AniHub = window.AniHub || {};

(function() {
    class Router {
        constructor() {
            this.mainContainer = null;
            this.navbarContainer = null;
        }

        init(mainContainer, navbarContainer) {
            this.mainContainer = mainContainer;
            this.navbarContainer = navbarContainer;

            window.addEventListener('hashchange', () => this.handleRoute());
            this.handleRoute();
        }

        getCleanHash() {
            const hash = window.location.hash || '#/';
            const [cleanRoute] = hash.split('?');
            return cleanRoute || '#/';
        }

        handleRoute() {
            const cleanRoute = this.getCleanHash();
            const state = window.AniHub.state;
            const views = window.AniHub.views || {};
            const navbar = window.AniHub.navbar;

            if (state) {
                state.activeRoute = cleanRoute;
            }

            let viewModule = views.landing;
            if (cleanRoute === '#/ranker') {
                viewModule = views.ranker;
            } else if (cleanRoute === '#/tierlist') {
                viewModule = views.tierlist;
            }

            if (this.mainContainer && viewModule && viewModule.render) {
                this.mainContainer.innerHTML = '';
                viewModule.render(this.mainContainer);
                window.scrollTo({ top: 0, behavior: 'instant' });
            }

            if (this.navbarContainer && navbar && navbar.highlight) {
                navbar.highlight(this.navbarContainer, cleanRoute);
            }

            if (window.AniHub.exportModal && window.AniHub.exportModal.checkIncomingShareLink) {
                window.AniHub.exportModal.checkIncomingShareLink();
            }

            if (state) {
                state.emit('routeChange', cleanRoute);
            }
        }

        navigate(hash) {
            window.location.hash = hash;
        }
    }

    window.AniHub.router = new Router();
})();

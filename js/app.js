/**
 * AniHub Application Entrypoint
 */

document.addEventListener('DOMContentLoaded', () => {
    const AniHub = window.AniHub || {};
    const navbarContainer = document.getElementById('app-navbar');
    const mainContainer = document.getElementById('app-main');

    // 1. Initialize Universal Navbar
    if (AniHub.navbar && AniHub.navbar.render) {
        AniHub.navbar.render(navbarContainer);
    }

    // 2. Initialize SPA Router
    if (AniHub.router && AniHub.router.init) {
        AniHub.router.init(mainContainer, navbarContainer);
    }

    // 3. Initialize Toast Utility
    if (AniHub.toast && AniHub.toast.init) {
        AniHub.toast.init();
    }

    console.log('AniHub platform v2.0 initialized successfully.');
});

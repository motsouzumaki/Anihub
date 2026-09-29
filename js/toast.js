/**
 * AniHub Toast & Modal Notification Utility
 */

window.AniHub = window.AniHub || {};

(function() {
    class ToastService {
        constructor() {
            this.container = null;
        }

        init() {
            if (!this.container) {
                this.container = document.getElementById('toast-container');
                if (!this.container) {
                    this.container = document.createElement('div');
                    this.container.id = 'toast-container';
                    this.container.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none items-center w-full max-w-md px-4';
                    document.body.appendChild(this.container);
                }
            }
        }

        show(message, type = 'info', duration = 3000) {
            this.init();

            const toast = document.createElement('div');
            toast.className = `pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-md shadow-elevated text-xs font-medium transition-all duration-150 transform translate-y-3 opacity-0 border ${this.getTypeStyles(type)}`;

            const icon = this.getTypeIcon(type);
            toast.innerHTML = `
                <i class="${icon} shrink-0"></i>
                <span class="flex-1">${message}</span>
                <button class="toast-close text-text-muted hover:text-text-primary transition-colors ml-2">
                    <i class="fas fa-times text-xs"></i>
                </button>
            `;

            toast.querySelector('.toast-close').addEventListener('click', () => {
                this.dismiss(toast);
            });

            this.container.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.remove('translate-y-3', 'opacity-0');
                toast.classList.add('translate-y-0', 'opacity-100');
            });

            if (duration > 0) {
                setTimeout(() => {
                    this.dismiss(toast);
                }, duration);
            }
        }

        success(message, duration = 3000) {
            this.show(message, 'success', duration);
        }

        error(message, duration = 3500) {
            this.show(message, 'error', duration);
        }

        warning(message, duration = 3000) {
            this.show(message, 'warning', duration);
        }

        info(message, duration = 3000) {
            this.show(message, 'info', duration);
        }

        dismiss(toast) {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 150);
        }

        getTypeStyles(type) {
            switch (type) {
                case 'success':
                    return 'bg-surface text-text-primary border-emerald-500/40';
                case 'error':
                    return 'bg-surface text-text-primary border-rose-500/40';
                case 'warning':
                    return 'bg-surface text-text-primary border-amber-500/40';
                default:
                    return 'bg-surface text-text-primary border-border';
            }
        }

        getTypeIcon(type) {
            switch (type) {
                case 'success': return 'fas fa-check-circle text-xs text-emerald-400';
                case 'error': return 'fas fa-exclamation-circle text-xs text-rose-400';
                case 'warning': return 'fas fa-exclamation-triangle text-xs text-amber-400';
                default: return 'fas fa-info-circle text-xs text-accent';
            }
        }
    }

    window.AniHub.toast = new ToastService();
})();

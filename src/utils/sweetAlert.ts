/**
 * Custom SweetAlert implementation with Modern UI, smooth animations,
 * beautiful icons and zero external CDN dependency issues.
 */

export interface SweetAlertOptions {
  title: string;
  text?: string;
  html?: string;
  icon?: 'success' | 'warning' | 'error' | 'info' | 'question';
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  timer?: number;
}

export interface SweetAlertResult {
  isConfirmed: boolean;
  isDismissed: boolean;
}

export const Swal = {
  fire(optionsOrTitle: SweetAlertOptions | string, text?: string, icon?: SweetAlertOptions['icon']): Promise<SweetAlertResult> {
    return new Promise((resolve) => {
      let options: SweetAlertOptions;
      if (typeof optionsOrTitle === 'string') {
        options = {
          title: optionsOrTitle,
          text: text || '',
          icon: icon || 'info'
        };
      } else {
        options = optionsOrTitle;
      }

      // Remove any existing sweet alert
      const existing = document.getElementById('sweet-alert-container');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = 'sweet-alert-container';
      container.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 opacity-0';

      const iconColors = {
        success: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-300', svg: '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>' },
        warning: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-300', svg: '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>' },
        error: { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-300', svg: '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>' },
        question: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', svg: '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' },
        info: { bg: 'bg-sky-100', text: 'text-sky-600', border: 'border-sky-300', svg: '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' }
      };

      const selectedIcon = options.icon ? iconColors[options.icon] : null;

      const card = document.createElement('div');
      card.className = 'w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-7 text-center transform scale-90 transition-all duration-300 border border-slate-100';

      let iconHtml = '';
      if (selectedIcon) {
        iconHtml = `
          <div class="mx-auto mb-4 w-18 h-18 rounded-full ${selectedIcon.bg} ${selectedIcon.text} ${selectedIcon.border} border-2 flex items-center justify-center animate-bounce-once">
            ${selectedIcon.svg}
          </div>
        `;
      }

      const bodyHtml = options.html ? `<div class="text-sm text-slate-600 mb-6 leading-relaxed">${options.html}</div>` :
        (options.text ? `<p class="text-sm text-slate-600 mb-6 leading-relaxed">${options.text}</p>` : '');

      const confirmBtnText = options.confirmButtonText || 'ตกลง';
      const cancelBtnText = options.cancelButtonText || 'ยกเลิก';
      const confirmColor = options.confirmButtonColor || '#0C7C82';

      let buttonsHtml = '';
      if (options.showCancelButton) {
        buttonsHtml = `
          <div class="flex items-center justify-center gap-3 pt-2">
            <button id="swal-cancel" class="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-colors cursor-pointer w-full">
              ${cancelBtnText}
            </button>
            <button id="swal-confirm" style="background-color: ${confirmColor};" class="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 shadow-md transition-all cursor-pointer w-full">
              ${confirmBtnText}
            </button>
          </div>
        `;
      } else {
        buttonsHtml = `
          <div class="pt-2">
            <button id="swal-confirm" style="background-color: ${confirmColor};" class="w-full px-6 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 shadow-md transition-all cursor-pointer">
              ${confirmBtnText}
            </button>
          </div>
        `;
      }

      card.innerHTML = `
        ${iconHtml}
        <h3 class="text-lg sm:text-xl font-bold text-slate-800 mb-2">${options.title}</h3>
        ${bodyHtml}
        ${buttonsHtml}
      `;

      container.appendChild(card);
      document.body.appendChild(container);

      // Trigger entrance animation
      requestAnimationFrame(() => {
        container.classList.remove('opacity-0');
        container.classList.add('opacity-100');
        card.classList.remove('scale-90');
        card.classList.add('scale-100');
      });

      const cleanup = (confirmed: boolean) => {
        container.classList.remove('opacity-100');
        container.classList.add('opacity-0');
        card.classList.remove('scale-100');
        card.classList.add('scale-90');
        setTimeout(() => {
          if (container.parentNode) container.parentNode.removeChild(container);
          resolve({ isConfirmed: confirmed, isDismissed: !confirmed });
        }, 200);
      };

      const confirmBtn = card.querySelector('#swal-confirm');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => cleanup(true));
      }

      const cancelBtn = card.querySelector('#swal-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => cleanup(false));
      }

      if (options.timer) {
        setTimeout(() => cleanup(true), options.timer);
      }
    });
  }
};

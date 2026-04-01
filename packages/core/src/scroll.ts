export const SCROLL_SPEED_PX_PER_FRAME = 8;

export function smoothScrollTo(
  el: HTMLElement,
  scrollSpeed: number,
  stickyHeaderSelector?: string,
): Promise<void> {
  return new Promise((resolve) => {
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const stickyNav = stickyHeaderSelector ? document.querySelector(stickyHeaderSelector) : null;
    const navHeight = stickyNav ? stickyNav.getBoundingClientRect().height : 0;
    const scrollMarginTop = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const offset = Math.max(navHeight, scrollMarginTop);
    const targetScrollY = window.scrollY + rect.top - offset;
    const clampedTarget = Math.max(0, Math.min(targetScrollY, document.documentElement.scrollHeight - viewportH));

    if (Math.abs(clampedTarget - window.scrollY) < 2) {
      resolve();
      return;
    }

    const html = document.documentElement;
    const savedBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';

    let rafId = 0;
    const step = () => {
      const diff = clampedTarget - window.scrollY;
      if (Math.abs(diff) < 2) {
        window.scrollTo({ top: clampedTarget });
        html.style.scrollBehavior = savedBehavior;
        resolve();
        return;
      }
      const delta = Math.sign(diff) * Math.min(Math.abs(diff), scrollSpeed);
      window.scrollBy(0, delta);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      html.style.scrollBehavior = savedBehavior;
      resolve();
    };
    window.addEventListener('wheel', cleanup, { once: true });
    window.addEventListener('touchstart', cleanup, { once: true });
  });
}

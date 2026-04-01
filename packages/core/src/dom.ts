export function resolveElement(target: HTMLElement | string): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

export function getElementCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function getSectionLeftStandPoint(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left / 2,
    y: rect.top,
  };
}

export function resolvePointAtCoords(
  target: HTMLElement | string | { x: number; y: number },
): { x: number; y: number } | null {
  if (typeof target === 'string' || target instanceof HTMLElement) {
    const el = resolveElement(target);
    if (!el) return null;
    return getElementCenter(el);
  }
  return target;
}

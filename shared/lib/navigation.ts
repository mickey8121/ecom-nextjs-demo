// Auth transitions reload the page so nothing from the previous session survives in client memory.
export function navigateFullPage(path: `/${string}`) {
  if (typeof window === 'undefined') return;
  window.location.assign(path);
}

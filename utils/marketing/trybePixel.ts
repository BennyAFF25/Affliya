const APP_PREFIXES = [
  '/affiliate', '/business', '/admin', '/internal', '/onboarding',
  '/auth', '/auth-redirect', '/logout', '/settings', '/wallet',
  '/meta-auth-callback', '/stripe-redirect', '/api', '/go',
];

export function shouldLoadTrybePixel(pathname: string | null): boolean {
  if (!pathname || !pathname.startsWith('/')) return false;
  const path = pathname.toLowerCase();
  return !path.startsWith('/login') &&
    !path.split('/').some(segment => segment.includes('dashboard')) &&
    !APP_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'));
}

// A document guard survives client navigation and React Strict Mode remounts.
// Do not persist this in storage: a full reload needs a fresh SDK instance.
export function loadTrybePixel(pathname: string | null, doc: Document, win: Window): void {
  if (!shouldLoadTrybePixel(pathname) || doc.getElementById('trybe-attribution-pixel')) return;
  const config = {
    pixelCode: 'px_4f4f743c629f',
    storeId: '1f76e30b-a49e-419f-bb2f-116385e337ac',
    platform: 'CUSTOM',
    autoTracking: 'false',
    customDomain: 'track.nettmark.com',
    serviceUrl: 'https://prod-trybe-platform-6mi3j.ondigitalocean.app/attribution',
  };
  const target = win as Window & { _trybe?: typeof config };
  target._trybe = target._trybe || config;
  const script = doc.createElement('script');
  script.id = 'trybe-attribution-pixel';
  script.src = 'https://track.nettmark.com/pixel.js';
  script.async = true;
  script.setAttribute('data-pixel-code', config.pixelCode);
  script.setAttribute('data-store-id', config.storeId);
  script.setAttribute('data-platform', config.platform);
  script.setAttribute('data-auto-tracking', config.autoTracking);
  doc.head.appendChild(script);
}

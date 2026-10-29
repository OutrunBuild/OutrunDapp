// jsdom ships no Web Animations API: Headless UI otherwise installs its own
// Element.prototype.getAnimations polyfill at import time and warns on every test
// that renders a transition-capable component. Pre-installing a stub keeps the API
// present so the library takes its normal path without warning. Node-environment
// files have no Element — the guard keeps this setup a no-op there.
if (typeof Element !== 'undefined' && typeof Element.prototype.getAnimations !== 'function') {
  Object.defineProperty(Element.prototype, 'getAnimations', {
    value: () => [],
    configurable: true,
    writable: true,
  });
}

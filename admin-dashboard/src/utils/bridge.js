/**
 * Shared WebView ↔ React Native bridge utility.
 *
 * MUST be a single module so window.__driverBridgeCallback is registered
 * exactly once — having multiple pages each register it causes whichever
 * runs last to overwrite the others, dropping all in-flight requests.
 */

const _pending = {};
let _counter = 0;

// Register the global callback once. Vite module caching guarantees this
// file runs only once even if imported by multiple components.
window.__driverBridgeCallback = function (response) {
  const { id, data } =
    typeof response === 'string' ? JSON.parse(response) : response;
  if (_pending[id]) {
    _pending[id](data);
    delete _pending[id];
  }
};

/** Wait up to `timeout` ms for the RN WebView bridge to become available */
export function waitForBridge(timeout = 3000) {
  return new Promise((resolve, reject) => {
    if (window.ReactNativeWebView) { resolve(); return; }
    const start = Date.now();
    const iv = setInterval(() => {
      if (window.ReactNativeWebView) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(iv);
        reject(new Error('ReactNativeWebView bridge not available'));
      }
    }, 50);
  });
}

/** Send a typed request to the RN bridge and await the response */
export async function bridgeRequest(type, params = {}) {
  await waitForBridge();
  return new Promise((resolve) => {
    const id = `req_${++_counter}`;
    _pending[id] = resolve;
    window.ReactNativeWebView.postMessage(JSON.stringify({ id, type, params }));
    setTimeout(() => {
      if (_pending[id]) { _pending[id](null); delete _pending[id]; }
    }, 10000);
  });
}

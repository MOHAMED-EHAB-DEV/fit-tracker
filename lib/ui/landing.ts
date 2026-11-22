/**
 * The landing page (/) is for visitors on the web. Inside the installed PWA or
 * the Android app a signed-out person must see sign-in instead.
 *
 * Signed-in people never reach the landing page (the proxy sends them to
 * /dashboard). For the rest, LANDING_APP_REDIRECT_SCRIPT runs in <head> on a
 * full page load (before anything is painted), and isInstalledAppContext()
 * covers client-side navigations to /.
 */

export const SIGN_IN_PATH = "/login";

/** Standalone display (installed PWA, iOS home screen) or the Android app's WebView. */
export function isInstalledAppContext(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const native = Boolean(
      (window as Window & { AndroidBridge?: { isNativeApp?: () => boolean } }).AndroidBridge?.isNativeApp?.()
    );
    return standalone || native;
  } catch {
    return false;
  }
}

/** Inline, dependency-free version of the check above, for <head>. */
export const LANDING_APP_REDIRECT_SCRIPT = `(function(){try{if(location.pathname!=="/")return;var b=window.AndroidBridge;if(window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true||(b&&b.isNativeApp&&b.isNativeApp())){location.replace(${JSON.stringify(
  SIGN_IN_PATH
)})}}catch(e){}})();`;

// Cookie consent management (RGPD)
// Scripts are loaded conditionally based on consent.
// African timezones get implicit consent (RGPD is EU-only).

const CONSENT_KEY = "stef_cookie_consent";

export type ConsentStatus = "accepted" | "rejected" | null;

export function getConsentStatus(): ConsentStatus {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === "accepted" || val === "rejected") return val;
  return null;
}

/** Returns true if tracking scripts should load */
export function hasConsent(): boolean {
  if (typeof window === "undefined") return false;

  const status = getConsentStatus();
  if (status === "accepted") return true;
  if (status === "rejected") return false;

  // Auto-consent for African timezones (not subject to RGPD)
  if (isAfricanTimezone()) {
    localStorage.setItem(CONSENT_KEY, "accepted");
    return true;
  }

  return false;
}

export function setConsent(accepted: boolean) {
  localStorage.setItem(CONSENT_KEY, accepted ? "accepted" : "rejected");
  if (accepted) {
    loadTrackingScripts();
  }
}

export function needsBanner(): boolean {
  return getConsentStatus() === null && !isAfricanTimezone();
}

function isAfricanTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz.startsWith("Africa/");
  } catch {
    return false;
  }
}

export function loadTrackingScripts() {
  if (typeof window === "undefined") return;
  // Avoid double-loading
  if ((window as any).__stef_tracking_loaded) return;
  (window as any).__stef_tracking_loaded = true;

  // Facebook Pixel (ID already in index.html — 964077102406179)
  // It's already loaded via index.html, but if we deferred it, inject dynamically:
  if (!(window as any).fbq) {
    const fbScript = document.createElement("script");
    fbScript.async = true;
    fbScript.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(fbScript);
    fbScript.onload = () => {
      (window as any).fbq("init", "923013287327117");
      (window as any).fbq("init", "1224271356122911");
      (window as any).fbq("track", "PageView");
    };
  }

  // Google Tag (already in index.html — AW-18017755980)
  if (!(window as any).gtag) {
    const gScript = document.createElement("script");
    gScript.async = true;
    gScript.src = "https://www.googletagmanager.com/gtag/js?id=AW-18017755980";
    document.head.appendChild(gScript);
    gScript.onload = () => {
      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
      (window as any).gtag = gtag;
      gtag("js", new Date());
      gtag("config", "AW-18017755980");
      // GA4 placeholder — replace G-GA4_MEASUREMENT_ID_ICI with real ID
      // gtag("config", "G-GA4_MEASUREMENT_ID_ICI");
    };
  }
}

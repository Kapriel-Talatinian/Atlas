// Web Vitals measurement — reports FCP and load time to backend

import { supabase } from "@/integrations/supabase/client";

export function reportWebVitals() {
  if (typeof window === "undefined") return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          const value = Math.round(entry.startTime);
          console.log(`FCP: ${value}ms`);
          logVital("FCP", value);
        }
      }
    });
    observer.observe({ type: "paint", buffered: true });
  } catch {
    // PerformanceObserver not supported
  }

  window.addEventListener("load", () => {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      if (nav) {
        const loadTime = Math.round(nav.loadEventEnd - nav.startTime);
        if (loadTime > 0) {
          console.log(`Load: ${loadTime}ms`);
          logVital("load_time", loadTime);
        }
      }
    } catch {
      // Silently fail
    }
  });
}

async function logVital(metric: string, value: number) {
  try {
    await supabase.from("funnel_events").insert({
      session_id: sessionStorage.getItem("stef_session") || null,
      event_type: "web_vital",
      event_data: { metric, value },
      page_url: window.location.href,
      device_type: /mobile/i.test(navigator.userAgent) ? "mobile" : "desktop",
    });
  } catch {
    // Silently fail
  }
}

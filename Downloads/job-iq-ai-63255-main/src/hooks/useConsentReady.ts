import { useState, useEffect } from "react";
import { getConsentStatus } from "@/lib/consent";

/** Returns true once the cookie banner has been dismissed (accepted or rejected) or wasn't needed. */
export function useConsentReady(): boolean {
  const [ready, setReady] = useState(() => getConsentStatus() !== null);

  useEffect(() => {
    if (ready) return;
    // Poll briefly — banner sets localStorage synchronously
    const id = setInterval(() => {
      if (getConsentStatus() !== null) {
        setReady(true);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [ready]);

  return ready;
}

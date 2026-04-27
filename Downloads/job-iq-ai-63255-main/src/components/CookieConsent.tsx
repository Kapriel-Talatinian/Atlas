import { useState, useEffect } from "react";
import { needsBanner, setConsent, hasConsent, loadTrackingScripts } from "@/lib/consent";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (needsBanner()) {
      setShow(true);
    } else if (hasConsent()) {
      loadTrackingScripts();
    }
  }, []);

  if (!show) return null;

  const handle = (accepted: boolean) => {
    setConsent(accepted);
    setShow(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#12152B",
        borderTop: "1px solid #1E2140",
        padding: "14px 20px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <p style={{ fontSize: 13, color: "#9B97B0", margin: 0, maxWidth: 520, textAlign: "center" }}>
        Ce site utilise des cookies pour mesurer l'audience et améliorer l'expérience.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => handle(true)}
          style={{
            background: "#7B6FF0",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Accepter
        </button>
        <button
          onClick={() => handle(false)}
          style={{
            background: "transparent",
            color: "#9B97B0",
            border: "1px solid #1E2140",
            borderRadius: 8,
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Refuser
        </button>
      </div>
    </div>
  );
}

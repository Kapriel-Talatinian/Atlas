import { useState, useCallback, useRef, useEffect } from "react";
import type { 
  IntegrityFlag, 
  AssessmentSession, 
  TechStack 
} from "@/types/assessment";
import { INTEGRITY_RULES } from "@/types/assessment";

export function useIntegrityMonitor(sessionId: string | null) {
  const [flags, setFlags] = useState<IntegrityFlag[]>([]);
  const [warningCount, setWarningCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const keystrokeTimesRef = useRef<number[]>([]);
  const idleCheckRef = useRef<ReturnType<typeof setInterval>>();

  const addFlag = useCallback((flag: Omit<IntegrityFlag, "timestamp">) => {
    const fullFlag: IntegrityFlag = {
      ...flag,
      timestamp: new Date().toISOString(),
    };

    setFlags(prev => [...prev, fullFlag]);

    if (flag.severity === "warning") {
      setWarningCount(prev => {
        const next = prev + 1;
        if (next >= INTEGRITY_RULES.warning_threshold) {
          // Session flagged
          console.warn("[Integrity] Session flagged: too many warnings");
        }
        return next;
      });
    }

    if (flag.severity === "critical") {
      setCriticalCount(prev => prev + 1);
      if (INTEGRITY_RULES.critical_auto_terminate) {
        setIsTerminated(true);
      }
    }
  }, []);

  // Tab switch detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        addFlag({
          type: "tab_switch",
          severity: "warning",
          details: "Le candidat a quitté l'onglet",
        });
      }
    };

    const handleBlur = () => {
      addFlag({
        type: "tab_switch",
        severity: "info",
        details: "Fenêtre a perdu le focus",
      });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [addFlag]);

  // Copy/Paste detection
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      if (text.length > INTEGRITY_RULES.copy_paste_char_limit) {
        addFlag({
          type: "copy_paste_large",
          severity: "warning",
          details: `Copier-coller de ${text.length} caractères détecté`,
        });
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addFlag]);

  // Screen resize detection
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        addFlag({
          type: "screen_resize",
          severity: "info",
          details: `Redimensionnement: ${window.innerWidth}x${window.innerHeight}`,
        });
      }, 500);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [addFlag]);

  // Idle then burst detection
  useEffect(() => {
    idleCheckRef.current = setInterval(() => {
      const idleTime = (Date.now() - lastActivityRef.current) / 1000;
      if (idleTime > INTEGRITY_RULES.idle_threshold_seconds) {
        // Will flag on next activity
      }
    }, 10000);

    return () => {
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    };
  }, []);

  // Keystroke analysis for typing anomaly
  const recordKeystroke = useCallback(() => {
    const now = Date.now();
    const idleTime = (now - lastActivityRef.current) / 1000;

    // Detect idle_then_burst
    if (idleTime > INTEGRITY_RULES.idle_threshold_seconds) {
      addFlag({
        type: "idle_then_burst",
        severity: "warning",
        details: `${Math.round(idleTime)}s d'inactivité puis activité soudaine`,
      });
    }

    lastActivityRef.current = now;
    keystrokeTimesRef.current.push(now);

    // Keep last 60 keystrokes for analysis
    if (keystrokeTimesRef.current.length > 60) {
      keystrokeTimesRef.current = keystrokeTimesRef.current.slice(-60);
    }

    // Analyze typing speed (every 30 keystrokes)
    const times = keystrokeTimesRef.current;
    if (times.length >= 30) {
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const cpm = 60000 / avgInterval; // chars per minute

      if (cpm > INTEGRITY_RULES.typing_speed_max_cpm) {
        addFlag({
          type: "typing_anomaly",
          severity: "warning",
          details: `Vitesse de frappe anormale: ${Math.round(cpm)} CPM`,
        });
        keystrokeTimesRef.current = []; // Reset to avoid spam
      }

      // Check for too-regular typing (bot-like)
      const stdDev = Math.sqrt(
        intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
      );
      if (stdDev < 15 && intervals.length >= 20) {
        addFlag({
          type: "typing_anomaly",
          severity: "critical",
          details: `Pattern de frappe trop régulier (σ=${stdDev.toFixed(1)}ms) - possible bot`,
        });
        keystrokeTimesRef.current = [];
      }
    }
  }, [addFlag]);

  return {
    flags,
    warningCount,
    criticalCount,
    isTerminated,
    addFlag,
    recordKeystroke,
    isFlagged: warningCount >= INTEGRITY_RULES.warning_threshold,
  };
}

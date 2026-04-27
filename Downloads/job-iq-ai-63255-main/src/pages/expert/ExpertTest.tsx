import { useState, useEffect, useCallback, useRef } from "react";
import { isMobileDevice } from "@/lib/device";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Clock, AlertTriangle, CheckCircle, Brain, Code, 
  Lightbulb, ChevronLeft, ChevronRight, Send, Loader2,
  Eye, EyeOff, Shield, Wifi, MapPin, Globe, Zap, Camera, Award,
  FileQuestion, RefreshCw, ListChecks
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import { RLHFFeedbackFormWithGold } from "@/components/expert/RLHFFeedbackFormWithGold";
import { WebcamProctoring } from "@/components/expert/WebcamProctoring";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Question {
  id: number;
  type: "theory" | "code" | "problem_solving";
  question: string;
  context?: string;
  expected_skills: string[];
  max_points: number;
  evaluation_criteria: string[];
  time_estimate_minutes: number;
}

interface TestData {
  questions: Question[];
  total_points: number;
  estimated_duration_minutes: number;
}

interface CheatIndicators {
  tab_switches: number;
  copy_attempts: number;
  paste_attempts: number;
  time_away: number;
  right_click_attempts: number;
  blocked_shortcuts: number;
  fullscreen_exits: number;
  drag_drop_attempts: number;
  devtools_open_count: number;
  mouse_exits: number;
  window_resizes: number;
  risk_score: number;
  keystroke_analysis: KeystrokeAnalysis;
}

interface KeystrokeAnalysis {
  total_keystrokes: number;
  avg_typing_speed: number;
  max_typing_speed: number;
  long_pauses: number;
  very_fast_bursts: number;
  typing_rhythm_variance: number;
  backspace_ratio: number;
  paste_like_bursts: number;
}

interface ConnectionInfo {
  latency: number;
  downloadSpeed: number;
  ipLocation: string;
  country: string;
  isVpn: boolean;
  connectionType: string;
}

const MAX_AWAY_TIME = 5 * 60; // 5 minutes in seconds
const LOCAL_STORAGE_KEY = 'stef-active-test';
const SAVE_THROTTLE_MS = 10_000; // Save to localStorage every 10 seconds

interface SavedTestSession {
  testId: string;
  jobId: string | null;
  expertId: string;
  startedAt: number; // timestamp ms
  totalDurationSeconds: number;
  timeRemaining: number;
  answers: { answer: string }[];
  cheatIndicators: CheatIndicators;
  testData: TestData;
  proctoringEnabled: boolean;
}

// Inject invisible zero-width characters to break OCR text extraction
const ocrScramble = (text: string): string => {
  const zwChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  return text.split('').map((char, i) => 
    i > 0 && i % 3 === 0 ? zwChars[i % zwChars.length] + char : char
  ).join('');
};

const ExpertTest = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const jobId = searchParams.get("jobId");
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [expertProfile, setExpertProfile] = useState<any>(null);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ answer: string }[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(45 * 60); // 45 minutes default
  const [testStarted, setTestStarted] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [testExpired, setTestExpired] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    latency: 0,
    downloadSpeed: 0,
    ipLocation: "Chargement...",
    country: "",
    isVpn: false,
    connectionType: "unknown"
  });
  
  // Anti-cheat tracking
  const [cheatIndicators, setCheatIndicators] = useState<CheatIndicators>({
    tab_switches: 0,
    copy_attempts: 0,
    paste_attempts: 0,
    time_away: 0,
    right_click_attempts: 0,
    blocked_shortcuts: 0,
    fullscreen_exits: 0,
    drag_drop_attempts: 0,
    devtools_open_count: 0,
    mouse_exits: 0,
    window_resizes: 0,
    risk_score: 0,
    keystroke_analysis: {
      total_keystrokes: 0,
      avg_typing_speed: 0,
      max_typing_speed: 0,
      long_pauses: 0,
      very_fast_bursts: 0,
      typing_rhythm_variance: 0,
      backspace_ratio: 0,
      paste_like_bursts: 0
    }
  });
  const lastFocusTime = useRef<number>(Date.now());
  const startTime = useRef<number>(0);
  const awayStartTime = useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  
  // Proctoring state
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [proctoringCaptureCount, setProctoringCaptureCount] = useState(0);
  
  // Consent state for data usage
  const [dataConsentChecked, setDataConsentChecked] = useState(false);
  // Keystroke tracking refs
  const lastKeystrokeTime = useRef<number>(0);
  const keystrokeIntervals = useRef<number[]>([]);
  const totalKeystrokes = useRef<number>(0);
  const backspaceCount = useRef<number>(0);
  const lastTextLength = useRef<number>(0);
  const typingStartTime = useRef<number>(0);
  
  // localStorage persistence refs
  const lastSaveTime = useRef<number>(0);
  const testStartTimestamp = useRef<number>(0); // epoch ms when test started
  const totalDurationRef = useRef<number>(0); // total allowed seconds
  const autoSubmittingRef = useRef<boolean>(false); // prevent double auto-submit

  // Load connection info
  useEffect(() => {
    const fetchConnectionInfo = async () => {
      try {
        // Measure latency with a simple ping
        const pingStart = performance.now();
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
        const latency = Math.round(performance.now() - pingStart);

        // Get IP info from a free API
        const ipResponse = await fetch('https://ipapi.co/json/');
        const ipData = await ipResponse.json();
        
        // Get connection type
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        const connectionType = connection?.effectiveType || 'unknown';
        const downlink = connection?.downlink || 0;

        // Detect VPN (heuristic based on hosting providers and data center IPs)
        const vpnIndicators = ['hosting', 'datacenter', 'vpn', 'proxy', 'cloud'];
        const isVpn = ipData.org ? vpnIndicators.some(indicator => 
          ipData.org.toLowerCase().includes(indicator)
        ) : false;

        setConnectionInfo({
          latency,
          downloadSpeed: downlink,
          ipLocation: ipData.city || 'Inconnu',
          country: ipData.country_name || ipData.country || 'Inconnu',
          isVpn,
          connectionType
        });
      } catch (error) {
        console.error('Error fetching connection info:', error);
        setConnectionInfo(prev => ({
          ...prev,
          ipLocation: 'Non disponible',
          country: ''
        }));
      }
    };

    fetchConnectionInfo();
  }, []);

  // ========== localStorage persistence helpers ==========
  const saveSessionToStorage = useCallback(() => {
    if (!testId || !expertProfile || !testData || !testStarted || testCompleted) return;
    const session: SavedTestSession = {
      testId,
      jobId: jobId || null,
      expertId: expertProfile.id,
      startedAt: testStartTimestamp.current,
      totalDurationSeconds: totalDurationRef.current,
      timeRemaining,
      answers,
      cheatIndicators,
      testData,
      proctoringEnabled,
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('Failed to save test session to localStorage', e);
    }
  }, [testId, expertProfile, testData, testStarted, testCompleted, jobId, timeRemaining, answers, cheatIndicators, proctoringEnabled]);

  const clearSessionStorage = useCallback(() => {
    try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
  }, []);

  // beforeunload: save session synchronously before leaving
  useEffect(() => {
    if (!testStarted || testCompleted) return;
    const handler = () => { saveSessionToStorage(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [testStarted, testCompleted, saveSessionToStorage]);

  // Throttled auto-save every 10 seconds
  useEffect(() => {
    if (!testStarted || testCompleted) return;
    const interval = setInterval(() => {
      saveSessionToStorage();
    }, SAVE_THROTTLE_MS);
    return () => clearInterval(interval);
  }, [testStarted, testCompleted, saveSessionToStorage]);

  // Auto-submit helper for expired/abandoned sessions
  const autoSubmitExpiredSession = useCallback(async (session: SavedTestSession) => {
    if (autoSubmittingRef.current) return;
    autoSubmittingRef.current = true;
    console.log('Auto-submitting expired test session', session.testId);
    
    try {
      const timeTaken = Math.round((Date.now() - session.startedAt) / 1000);
      const cheatWithAutoFlag = {
        ...session.cheatIndicators,
        auto_submitted_reason: 'session_expired_or_abandoned',
      };
      
      const { data, error } = await supabase.functions.invoke("evaluate-test", {
        body: {
          test_id: session.testId,
          expert_id: session.expertId,
          job_offer_id: session.jobId,
          answers: session.answers,
          time_taken_seconds: timeTaken,
          cheat_indicators: cheatWithAutoFlag,
          auto_submitted: true,
        }
      });

      if (error) {
        console.error('Auto-submit failed:', error);
      } else if (data?.error) {
        console.error('Auto-submit returned error:', data.error);
      } else {
        console.log('Auto-submit succeeded, score:', data?.score);
        toast.info("Votre test précédent a été soumis automatiquement car le temps était écoulé.");
        setResult(data);
        setTestCompleted(true);

        // C3: Create notification for auto-submitted test
        try {
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (authSession) {
            await supabase.from("notifications").insert({
              user_id: authSession.user.id,
              title: "Test soumis automatiquement",
              message: `Votre test a été soumis automatiquement (temps écoulé/abandon). Score: ${data?.score || 0}%`,
              type: "info",
              link: "/expert/home",
            });
          }
        } catch (notifErr) {
          console.error("Failed to create auto-submit notification:", notifErr);
        }
      }
    } catch (e) {
      console.error('Auto-submit exception:', e);
    } finally {
      clearSessionStorage();
      autoSubmittingRef.current = false;
    }
  }, [clearSessionStorage]);

  // Load expert profile and check for existing test
  useEffect(() => {
    loadExpertData();
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!testStarted || testCompleted || timeRemaining <= 0 || testExpired) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmit(); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testStarted, testCompleted, testExpired]);

  // Anti-cheat: Track tab visibility with 5-minute timeout
  useEffect(() => {
    if (!testStarted || testExpired) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastFocusTime.current = Date.now();
        awayStartTime.current = Date.now();
        setCheatIndicators(prev => ({
          ...prev,
          tab_switches: prev.tab_switches + 1
        }));
      } else {
        const timeAway = Math.round((Date.now() - lastFocusTime.current) / 1000);
        
        // Check if user was away for more than 5 minutes
        if (timeAway > MAX_AWAY_TIME) {
          setTestExpired(true);
          toast.error("Test expiré - Vous avez quitté la page pendant plus de 5 minutes");
          return;
        }
        
        setCheatIndicators(prev => ({
          ...prev,
          time_away: prev.time_away + timeAway
        }));
        awayStartTime.current = null;
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setCheatIndicators(prev => ({
        ...prev,
        copy_attempts: prev.copy_attempts + 1
      }));
      toast.warning("Copier est désactivé pendant le test");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setCheatIndicators(prev => ({
        ...prev,
        paste_attempts: prev.paste_attempts + 1
      }));
      toast.warning("Coller est désactivé pendant le test");
    };

    // Block right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setCheatIndicators(prev => ({
        ...prev,
        right_click_attempts: prev.right_click_attempts + 1
      }));
      toast.warning("Clic droit désactivé pendant le test");
    };

    // Block keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const blockedCombos = [
        { ctrl: true, key: 'c' },
        { ctrl: true, key: 'v' },
        { ctrl: true, key: 'x' },
        { ctrl: true, key: 'a' },
        { ctrl: true, shift: true, key: 'i' },
        { ctrl: true, shift: true, key: 'j' },
        { ctrl: true, shift: true, key: 'c' },
        { ctrl: true, key: 'u' },
        { key: 'F12' },
        { key: 'F5' },
        { ctrl: true, key: 'r' },
        { ctrl: true, shift: true, key: 'r' },
      ];

      const isBlocked = blockedCombos.some(combo => {
        const ctrlMatch = combo.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = combo.shift ? e.shiftKey : !combo.shift || !e.shiftKey;
        const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase();
        return ctrlMatch && shiftMatch && keyMatch && (combo.ctrl || combo.key === 'F12' || combo.key === 'F5');
      });

      if (isBlocked) {
        e.preventDefault();
        e.stopPropagation();
        setCheatIndicators(prev => ({
          ...prev,
          blocked_shortcuts: prev.blocked_shortcuts + 1
        }));
        toast.warning("Raccourci clavier désactivé pendant le test");
      }
    };

    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      
      if (!isCurrentlyFullscreen && testStarted && !testExpired && !testCompleted) {
        setCheatIndicators(prev => ({
          ...prev,
          fullscreen_exits: prev.fullscreen_exits + 1
        }));
        setFullscreenWarning(true);
        toast.error("Vous avez quitté le mode plein écran !");
      }
    };

    // Check periodically if user has been away too long
    const awayChecker = setInterval(() => {
      if (awayStartTime.current && document.hidden) {
        const timeAway = Math.round((Date.now() - awayStartTime.current) / 1000);
        if (timeAway > MAX_AWAY_TIME) {
          setTestExpired(true);
          toast.error("Test expiré - Vous avez quitté la page pendant plus de 5 minutes");
        }
      }
    }, 10000);

    // Block drag-and-drop (bypass for paste blocking)
    const handleDragStart = (e: DragEvent) => { e.preventDefault(); };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setCheatIndicators(prev => ({
        ...prev,
        drag_drop_attempts: prev.drag_drop_attempts + 1
      }));
      toast.warning("Glisser-déposer désactivé pendant le test");
    };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); };

    // DevTools detection (heuristic)
    const devtoolsChecker = setInterval(() => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        setCheatIndicators(prev => ({
          ...prev,
          devtools_open_count: prev.devtools_open_count + 1
        }));
      }
    }, 2000);

    // Mouse leave detection
    const handleMouseLeave = () => {
      setCheatIndicators(prev => ({
        ...prev,
        mouse_exits: prev.mouse_exits + 1
      }));
    };

    // Window resize detection (throttled)
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimeout) return;
      resizeTimeout = setTimeout(() => {
        resizeTimeout = null;
        setCheatIndicators(prev => ({
          ...prev,
          window_resizes: prev.window_resizes + 1
        }));
      }, 1000);
    };

    // Blur content when page loses focus (anti-screenshot)
    const handleBlur = () => {
      const testContainer = document.getElementById('test-container');
      if (testContainer) testContainer.style.filter = 'blur(10px)';
    };
    const handleFocus = () => {
      const testContainer = document.getElementById('test-container');
      if (testContainer) testContainer.style.filter = 'none';
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragover", handleDragOver);
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragover", handleDragOver);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      clearInterval(awayChecker);
      clearInterval(devtoolsChecker);
      // Restore content visibility
      const testContainer = document.getElementById('test-container');
      if (testContainer) testContainer.style.filter = 'none';
    };
  }, [testStarted, testExpired, testCompleted]);

  // Compute aggregated risk score in real-time
  useEffect(() => {
    if (!testStarted) return;
    const ci = cheatIndicators;
    let score = 0;
    score += Math.min(ci.tab_switches * 15, 30);
    score += Math.min(ci.paste_attempts * 25, 50);
    score += Math.min(ci.fullscreen_exits * 20, 40);
    score += Math.min(ci.devtools_open_count * 10, 20);
    score += Math.min(ci.mouse_exits * 2, 10);
    score += Math.min(ci.drag_drop_attempts * 15, 30);
    score += Math.min(ci.window_resizes * 3, 10);
    const br = ci.keystroke_analysis.backspace_ratio;
    if (ci.keystroke_analysis.total_keystrokes > 50 && (br < 0.03 || br > 0.3)) {
      score += 15;
    }
    score += Math.min(ci.keystroke_analysis.paste_like_bursts * 10, 20);
    const finalScore = Math.min(score, 100);
    if (ci.risk_score !== finalScore) {
      setCheatIndicators(prev => ({ ...prev, risk_score: finalScore }));
    }
  }, [
    testStarted,
    cheatIndicators.tab_switches, cheatIndicators.paste_attempts,
    cheatIndicators.fullscreen_exits, cheatIndicators.devtools_open_count,
    cheatIndicators.mouse_exits, cheatIndicators.drag_drop_attempts,
    cheatIndicators.window_resizes, cheatIndicators.keystroke_analysis.backspace_ratio,
    cheatIndicators.keystroke_analysis.paste_like_bursts,
    cheatIndicators.keystroke_analysis.total_keystrokes,
  ]);

  const loadExpertData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get expert profile
      const { data: profile, error: profileError } = await supabase
        .from("expert_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        toast.error(t('test.profileNotFound'));
        navigate("/expert/onboarding");
        return;
      }

      setExpertProfile(profile);

      // Get job details if jobId is provided
      if (jobId) {
        const { data: job } = await supabase
          .from("job_offers")
          .select("*")
          .eq("id", jobId)
          .single();
        
        if (job) {
          setJobDetails(job);
        }
      }

      // ===== Check for saved session in localStorage =====
      try {
        const savedRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedRaw) {
          const saved: SavedTestSession = JSON.parse(savedRaw);
          // Only restore if it belongs to this expert
          if (saved.expertId === profile.id) {
            const elapsedSec = (Date.now() - saved.startedAt) / 1000;
            const recalcTimeRemaining = saved.totalDurationSeconds - elapsedSec;
            
            if (recalcTimeRemaining <= 0) {
              // Time fully expired → auto-submit with saved answers
              console.log('Saved session expired, auto-submitting...');
              autoSubmitExpiredSession(saved);
              // Don't restore UI, let it fall through to normal load
            } else {
              // Session still valid → restore and resume
              console.log('Restoring saved test session, time remaining:', Math.round(recalcTimeRemaining));
              setTestId(saved.testId);
              setTestData(saved.testData);
              setAnswers(saved.answers);
              setCheatIndicators(saved.cheatIndicators);
              setProctoringEnabled(saved.proctoringEnabled);
              setTimeRemaining(Math.round(recalcTimeRemaining));
              setTestStarted(true);
              testStartTimestamp.current = saved.startedAt;
              totalDurationRef.current = saved.totalDurationSeconds;
              startTime.current = saved.startedAt;
              toast.info("Test en cours restauré. Votre progression a été sauvegardée.");
              setLoading(false);
              return; // Skip checking for existing submissions
            }
          }
        }
      } catch (e) {
        console.warn('Failed to restore test session', e);
        clearSessionStorage();
      }

      // Check for existing test submission for this specific job
      if (jobId) {
        const { data: submissions } = await supabase
          .from("test_submissions")
          .select("*, technical_tests(*)")
          .eq("expert_id", profile.id)
          .eq("job_offer_id", jobId)
          .order("submitted_at", { ascending: false })
          .limit(1);

        if (submissions && submissions.length > 0) {
          setExistingSubmission(submissions[0]);
          setResult({
            score: submissions[0].test_score,
            evaluation: submissions[0].feedback
          });
          setTestCompleted(true);
        }
      }

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const generateTest = async () => {
    if (!expertProfile) return;

    // Verify consent is checked
    if (!dataConsentChecked) {
      toast.error("Vous devez accepter les conditions d'utilisation des données avant de continuer.");
      return;
    }

    setGenerating(true);
    try {
      // Get user for consent logging
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Log consent with timestamp
        await supabase.from("test_consents").insert({
          user_id: user.id,
          expert_id: expertProfile.id,
          consent_version: "v1.0",
          consent_type: "test_data_usage",
          user_agent: navigator.userAgent
        });
      }

      // Combine expert skills with job requirements for a relevant test
      const expertSkills = expertProfile.primary_skills || [];
      const jobSkills = jobDetails?.requirements?.need_to_have || [];
      const combinedSkills = [...new Set([...expertSkills, ...jobSkills.slice(0, 4)])].slice(0, 6);
      
      const { data, error } = await supabase.functions.invoke("generate-test", {
        body: {
          expert_id: expertProfile.id,
          job_offer_id: jobId,
          skills: combinedSkills.length > 0 ? combinedSkills : ["JavaScript", "React"],
          title: jobDetails?.title || expertProfile.title || "Développeur Full Stack",
          difficulty: "intermediate",
          job_description: jobDetails?.description || ""
        }
      });

      if (error) throw error;

      // Handle profile incomplete error - redirect to profile page
      if (data.profile_incomplete) {
        const missingLabels = data.missing_fields_labels || {};
        const missingFieldsList = data.missing_fields?.map((f: string) => missingLabels[f] || f).join(", ");
        
        toast.error(
          `Profil incomplet : ${missingFieldsList}. Veuillez compléter votre profil avant de passer le test.`,
          {
            duration: 6000,
            action: {
              label: "Compléter le profil",
              onClick: () => navigate("/expert/profile")
            }
          }
        );
        
        // Redirect to profile after a short delay
        setTimeout(() => {
          navigate("/expert/profile");
        }, 2000);
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setTestId(data.test_id);
      setTestData(data.test);
      setTimeRemaining((data.test.estimated_duration_minutes || 35) * 60);
      setAnswers(data.test.questions.map(() => ({ answer: "" })));
      
      toast.success("Test généré ! Vous pouvez commencer quand vous êtes prêt.");
    } catch (error: any) {
      console.error("Error generating test:", error);
      toast.error(error.message || "Erreur lors de la génération du test");
    } finally {
      setGenerating(false);
    }
  };

  // Enter fullscreen mode
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      setFullscreenWarning(false);
    } catch (error) {
      console.error("Could not enter fullscreen:", error);
      toast.error("Impossible d'activer le mode plein écran");
    }
  };

  const startTest = () => {
    enterFullscreen();
    setTestStarted(true);
    startTime.current = Date.now();
    testStartTimestamp.current = Date.now();
    totalDurationRef.current = timeRemaining;
    toast.info("Le test a commencé. Bonne chance !");
  };

  // Track keystrokes for anti-cheat analysis
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!testStarted) return;
    
    const now = Date.now();
    totalKeystrokes.current += 1;
    
    // Track backspaces
    if (e.key === 'Backspace' || e.key === 'Delete') {
      backspaceCount.current += 1;
    }
    
    // Calculate interval since last keystroke
    if (lastKeystrokeTime.current > 0) {
      const interval = now - lastKeystrokeTime.current;
      keystrokeIntervals.current.push(interval);
      
      // Keep only last 100 intervals for analysis
      if (keystrokeIntervals.current.length > 100) {
        keystrokeIntervals.current.shift();
      }
      
      // Detect long pause (> 30 seconds)
      if (interval > 30000) {
        setCheatIndicators(prev => ({
          ...prev,
          keystroke_analysis: {
            ...prev.keystroke_analysis,
            long_pauses: prev.keystroke_analysis.long_pauses + 1
          }
        }));
      }
    } else {
      typingStartTime.current = now;
    }
    
    lastKeystrokeTime.current = now;
  }, [testStarted]);

  // Analyze text changes for suspicious patterns
  const handleAnswerChange = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = { answer: value };
    setAnswers(newAnswers);
    
    // Detect paste-like bursts (large text insertion)
    const lengthDiff = value.length - lastTextLength.current;
    if (lengthDiff > 50) { // More than 50 chars at once
      setCheatIndicators(prev => ({
        ...prev,
        keystroke_analysis: {
          ...prev.keystroke_analysis,
          paste_like_bursts: prev.keystroke_analysis.paste_like_bursts + 1
        }
      }));
    }
    lastTextLength.current = value.length;
    
    // Update keystroke analysis periodically
    updateKeystrokeAnalysis();
  };
  
  // Calculate and update keystroke analysis metrics
  const updateKeystrokeAnalysis = useCallback(() => {
    const intervals = keystrokeIntervals.current;
    if (intervals.length < 5) return; // Need enough data
    
    // Calculate average typing speed (chars per minute)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const avgSpeed = avgInterval > 0 ? (60000 / avgInterval) : 0;
    
    // Calculate max speed from minimum interval
    const minInterval = Math.min(...intervals);
    const maxSpeed = minInterval > 0 ? (60000 / minInterval) : 0;
    
    // Count very fast bursts (> 600 chars/min is suspicious - faster than pro typists)
    const fastBursts = intervals.filter(i => i < 100).length; // < 100ms between keys
    
    // Calculate rhythm variance (low variance = robotic/suspicious)
    const mean = avgInterval;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const rhythmVariance = mean > 0 ? Math.min(stdDev / mean, 1) : 0; // Normalize to 0-1
    
    // Calculate backspace ratio
    const backspaceRatio = totalKeystrokes.current > 0 
      ? (backspaceCount.current / totalKeystrokes.current) 
      : 0;
    
    setCheatIndicators(prev => ({
      ...prev,
      keystroke_analysis: {
        ...prev.keystroke_analysis,
        total_keystrokes: totalKeystrokes.current,
        avg_typing_speed: Math.round(avgSpeed),
        max_typing_speed: Math.round(maxSpeed),
        very_fast_bursts: fastBursts,
        typing_rhythm_variance: parseFloat(rhythmVariance.toFixed(3)),
        backspace_ratio: parseFloat(backspaceRatio.toFixed(3))
      }
    }));
  }, []);

  const handleSubmit = async () => {
    if (!testId || !expertProfile || submitting) return;

    // Final keystroke analysis update
    updateKeystrokeAnalysis();
    
    setSubmitting(true);
    try {
      const timeTaken = Math.round((Date.now() - startTime.current) / 1000);

      const { data, error } = await supabase.functions.invoke("evaluate-test", {
        body: {
          test_id: testId,
          expert_id: expertProfile.id,
          job_offer_id: jobId,
          answers: answers,
          time_taken_seconds: timeTaken,
          cheat_indicators: cheatIndicators
        }
      });

      if (error) {
        // Check if the edge function returned a structured error (e.g. 400 status)
        const errorBody = typeof error === 'object' && error.context?.body ? 
          (() => { try { return JSON.parse(error.context.body); } catch { return null; } })() : null;
        
        if (errorBody?.code === 'MIN_TIME_NOT_MET') {
          toast.error("Temps insuffisant : vous devez passer au moins 5 minutes sur le test avant de soumettre.", { duration: 8000 });
          setSubmitting(false);
          return;
        }
        throw error;
      }

      if (data.error) {
        if (data.code === 'MIN_TIME_NOT_MET') {
          toast.error("Temps insuffisant : vous devez passer au moins 5 minutes sur le test avant de soumettre.", { duration: 8000 });
          setSubmitting(false);
          return;
        }
        throw new Error(data.error);
      }

      setResult(data);
      setTestCompleted(true);
      clearSessionStorage();
      toast.success("Test soumis et évalué !");
    } catch (error: any) {
      console.error("Error submitting test:", error);
      const msg = error?.message || "Erreur lors de la soumission";
      if (msg.includes("Temps de test insuffisant") || msg.includes("5 minutes")) {
        toast.error("Temps insuffisant : vous devez passer au moins 5 minutes sur le test avant de soumettre.", { duration: 8000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case "theory": return <Brain className="w-5 h-5" />;
      case "code": return <Code className="w-5 h-5" />;
      case "problem_solving": return <Lightbulb className="w-5 h-5" />;
      default: return <Brain className="w-5 h-5" />;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-success text-success-foreground">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-primary text-primary-foreground">Bon</Badge>;
    if (score >= 40) return <Badge className="bg-warning text-warning-foreground">Moyen</Badge>;
    return <Badge className="bg-destructive text-destructive-foreground">À améliorer</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mobile: show warning instead of blocking
  if (!loading && isMobileDevice()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-foreground mb-2">Test non disponible sur mobile</p>
          <p className="text-muted-foreground">Veuillez utiliser un ordinateur pour passer le test.</p>
        </div>
      </div>
    );
  }

  if (testExpired) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                STEF
              </a>
              <Button variant="outline" onClick={() => navigate("/expert/dashboard")}>
                {t('test.backToDashboard')}
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="border-destructive">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
              <CardTitle className="text-2xl text-destructive">{t('test.expired')}</CardTitle>
              <CardDescription>
                {t('test.expiredMessage')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('test.expiredAlert')}
                </AlertDescription>
              </Alert>
              <Button 
                className="w-full" 
                onClick={() => navigate("/expert/dashboard")}
              >
                {t('test.backToDashboard')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Connection info component
  const ConnectionInfoBar = () => (
    <div className="bg-muted/50 border-b border-border py-2 px-4">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>{t('test.latency')}: <span className={connectionInfo.latency < 100 ? "text-success" : connectionInfo.latency < 300 ? "text-warning" : "text-destructive"}>{connectionInfo.latency}ms</span></span>
        </div>
        <div className="flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          <span>{t('test.speed')}: {connectionInfo.downloadSpeed > 0 ? `${connectionInfo.downloadSpeed} Mbps` : 'N/A'}</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>{connectionInfo.ipLocation}{connectionInfo.country ? `, ${connectionInfo.country}` : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <Globe className="w-3 h-3" />
          <span className={connectionInfo.isVpn ? "text-warning" : "text-success"}>
            {t('test.vpn')}: {connectionInfo.isVpn ? t('test.detected') : t('test.notDetected')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span>{t('test.connection')}: {connectionInfo.connectionType}</span>
        </div>
      </div>
    </div>
  );

  // Show results if test completed
  if (testCompleted && result) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                STEF
              </a>
              <Button variant="outline" onClick={() => navigate("/expert/dashboard")}>
                {t('test.backToDashboard')}
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card className="mb-8">
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-primary-foreground" />
              </div>
              <CardTitle className="text-3xl">{t('test.completed')}</CardTitle>
              <CardDescription>{t('test.yourResults')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(() => {
                const isEmptySubmission = result.score === 0 && (
                  !result.evaluation?.evaluations ||
                  result.evaluation.evaluations.every((ev: any) => ev.score === 0)
                );

                if (isEmptySubmission) {
                  const unansweredQuestions = result.evaluation?.evaluations || [];
                  return (
                    <>
                      {/* Header — Score non évaluable */}
                      <div className="text-center p-8 bg-muted/50 rounded-xl">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                          <FileQuestion className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                          Score : non évaluable
                        </p>
                        <p className="text-muted-foreground mt-2">
                          Aucune réponse détectée pour cette évaluation
                        </p>
                      </div>

                      {/* Feedback global — ton professionnel */}
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-primary" />
                          Retour sur votre évaluation
                        </h3>
                        <div className="space-y-3 text-muted-foreground">
                          <p>
                            Cette évaluation n'a pas pu être analysée car aucune réponse n'a été soumise.
                          </p>
                          <p>
                            Pour être évalué, il est recommandé de fournir au moins une approche, même partielle
                            (pseudo-code, raisonnement, architecture, explication).
                          </p>
                          <p className="font-medium text-foreground">
                            L'évaluation STEF valorise le raisonnement autant que la solution finale.
                          </p>
                        </div>
                      </div>

                      {/* Statut neutre */}
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <p className="font-medium flex items-center gap-2">
                          <ListChecks className="w-5 h-5 text-muted-foreground" />
                          Statut : Évaluation incomplète
                        </p>
                      </div>

                      {/* Résumé des questions non répondues */}
                      {unansweredQuestions.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">Questions non répondues</h3>
                          <Card>
                            <CardContent className="pt-4 space-y-3">
                              <ul className="space-y-2">
                                {unansweredQuestions.map((ev: any, idx: number) => (
                                  <li key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      Question {ev.question_id || idx + 1}
                                    </span>
                                    <Badge variant="outline">
                                      {ev.max_score || 0} pts
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                              <Alert>
                                <AlertDescription className="text-sm">
                                  Les réponses partielles sont acceptées et évaluées. 
                                  Même un raisonnement incomplet peut vous rapporter des points.
                                </AlertDescription>
                              </Alert>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Bloc CTA */}
                      <div className="text-center space-y-4 pt-4">
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button 
                            size="lg" 
                            onClick={() => {
                              setTestCompleted(false);
                              setResult(null);
                              setExistingSubmission(null);
                              setTestData(null);
                              setTestStarted(false);
                            }}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Repasser l'évaluation
                          </Button>
                          <Button 
                            variant="outline" 
                            size="lg"
                            onClick={() => {
                              setTestCompleted(false);
                              setResult(null);
                              setExistingSubmission(null);
                              setTestData(null);
                              setTestStarted(false);
                            }}
                          >
                            Modifier mes réponses
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          Les profils évaluables ont significativement plus de visibilité auprès des entreprises.
                        </p>
                      </div>

                      {/* RLHF Feedback — toujours affiché */}
                      {!feedbackSubmitted && expertProfile?.id && (
                        <div className="mt-6">
                          <RLHFFeedbackFormWithGold
                            taskContext={{
                              task_type: "ai_hiring_test_evaluation",
                              job_role: jobDetails?.title || expertProfile?.title || "Developer",
                              job_level_targeted: expertProfile?.years_of_experience < 2 ? "junior" : 
                                expertProfile?.years_of_experience < 5 ? "mid" : 
                                expertProfile?.years_of_experience < 10 ? "senior" : "lead",
                              language: "fr",
                              country_context: expertProfile?.country || "FR",
                              prompt_used: "Generate and evaluate technical test",
                              constraints: {
                                duration_minutes: testData?.estimated_duration_minutes || 35,
                                difficulty_expected: "intermediate",
                                format_expected: "practical + theory"
                              }
                            }}
                            aiOutput={{
                              model_type: "lovable_ai_v1",
                              generated_output: result.evaluation,
                              test_id: testId || undefined,
                              job_offer_id: jobId || undefined
                            }}
                            expertId={expertProfile.id}
                            onSubmitted={() => setFeedbackSubmitted(true)}
                          />
                        </div>
                      )}
                    </>
                  );
                }

                // === Affichage normal (réponses soumises) ===
                return (
                  <>
                    {/* Score principal */}
                    <div className="text-center p-8 bg-muted/50 rounded-xl">
                      <p className="text-sm text-muted-foreground mb-2">{t('test.yourScore')}</p>
                      <p className="text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                        {result.score}/100
                      </p>
                      <div className="mt-4">
                        {getScoreBadge(result.score)}
                      </div>
                      {result.score >= 80 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-center gap-2 text-success">
                            <Shield className="w-5 h-5" />
                            <span className="font-medium">{t('test.verifiedProfile')}</span>
                          </div>
                          
                          {result.certification?.issued && result.certification?.certificate_id && (
                            <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                              <div className="flex items-center justify-center gap-2 mb-2">
                                <Award className="w-5 h-5 text-success" />
                                <span className="font-semibold text-success">Certification obtenue !</span>
                              </div>
                              <p className="text-sm text-muted-foreground text-center mb-3">
                                Votre certificat a été généré automatiquement
                              </p>
                              <Button 
                                onClick={() => navigate(`/expert/certifications/${result.certification.certificate_id}`)}
                                className="w-full bg-success hover:bg-success/90"
                              >
                                <Award className="w-4 h-4 mr-2" />
                                Voir mon certificat
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Évaluation détaillée */}
                    {result.evaluation && (
                      <>
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">{t('test.globalFeedback')}</h3>
                          <p className="text-muted-foreground">{result.evaluation.overall_feedback}</p>
                        </div>

                        {result.evaluation.skill_assessment && (
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg">{t('test.skillsAssessment')}</h3>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(result.evaluation.skill_assessment).map(([skill, level]) => (
                                <Badge key={skill} variant="outline" className="py-2 px-3">
                                  {skill}: {level as string}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.evaluation.evaluations && (
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg">{t('test.questionDetails')}</h3>
                            {result.evaluation.evaluations.map((ev: any, idx: number) => (
                              <Card key={idx}>
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">{t('test.question')} {ev.question_id}</span>
                                    <Badge variant={ev.score >= ev.max_score * 0.7 ? "default" : "secondary"}>
                                      {ev.score}/{ev.max_score} pts
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{ev.feedback}</p>
                                  {ev.strengths?.length > 0 && (
                                    <div className="mt-2">
                                      <span className="text-xs text-success font-medium">{t('test.strengths')}: </span>
                                      <span className="text-xs text-muted-foreground">{ev.strengths.join(", ")}</span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}

                        {result.evaluation.recommendation && (
                          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="font-medium">
                              {t('test.recommendation')}: {" "}
                              {result.evaluation.recommendation === "hire" && `✅ ${t('test.recommendHire')}`}
                              {result.evaluation.recommendation === "maybe" && `🤔 ${t('test.recommendMaybe')}`}
                              {result.evaluation.recommendation === "no_hire" && `❌ ${t('test.recommendNoHire')}`}
                            </p>
                          </div>
                        )}

                        {/* RLHF Feedback Section - MANDATORY */}
                        {!feedbackSubmitted && expertProfile?.id && (
                          <div className="mt-6">
                            <RLHFFeedbackFormWithGold
                              taskContext={{
                                task_type: "ai_hiring_test_evaluation",
                                job_role: jobDetails?.title || expertProfile?.title || "Developer",
                                job_level_targeted: expertProfile?.years_of_experience < 2 ? "junior" : 
                                  expertProfile?.years_of_experience < 5 ? "mid" : 
                                  expertProfile?.years_of_experience < 10 ? "senior" : "lead",
                                language: "fr",
                                country_context: expertProfile?.country || "FR",
                                prompt_used: "Generate and evaluate technical test",
                                constraints: {
                                  duration_minutes: testData?.estimated_duration_minutes || 35,
                                  difficulty_expected: "intermediate",
                                  format_expected: "practical + theory"
                                }
                              }}
                              aiOutput={{
                                model_type: "lovable_ai_v1",
                                generated_output: result.evaluation,
                                test_id: testId || undefined,
                                job_offer_id: jobId || undefined
                              }}
                              expertId={expertProfile.id}
                              onSubmitted={() => setFeedbackSubmitted(true)}
                            />
                          </div>
                        )}

                        {/* Navigation - only show after feedback */}
                        {feedbackSubmitted && (
                          <div className="mt-6 text-center">
                            <Button onClick={() => navigate("/expert/dashboard")} size="lg">
                              Retour au tableau de bord
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show test generation or instructions
  if (!testData) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                STEF
              </a>
              <Button variant="outline" onClick={() => navigate("/expert/dashboard")}>
                {t('test.return')}
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">{t('test.title')}</CardTitle>
              <CardDescription>
                {t('test.validateSkills')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {existingSubmission ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('test.alreadyTaken')} {existingSubmission.test_score}/100
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-4">
                    <h3 className="font-semibold">{t('test.willEvaluate')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {expertProfile?.primary_skills?.map((skill: string) => (
                        <Badge key={skill} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <span>{t('test.estimatedDuration')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Code className="w-5 h-5 text-muted-foreground" />
                      <span>{t('test.questionsCount')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      <span>{t('test.verifiedBadge')}</span>
                    </div>
                  </div>

                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important :</strong> {t('test.monitoredWarning')}
                    </AlertDescription>
                  </Alert>

                  {/* RGPD Consent - Enhanced with detailed data usage info */}
                  <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
                    <h4 className="font-semibold flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-primary" />
                      Consentement RGPD — Utilisation des données
                    </h4>
                    
                    <div className="text-xs text-muted-foreground space-y-2">
                      <p><strong>Données collectées :</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Vos réponses techniques au test (anonymisées)</li>
                        <li>Le temps passé par question</li>
                        <li>Les indicateurs anti-triche (changements d'onglet, etc.)</li>
                        <li>Métadonnées de session (type d'appareil, navigateur)</li>
                      </ul>
                      
                      <p><strong>Finalités :</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Évaluation de vos compétences techniques</li>
                        <li>Amélioration des algorithmes d'évaluation IA (données anonymisées)</li>
                        <li>Calcul de statistiques agrégées (percentiles, cohortes)</li>
                      </ul>
                      
                      <p><strong>Vos droits :</strong> Accès, rectification, suppression, portabilité (contact : privacy@stef.ai). Conservation : 12 mois maximum.</p>
                      
                      <p><strong>Ce qui n'est PAS partagé :</strong> Votre nom, email, téléphone, LinkedIn ne sont jamais transmis à des tiers ni utilisés pour l'entraînement IA.</p>
                    </div>
                    
                    <div className="flex items-start gap-3 pt-2 border-t border-border">
                      <Checkbox 
                        id="data-consent"
                        checked={dataConsentChecked}
                        onCheckedChange={(checked) => setDataConsentChecked(checked === true)}
                        className="mt-1"
                      />
                      <Label htmlFor="data-consent" className="font-medium cursor-pointer leading-relaxed text-sm">
                        J'ai lu et j'accepte l'utilisation de mes données telle que décrite ci-dessus, conformément au RGPD.
                        <a href="/terms" target="_blank" className="text-primary hover:underline ml-1">
                          Conditions d'utilisation
                        </a>
                      </Label>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={generateTest}
                    disabled={generating || !dataConsentChecked}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('test.generating')}
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4 mr-2" />
                        {t('test.generatePersonalized')}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show test ready to start
  if (!testStarted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                STEF
              </a>
              <Badge variant="outline" className="text-lg px-4 py-2">
                <Clock className="w-4 h-4 mr-2" />
                {formatTime(timeRemaining)}
              </Badge>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Test Prêt !</CardTitle>
              <CardDescription>
                {testData.questions.length} questions • {testData.estimated_duration_minutes} minutes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Une fois démarré, le chronomètre ne peut pas être arrêté. 
                  Assurez-vous d'avoir le temps nécessaire.
                </AlertDescription>
              </Alert>

              <Alert className="bg-primary/10 border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription>
                  <strong>Mode sécurisé :</strong> Le test s'ouvrira en plein écran. 
                  Copier/coller, clic droit et certains raccourcis seront désactivés.
                </AlertDescription>
              </Alert>

              {/* Proctoring option */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="proctoring-toggle" className="font-medium cursor-pointer">
                      Webcam Proctoring
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Active la surveillance webcam pour valider votre identité
                    </p>
                  </div>
                </div>
                <Switch
                  id="proctoring-toggle"
                  checked={proctoringEnabled}
                  onCheckedChange={setProctoringEnabled}
                />
              </div>

              {proctoringEnabled && (
                <Alert className="bg-success/10 border-success/20">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    <strong>Proctoring activé :</strong> Votre webcam prendra des photos périodiques. 
                    Les tests avec proctoring ont plus de crédibilité auprès des recruteurs.
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                className="w-full" 
                size="lg"
                onClick={startTest}
              >
                Commencer le test {proctoringEnabled && "(avec webcam)"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show active test
  const question = testData.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / testData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-background select-none print:hidden" id="test-container">
      {/* Fullscreen warning modal */}
      {fullscreenWarning && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Mode plein écran requis</CardTitle>
              <CardDescription>
                Vous avez quitté le mode plein écran. Cet incident a été enregistré.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Quitter le mode plein écran plusieurs fois peut affecter votre score et être signalé comme comportement suspect.
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={enterFullscreen}>
                <Shield className="w-4 h-4 mr-2" />
                Revenir en plein écran
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Connection info bar */}
      <ConnectionInfoBar />
      
      {/* Header with timer */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                STEF
              </span>
              <Badge variant="outline">
                Question {currentQuestion + 1}/{testData.questions.length}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={cheatIndicators.risk_score > 50 ? "destructive" : cheatIndicators.risk_score > 20 ? "secondary" : "outline"}
                className="text-xs"
              >
                <Shield className="w-3 h-3 mr-1" />
                {cheatIndicators.risk_score > 50 ? "Risque élevé" : cheatIndicators.risk_score > 20 ? "Risque modéré" : "OK"}
              </Badge>
              <Badge 
                variant={timeRemaining < 300 ? "destructive" : "outline"} 
                className="text-lg px-4 py-2"
              >
                <Clock className="w-4 h-4 mr-2" />
                {formatTime(timeRemaining)}
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="h-1 mt-4" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Cheat warning */}
        {(cheatIndicators.tab_switches > 2 || cheatIndicators.paste_attempts > 0) && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Comportement suspect détecté. Cela sera pris en compte dans l'évaluation.
            </AlertDescription>
          </Alert>
        )}

          {/* Question card - clean centered layout with anti-OCR shield */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden mb-8 ocr-shield">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {question.type === "theory" && "Théorie"}
                {question.type === "code" && "Code"}
                {question.type === "problem_solving" && "Résolution"}
              </Badge>
              <span className="text-sm font-medium text-muted-foreground">
                Q{currentQuestion + 1}/{testData.questions.length}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {question.max_points} pts • ~{question.time_estimate_minutes} min
            </span>
          </div>

          {/* Question body */}
          <div className="px-6 py-8 space-y-6">
            <p className="text-lg leading-relaxed font-medium whitespace-pre-line">
              {ocrScramble(question.question)}
            </p>

            {question.context && (
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contexte</p>
                <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {ocrScramble(question.context)}
                </pre>
              </div>
            )}
          </div>

          {/* Answer section */}
          <div className="border-t bg-muted/10 px-6 py-6">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Votre réponse</p>
            <Textarea
              placeholder={question.type === "code" ? "// Écrivez votre code ici..." : "Écrivez votre réponse ici..."}
              value={answers[currentQuestion]?.answer || ""}
              onChange={(e) => handleAnswerChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={question.type === "code" ? 16 : 10}
              className={`resize-y ${question.type === "code" ? "font-mono text-sm bg-background" : "bg-background"}`}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestion(prev => prev - 1)}
            disabled={currentQuestion === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Précédent
          </Button>

          <div className="flex gap-2">
            {testData.questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  idx === currentQuestion
                    ? "bg-primary text-primary-foreground"
                    : answers[idx]?.answer
                    ? "bg-success/20 text-success border border-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {currentQuestion < testData.questions.length - 1 ? (
            <Button onClick={() => setCurrentQuestion(prev => prev + 1)}>
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-success hover:bg-success/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Évaluation...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Soumettre
                </>
              )}
            </Button>
          )}
        </div>

        {/* Proctoring sidebar - float on large screens */}
        {proctoringEnabled && (
          <div className="fixed bottom-4 right-4 hidden lg:block z-40">
            <WebcamProctoring
              testId={testId!}
              expertId={expertProfile.id}
              isActive={testStarted && !testCompleted}
              onCaptureCountChange={setProctoringCaptureCount}
              captureInterval={30}
            />
            <div className="mt-2 p-2 rounded-lg bg-muted/80 text-center backdrop-blur-sm">
              <p className="text-xs text-muted-foreground">
                {proctoringCaptureCount} captures
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpertTest;

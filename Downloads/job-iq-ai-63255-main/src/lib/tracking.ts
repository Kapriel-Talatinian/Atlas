// Centralized tracking helper for Facebook Pixel, Google Ads, GA4, and backend events
// All calls are non-blocking and fail silently

import { supabase } from "@/integrations/supabase/client";

const isDev = import.meta.env.DEV;

// ── Test mode: set to "TEST71716" to validate in Meta Events Manager, then remove ──
const FB_CAPI_TEST_CODE: string | null = "TEST71716";

const fbq = (...args: any[]) => {
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq(...args);
  }
};

const gtag = (...args: any[]) => {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag(...args);
  }
};

// Session ID for funnel tracking
const getSessionId = (): string => {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("stef_session");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("stef_session", id);
  }
  return id;
};

/** Get Facebook browser cookies for better matching */
function getFbCookies() {
  const cookies = document.cookie.split("; ");
  let fbc = "";
  let fbp = "";
  for (const c of cookies) {
    if (c.startsWith("_fbc=")) fbc = c.slice(5);
    if (c.startsWith("_fbp=")) fbp = c.slice(5);
  }
  return { fbc: fbc || undefined, fbp: fbp || undefined };
}

/** Generate a unique event_id for deduplication between Pixel and CAPI */
function generateEventId(): string {
  return crypto.randomUUID();
}

/** Fire-and-forget server-side event to Meta Conversions API via edge function */
function sendCAPI(params: {
  event_name: string;
  event_id: string;
  user_data?: Record<string, any>;
  custom_data?: Record<string, any>;
}) {
  const { fbc, fbp } = getFbCookies();

  const payload: Record<string, any> = {
    event_name: params.event_name,
    event_id: params.event_id,
    event_source_url: window.location.href,
    user_data: {
      client_user_agent: navigator.userAgent,
      fbc,
      fbp,
      ...params.user_data,
    },
    custom_data: params.custom_data,
  };

  if (FB_CAPI_TEST_CODE) {
    payload.test_event_code = FB_CAPI_TEST_CODE;
  }

  supabase.functions
    .invoke("fb-capi", { body: payload })
    .then((res) => {
      if (isDev) console.log("CAPI response:", res.data);
    })
    .catch(() => {
      // Silently fail — never block UX for tracking
    });
}

async function logToBackend(event_type: string, event_data: Record<string, any> = {}) {
  try {
    const userAgent = navigator.userAgent || "";
    const device_type = /mobile/i.test(userAgent) ? "mobile" : "desktop";

    await supabase.from("funnel_events").insert({
      session_id: getSessionId(),
      event_type,
      event_data,
      page_url: window.location.href,
      device_type,
    });
  } catch {
    // Silently fail — never block UX for tracking
  }
}

function log(msg: string) {
  if (isDev) console.log(msg);
}

export const tracking = {
  /** Landing page view */
  viewLanding() {
    const eventId = generateEventId();

    // Browser pixel (with eventID for dedup)
    fbq("track", "ViewContent", {
      content_name: "Landing Page",
      content_category: "acquisition_talent",
    }, { eventID: eventId });

    gtag("event", "page_view", {
      page_title: "Landing Page",
      page_location: window.location.href,
    });

    // Server-side CAPI
    sendCAPI({
      event_name: "ViewContent",
      event_id: eventId,
      custom_data: {
        content_name: "Landing Page",
        content_category: "acquisition_talent",
      },
    });

    logToBackend("page_view_landing");
    log("TRACK: view_landing");
  },

  /** Click on any signup button */
  initiateRegistration(method: "google" | "apple" | "email", position: "hero" | "bottom" | "sticky") {
    fbq("trackCustom", "InitiateRegistration", { method });
    gtag("event", "begin_sign_up", { method, position });
    logToBackend(`click_signup_${method}`, { position });
    log(`TRACK: initiate_registration | method=${method} | position=${position}`);
  },

  /** Registration completed */
  completeRegistration(method: "google" | "apple" | "email", userData?: {
    email?: string;
    firstName?: string;
    city?: string;
    country?: string;
    phone?: string;
  }) {
    const eventId = generateEventId();

    // Browser pixel (with eventID for dedup)
    fbq("track", "CompleteRegistration", {
      content_name: "Talent Signup",
      method,
    }, { eventID: eventId });

    gtag("event", "sign_up", { method });
    // Google Ads conversion
    gtag("event", "conversion", {
      send_to: "AW-18017755980/scyCCJHysIocEMzGxI9D",
      value: 1.0,
      currency: "EUR",
    });

    // Server-side CAPI with user data for better matching
    sendCAPI({
      event_name: "CompleteRegistration",
      event_id: eventId,
      user_data: {
        em: userData?.email,
        fn: userData?.firstName,
        ct: userData?.city,
        country: userData?.country,
        ph: userData?.phone,
      },
      custom_data: {
        content_name: "Talent Signup",
        method,
      },
    });

    logToBackend("registration_complete", { method });
    log(`TRACK: complete_registration | method=${method}`);
  },

  /** Start an evaluation */
  startEvaluation(specialty: string) {
    fbq("trackCustom", "StartEvaluation", { specialty });
    gtag("event", "begin_evaluation", { specialty });
    logToBackend("evaluation_started", { specialty });
    log(`TRACK: start_evaluation | specialty=${specialty}`);
  },

  /** Complete an evaluation */
  completeEvaluation(specialty: string, score: number) {
    fbq("trackCustom", "CompleteEvaluation", { specialty, score });
    gtag("event", "complete_evaluation", { specialty, score });
    logToBackend("evaluation_completed", { specialty, score });
    log(`TRACK: complete_evaluation | specialty=${specialty} | score=${score}`);
  },

  /** Lead — company contact form submission */
  lead(userData?: { email?: string; phone?: string; company?: string }) {
    const eventId = generateEventId();
    fbq("track", "Lead", {
      content_name: "Company Contact Form",
      content_category: "B2B",
    }, { eventID: eventId });
    gtag("event", "generate_lead", { currency: "EUR", value: 50 });
    sendCAPI({
      event_name: "Lead",
      event_id: eventId,
      user_data: {
        em: userData?.email,
        ph: userData?.phone,
      },
      custom_data: {
        content_name: "Company Contact Form",
        content_category: "B2B",
      },
    });
    logToBackend("lead", { company: userData?.company });
    log("TRACK: lead");
  },

  /** SubmitApplication — expert applies to a job */
  submitApplication(jobTitle?: string) {
    const eventId = generateEventId();
    fbq("track", "SubmitApplication", {
      content_name: jobTitle || "Job Application",
      content_category: "talent",
    }, { eventID: eventId });
    gtag("event", "submit_application", { job_title: jobTitle });
    sendCAPI({
      event_name: "SubmitApplication",
      event_id: eventId,
      custom_data: {
        content_name: jobTitle || "Job Application",
        content_category: "talent",
      },
    });
    logToBackend("submit_application", { job_title: jobTitle });
    log(`TRACK: submit_application | job=${jobTitle}`);
  },

  /** Contact — chat or support interaction */
  contact(method: "chat" | "form" | "email" = "chat") {
    const eventId = generateEventId();
    fbq("track", "Contact", {
      content_name: method,
    }, { eventID: eventId });
    gtag("event", "contact", { method });
    sendCAPI({
      event_name: "Contact",
      event_id: eventId,
      custom_data: { content_name: method },
    });
    logToBackend("contact", { method });
    log(`TRACK: contact | method=${method}`);
  },

  /** Quiz gate displayed (teaser + form shown) */
  quizResultsGated() {
    fbq("trackCustom", "QuizResultsGated");
    gtag("event", "quiz_results_gated");
    logToBackend("quiz_results_gated", {});
    log("TRACK: quiz_results_gated");
  },

  /** Quiz gate method selected */
  quizGateMethodSelected(method: "email" | "whatsapp") {
    logToBackend("quiz_gate_method_selected", { method });
    log(`TRACK: quiz_gate_method_selected | method=${method}`);
  },

  /** Quiz lead capture (email or whatsapp submitted) */
  quizLeadCapture(method: "email" | "whatsapp") {
    fbq("track", "Lead", { content_name: "Quiz Results", method });
    gtag("event", "generate_lead", { method, source: "quiz" });
    logToBackend("quiz_lead_capture", { method });
    log(`TRACK: quiz_lead_capture | method=${method}`);
  },

  /** Quiz results unlocked (full results shown) */
  quizResultsViewed() {
    fbq("trackCustom", "QuizResultsViewed");
    gtag("event", "quiz_results_viewed");
    logToBackend("quiz_results_viewed", {});
    log("TRACK: quiz_results_viewed");
  },

  /** Onboarding started */
  onboardingStarted() {
    fbq("trackCustom", "OnboardingStarted");
    gtag("event", "onboarding_started");
    logToBackend("onboarding_started", {});
    log("TRACK: onboarding_started");
  },

  /** Specialty selected in onboarding */
  specialtySelected(specialty: string) {
    fbq("trackCustom", "SpecialtySelected", { specialty });
    gtag("event", "specialty_selected", { specialty });
    logToBackend("specialty_selected", { specialty });
    log(`TRACK: specialty_selected | specialty=${specialty}`);
  },

  /** Quiz launched from onboarding tunnel */
  onboardingQuizLaunched() {
    fbq("trackCustom", "OnboardingQuizLaunched");
    gtag("event", "onboarding_quiz_launched");
    logToBackend("onboarding_quiz_launched", {});
    log("TRACK: onboarding_quiz_launched");
  },

  /** Onboarding completed */
  onboardingCompleted(method: "quiz" | "evaluation") {
    fbq("track", "CompleteRegistration", { content_name: "Onboarding", method });
    gtag("event", "onboarding_completed", { method });
    logToBackend("onboarding_completed", { method });
    log(`TRACK: onboarding_completed | method=${method}`);
  },

  /** Quiz visitor from ads (non-logged) */
  quizAdVisitor() {
    fbq("trackCustom", "QuizAdVisitor");
    gtag("event", "quiz_ad_visitor");
    logToBackend("quiz_ad_visitor", {});
    log("TRACK: quiz_ad_visitor");
  },

  /** Quiz to signup conversion */
  quizToSignup(method: "google" | "apple" | "email") {
    fbq("track", "Lead", { content_name: "Quiz to Signup", method });
    gtag("event", "quiz_to_signup", { method });
    logToBackend("quiz_to_signup", { method });
    log(`TRACK: quiz_to_signup | method=${method}`);
  },

  /** Generic click on a tracked element */
  trackClick(elementId: string) {
    gtag("event", "click", {
      event_category: "engagement",
      event_label: elementId,
    });
    logToBackend("click", { element: elementId });
    log(`TRACK: click | element=${elementId}`);
  },
};

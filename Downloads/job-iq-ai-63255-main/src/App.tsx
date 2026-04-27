import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Critical path
import Index from "./pages/Index";



// Lazy pages
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Research = lazy(() => import("./pages/Research"));
const Terms = lazy(() => import("./pages/Terms"));
const HomePage = lazy(() => import("./pages/expert/HomePage"));
const EarningsPage = lazy(() => import("./pages/expert/EarningsPage"));
const ProfilePage = lazy(() => import("./pages/expert/ProfilePage"));
const CertificationsPage = lazy(() => import("./pages/expert/CertificationsPage"));
const CertificateViewPage = lazy(() => import("./pages/expert/CertificateViewPage"));
const TestHistoryPage = lazy(() => import("./pages/expert/TestHistoryPage"));
const ExpertTest = lazy(() => import("./pages/expert/ExpertTest"));
const AssessmentPage = lazy(() => import("./pages/expert/AssessmentPage"));
const AnnotatorAssessmentPage = lazy(() => import("./pages/expert/AnnotatorAssessmentPage"));
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate"));
const CookieConsent = lazy(() => import("./components/CookieConsent"));

// New RLHF pages
const TasksPage = lazy(() => import("./pages/expert/TasksPage"));
const AnnotatePage = lazy(() => import("./pages/expert/AnnotatePage"));
const OnboardingPage = lazy(() => import("./pages/expert/OnboardingPage"));
const CertificationPage = lazy(() => import("./pages/expert/CertificationPage"));
const CertificationBriefingPage = lazy(() => import("./pages/expert/CertificationBriefingPage"));
const CertificationAssessmentPage = lazy(() => import("./pages/expert/CertificationAssessmentPage"));
const ApiDocumentation = lazy(() => import("./pages/client/ApiDocumentation"));
const ProjectsPage = lazy(() => import("./pages/client/ProjectsPage"));
const BillingPage = lazy(() => import("./pages/client/BillingPage"));
const SettingsPage = lazy(() => import("./pages/client/SettingsPage"));
const NewProjectWizard = lazy(() => import("./pages/client/NewProjectWizard"));

// Legal pages
const CGUExperts = lazy(() => import("./pages/legal/CGUExperts"));
const CGVClients = lazy(() => import("./pages/legal/CGVClients"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const ApiTerms = lazy(() => import("./pages/legal/ApiTerms"));
const Technology = lazy(() => import("./pages/Technology"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="stef-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/research" element={<Navigate to="/technology" replace />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/legal/cgu-experts" element={<CGUExperts />} />
              <Route path="/legal/cgv-clients" element={<CGVClients />} />
              <Route path="/legal/confidentialite" element={<PrivacyPolicy />} />
              <Route path="/legal/api-terms" element={<ApiTerms />} />
              <Route path="/technology" element={<Technology />} />

              {/* Expert routes */}
              <Route path="/expert" element={<Navigate to="/expert/home" replace />} />
              <Route path="/expert/onboarding" element={<ProtectedRoute requiredRole="expert"><OnboardingPage /></ProtectedRoute>} />
              <Route path="/expert/home" element={<ProtectedRoute requiredRole="expert"><HomePage /></ProtectedRoute>} />
              <Route path="/expert/tasks" element={<ProtectedRoute requiredRole="expert"><TasksPage /></ProtectedRoute>} />
              <Route path="/expert/annotate/:taskId" element={<ProtectedRoute requiredRole="expert"><AnnotatePage /></ProtectedRoute>} />
              <Route path="/expert/certification" element={<ProtectedRoute requiredRole="expert"><CertificationPage /></ProtectedRoute>} />
              <Route path="/expert/certification/:domain" element={<ProtectedRoute requiredRole="expert"><CertificationBriefingPage /></ProtectedRoute>} />
              <Route path="/expert/certification/:domain/assessment" element={<ProtectedRoute requiredRole="expert"><CertificationAssessmentPage /></ProtectedRoute>} />
              <Route path="/expert/earnings" element={<ProtectedRoute requiredRole="expert"><EarningsPage /></ProtectedRoute>} />
              <Route path="/expert/profile" element={<ProtectedRoute requiredRole="expert"><ProfilePage /></ProtectedRoute>} />
              <Route path="/expert/certifications" element={<ProtectedRoute requiredRole="expert"><CertificationsPage /></ProtectedRoute>} />
              <Route path="/expert/certifications/:certificateId" element={<ProtectedRoute requiredRole="expert"><CertificateViewPage /></ProtectedRoute>} />
              <Route path="/expert/test-history" element={<ProtectedRoute requiredRole="expert"><TestHistoryPage /></ProtectedRoute>} />
              <Route path="/expert/test" element={<ProtectedRoute requiredRole="expert"><ExpertTest /></ProtectedRoute>} />
              <Route path="/expert/assessment" element={<ProtectedRoute requiredRole="expert"><AssessmentPage /></ProtectedRoute>} />
              <Route path="/expert/annotator-assessment" element={<ProtectedRoute requiredRole="expert"><AnnotatorAssessmentPage /></ProtectedRoute>} />

              {/* Public verification */}
              <Route path="/verify/:certificateId" element={<VerifyCertificate />} />

              {/* Client routes */}
              <Route path="/client" element={<Navigate to="/client/dashboard" replace />} />
              <Route path="/client/dashboard" element={<ProtectedRoute requiredRole="client"><ClientDashboard /></ProtectedRoute>} />
              <Route path="/client/projects" element={<ProtectedRoute requiredRole="client"><ProjectsPage /></ProtectedRoute>} />
              <Route path="/client/projects/new" element={<ProtectedRoute requiredRole="client"><NewProjectWizard /></ProtectedRoute>} />
              <Route path="/client/billing" element={<ProtectedRoute requiredRole="client"><BillingPage /></ProtectedRoute>} />
              <Route path="/client/settings" element={<ProtectedRoute requiredRole="client"><SettingsPage /></ProtectedRoute>} />
              <Route path="/client/api" element={<ProtectedRoute requiredRole="client"><ApiDocumentation /></ProtectedRoute>} />

              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        
        <Suspense fallback={null}><CookieConsent /></Suspense>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

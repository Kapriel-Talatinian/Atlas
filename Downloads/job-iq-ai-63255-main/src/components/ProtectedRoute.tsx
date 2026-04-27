import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { MaintenanceBanner } from "./MaintenanceBanner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "company" | "expert" | "admin" | "client";
}

const ONBOARDING_PATH = "/expert/onboarding";

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRoles, setUserRoles] = useState<string[] | null>(null);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      // Get roles, maintenance status, and onboarding state in parallel
      const [rolesRes, settingsRes, expertRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase
          .from("platform_settings" as any)
          .select("key, value")
          .in("key", ["maintenance_mode", "maintenance_message"]),
        supabase
          .from("expert_profiles")
          .select("onboarding_completed_at")
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      const roles = rolesRes.data?.map((r) => r.role) || [];
      setUserRoles(roles);
      setOnboardingCompleted(!!expertRes.data?.onboarding_completed_at);

      let enabled = false;
      let message = "";
      if (settingsRes.data) {
        for (const row of settingsRes.data as any[]) {
          if (row.key === "maintenance_mode") enabled = row.value === true || row.value === "true";
          if (row.key === "maintenance_message") message = typeof row.value === "string" ? row.value : "";
        }
      }
      setMaintenance({ enabled, message });
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);

      if (session) {
        setTimeout(() => {
          Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", session.user.id),
            supabase
              .from("expert_profiles")
              .select("onboarding_completed_at")
              .eq("user_id", session.user.id)
              .maybeSingle(),
          ]).then(([rolesRes, expertRes]) => {
            const roles = rolesRes.data?.map((r) => r.role) || [];
            setUserRoles(roles);
            setOnboardingCompleted(!!expertRes.data?.onboarding_completed_at);
          });
        }, 0);
      } else {
        setUserRoles(null);
        setOnboardingCompleted(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading state — wait for auth + (if role required) roles + (if expert) onboarding flag
  const stillResolving =
    isAuthenticated === null ||
    (isAuthenticated && requiredRole && userRoles === null) ||
    (isAuthenticated && requiredRole === "expert" && onboardingCompleted === null);

  if (stillResolving) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Role check
  const hasRequiredRole = requiredRole
    ? userRoles?.includes(requiredRole) ||
      userRoles?.includes("admin") ||
      (requiredRole === "client" && userRoles?.includes("company"))
    : true;

  if (requiredRole && !hasRequiredRole) {
    return <Navigate to="/" replace />;
  }

  // Maintenance mode: block non-admin users
  const isAdmin = userRoles?.includes("admin");
  if (maintenance?.enabled && !isAdmin) {
    return <MaintenanceBanner message={maintenance.message} fullPage />;
  }

  // Onboarding gate: experts must complete the wizard before accessing
  // any /expert/* route except the wizard itself. Admins bypass.
  if (
    requiredRole === "expert" &&
    !isAdmin &&
    onboardingCompleted === false &&
    location.pathname !== ONBOARDING_PATH
  ) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }

  return <>{children}</>;
};
